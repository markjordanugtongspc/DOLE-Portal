import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { writeAuditLog } from '../_lib/audit.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';
import { hashCredential } from '../_lib/security.js';

/* ========================================================================== */
/* START: SMSAPI GATEWAY CONFIG RESOLVER                                      */
/* ========================================================================== */
const resolveSmsConfig = () => {
    let uid = process.env.SMSAPI_UID;
    let apiKey = process.env.SMSAPI_KEY;
    let baseUrl = process.env.SMSAPI_BASE_URL || 'https://smsapi.neilian.dev/send';

    if (!uid || !apiKey) {
        try {
            const envPaths = [
                path.resolve(process.cwd(), 'src/backend/config/.env'),
                path.resolve(process.cwd(), '.env'),
                path.resolve(process.cwd(), '.env.local')
            ];
            for (const p of envPaths) {
                if (fs.existsSync(p)) {
                    const content = fs.readFileSync(p, 'utf8');
                    for (const line of content.split('\n')) {
                        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
                        if (match) {
                            const [, key, val] = match;
                            const cleanVal = (val || '').trim().replace(/^['"]|['"]$/g, '');
                            if (key === 'SMSAPI_UID' && !uid) uid = cleanVal;
                            if (key === 'SMSAPI_KEY' && !apiKey) apiKey = cleanVal;
                            if (key === 'SMSAPI_BASE_URL' && baseUrl === 'https://smsapi.neilian.dev/send') baseUrl = cleanVal || baseUrl;
                        }
                    }
                }
            }
        } catch {
            // Ignore in environments without local fs
        }
    }

    return {
        uid: uid || '',
        apiKey: apiKey || '',
        baseUrl: baseUrl || 'https://smsapi.neilian.dev/send'
    };
};
/* ========================================================================== */
/* END: SMSAPI GATEWAY CONFIG RESOLVER                                        */
/* ========================================================================== */

/* ========================================================================== */
/* START: PHONE NORMALIZATION & TOKEN SIGNING                                 */
/* ========================================================================== */
const extractTenDigitPhone = (rawPhone = '') => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length === 12) {
        return digits.slice(2);
    }
    if (digits.startsWith('09') && digits.length === 11) {
        return digits.slice(1);
    }
    if (digits.startsWith('9') && digits.length === 10) {
        return digits;
    }
    return digits.slice(-10);
};

const getPhoneSearchVariants = (rawPhone = '') => {
    const tenDigits = extractTenDigitPhone(rawPhone);
    if (!tenDigits || tenDigits.length !== 10) {
        return [rawPhone].filter(Boolean);
    }

    const set = new Set([
        rawPhone,
        tenDigits,
        `0${tenDigits}`,
        `63${tenDigits}`,
        `+63${tenDigits}`,
        `+63 ${tenDigits}`,
        `+63 ${tenDigits.slice(0, 3)} ${tenDigits.slice(3, 6)} ${tenDigits.slice(6)}`,
        `0${tenDigits.slice(0, 3)} ${tenDigits.slice(3, 6)} ${tenDigits.slice(6)}`,
        `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`
    ]);

    return Array.from(set).filter(Boolean);
};

const findAccountByPhone = async (admin, rawPhone) => {
    const tenDigits = extractTenDigitPhone(rawPhone);
    const variants = getPhoneSearchVariants(rawPhone);

    let { data: users, error: userError } = await admin
        .from('users')
        .select('id, full_name, username, email, phone, approval_status, status, archived_at')
        .in('phone', variants);

    if (userError || !users?.length) {
        if (tenDigits && tenDigits.length === 10) {
            const { data: fallbackUsers } = await admin
                .from('users')
                .select('id, full_name, username, email, phone, approval_status, status, archived_at')
                .ilike('phone', `%${tenDigits}%`);

            if (fallbackUsers?.length) {
                users = fallbackUsers;
            }
        }
    }

    if (users && users.length > 0) {
        const activeUser = users.find((u) => !u.archived_at) || users[0];
        return { user: activeUser, isGip: false };
    }

    let { data: gips, error: gipError } = await admin
        .from('gips')
        .select('id, full_name, username, email, phone, status, archived_at')
        .in('phone', variants);

    if (gipError || !gips?.length) {
        if (tenDigits && tenDigits.length === 10) {
            const { data: fallbackGips } = await admin
                .from('gips')
                .select('id, full_name, username, email, phone, status, archived_at')
                .ilike('phone', `%${tenDigits}%`);

            if (fallbackGips?.length) {
                gips = fallbackGips;
            }
        }
    }

    if (gips && gips.length > 0) {
        const activeGip = gips.find((g) => !g.archived_at) || gips[0];
        return {
            user: {
                id: activeGip.id,
                full_name: activeGip.full_name,
                username: activeGip.username,
                email: activeGip.email,
                phone: activeGip.phone,
                approval_status: 'APPROVED',
                archived_at: activeGip.archived_at
            },
            isGip: true
        };
    }

    return { user: null, isGip: false };
};

const normalizePhilippinePhone = (rawPhone = '') => {
    let clean = String(rawPhone || '').trim().replace(/[\s\-\(\)]/g, '');
    if (clean.startsWith('09')) {
        clean = '+63' + clean.slice(1);
    } else if (clean.startsWith('639')) {
        clean = '+' + clean;
    } else if (clean.startsWith('9') && clean.length === 10) {
        clean = '+63' + clean;
    }
    return clean;
};

const maskPhoneNumber = (phone = '') => {
    const clean = normalizePhilippinePhone(phone);
    if (clean.length >= 13) {
        return `${clean.slice(0, 6)} *** ** ${clean.slice(-2)}`;
    }
    return phone;
};

const getSecretKey = () => {
    return process.env.PORTAL_SESSION_SECRET ||
        process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SMSAPI_KEY ||
        'dole-portal-forgot-password-secret-salt-2026';
};

const createOtpChallenge = (phone, otp, expiresAt) => {
    const payload = `${phone}:${otp}:${expiresAt}`;
    const signature = createHmac('sha256', getSecretKey()).update(payload).digest('hex');
    return Buffer.from(`${phone}:${expiresAt}:${signature}`).toString('base64url');
};

const verifyOtpChallenge = (phone, otp, challenge) => {
    try {
        const decoded = Buffer.from(challenge, 'base64url').toString('utf8');
        const [cPhone, cExpiresAtStr, cSignature] = decoded.split(':');
        const cExpiresAt = Number(cExpiresAtStr);

        if (cPhone !== phone) return { valid: false, error: 'Phone number mismatch.' };
        if (Date.now() > cExpiresAt) return { valid: false, error: 'Verification code has expired. Please request a new one.' };

        const expectedPayload = `${phone}:${otp}:${cExpiresAt}`;
        const expectedSignature = createHmac('sha256', getSecretKey()).update(expectedPayload).digest('hex');

        if (cSignature !== expectedSignature) {
            return { valid: false, error: 'Invalid verification code.' };
        }

        return { valid: true };
    } catch {
        return { valid: false, error: 'Malformed verification challenge.' };
    }
};

const createResetToken = (userId, phone, isGip, expiresAt) => {
    const payload = `${userId}:${phone}:${isGip ? '1' : '0'}:${expiresAt}`;
    const signature = createHmac('sha256', getSecretKey()).update(payload).digest('hex');
    return Buffer.from(`${userId}:${phone}:${isGip ? '1' : '0'}:${expiresAt}:${signature}`).toString('base64url');
};

const verifyResetToken = (resetToken) => {
    try {
        const decoded = Buffer.from(resetToken, 'base64url').toString('utf8');
        const [userIdStr, phone, isGipStr, expiresAtStr, signature] = decoded.split(':');
        const expiresAt = Number(expiresAtStr);
        const userId = Number(userIdStr);
        const isGip = isGipStr === '1';

        if (Date.now() > expiresAt) return { valid: false, error: 'Reset session expired. Please restart the process.' };

        const expectedPayload = `${userId}:${phone}:${isGipStr}:${expiresAt}`;
        const expectedSignature = createHmac('sha256', getSecretKey()).update(expectedPayload).digest('hex');

        if (signature !== expectedSignature) {
            return { valid: false, error: 'Invalid or forged reset token.' };
        }

        return { valid: true, userId, phone, isGip };
    } catch {
        return { valid: false, error: 'Malformed reset token.' };
    }
};
/* ========================================================================== */
/* END: PHONE NORMALIZATION & TOKEN SIGNING                                   */
/* ========================================================================== */

/* ========================================================================== */
/* START SMS TEMPLATE: FORGOT PASSWORD VERIFICATION                           */
/* ========================================================================== */
const formatForgotPasswordSms = ({ fullName, otpCode }) => {
    const firstName = fullName?.trim().split(/\s+/)[0] || 'User';
    return `DOLE LDNPFO: Hello ${firstName}, your password reset code is ${otpCode}. Valid for 5 mins. Do NOT share this code with anyone.`;
};
/* ========================================================================== */
/* END SMS TEMPLATE: FORGOT PASSWORD VERIFICATION                             */
/* ========================================================================== */

/* ========================================================================== */
/* START DISPATCH SMS VIA SMSAPI GATEWAY & RATE LIMITING                      */
/* ========================================================================== */
const recentOtpRequests = new Map();

const checkRateLimit = (phone) => {
    const last = recentOtpRequests.get(phone);
    const now = Date.now();
    if (last && now - last < 60000) {
        const remaining = Math.ceil((60000 - (now - last)) / 1000);
        return { allowed: false, remaining };
    }
    return { allowed: true };
};

const recordOtpSent = (phone) => {
    recentOtpRequests.set(phone, Date.now());
    if (recentOtpRequests.size > 500) {
        const cutoff = Date.now() - 60000;
        for (const [k, v] of recentOtpRequests.entries()) {
            if (v < cutoff) recentOtpRequests.delete(k);
        }
    }
};

const dispatchSms = async (phone, message) => {
    const config = resolveSmsConfig();
    if (!config.apiKey || !config.uid) {
        throw new Error('API Offline Cannot Send, Contact Developer');
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'x-api-key': config.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                uid: config.uid,
                phone,
                message
            })
        });
        clearTimeout(timeoutId);

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { message: responseText };
        }

        if (!response.ok) {
            console.error('[SMSAPI REJECTED]', response.status, data);
            throw new Error('API Offline Cannot Send, Contact Developer');
        }

        return data;
    } catch (err) {
        console.error('[SMSAPI ERROR]', err.message);
        throw new Error('API Offline Cannot Send, Contact Developer');
    }
};
/* ========================================================================== */
/* END DISPATCH SMS VIA SMSAPI GATEWAY & RATE LIMITING                        */
/* ========================================================================== */

export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    const body = getRequestBody(req);
    const action = String(body.action || 'send_otp').toLowerCase();

    /* -------------------------------------------------------------------------- */
    /* ACTION 1: SEND OTP                                                         */
    /* -------------------------------------------------------------------------- */
    if (action === 'send_otp') {
        const rawPhone = String(body.phone || '').trim();
        if (!rawPhone) {
            return sendJson(res, 400, { error: 'Phone number is required.' });
        }

        const normalizedPhone = normalizePhilippinePhone(rawPhone);
        if (!/^\+639\d{9}$/.test(normalizedPhone)) {
            return sendJson(res, 400, {
                error: 'Please enter a valid Philippine mobile number (+63 9XXXXXXXXX).'
            });
        }

        const rateLimit = checkRateLimit(normalizedPhone);
        if (!rateLimit.allowed) {
            return sendJson(res, 429, {
                error: `Please wait ${rateLimit.remaining}s before requesting another OTP.`
            });
        }

        try {
            const admin = createPortalAdmin();
            const { user, isGip: isGipUser } = await findAccountByPhone(admin, rawPhone);

            if (!user || user.archived_at) {
                return sendJson(res, 404, {
                    error: 'No registered account found with this phone number. Please check your number or register.'
                });
            }

            const approvalStatus = String(user.approval_status || 'PENDING').toUpperCase();
            if (approvalStatus !== 'APPROVED') {
                return sendJson(res, 403, {
                    error: 'This account is currently pending approval. Please contact HR or your portal administrator.'
                });
            }

            const otpCode = String(Math.floor(100000 + Math.random() * 900000));
            const expiresAt = Date.now() + (5 * 60 * 1000);
            const challenge = createOtpChallenge(normalizedPhone, otpCode, expiresAt);

            const smsMessage = formatForgotPasswordSms({
                fullName: user.full_name,
                otpCode
            });

            await dispatchSms(normalizedPhone, smsMessage);
            recordOtpSent(normalizedPhone);

            await writeAuditLog(admin, req, {
                eventType: 'auth',
                action: 'forgot_password_otp_sent',
                entityType: 'user',
                entityId: user.id,
                targetUserId: user.id,
                message: `Password reset OTP transmitted to ${maskPhoneNumber(normalizedPhone)}.`,
                metadata: {
                    phone: maskPhoneNumber(normalizedPhone),
                    is_gip: isGipUser
                }
            });

            return sendJson(res, 200, {
                success: true,
                message: `Verification code sent to ${maskPhoneNumber(normalizedPhone)}.`,
                phone: normalizedPhone,
                maskedPhone: maskPhoneNumber(normalizedPhone),
                challenge,
                cooldownSeconds: 60
            });

        } catch (err) {
            console.error('[FORGOT PASSWORD] send_otp error:', err);
            return sendJson(res, 500, {
                error: err.message || 'API Offline Cannot Send, Contact Developer'
            });
        }
    }

    /* -------------------------------------------------------------------------- */
    /* ACTION 2: VERIFY OTP                                                       */
    /* -------------------------------------------------------------------------- */
    if (action === 'verify_otp') {
        const rawPhone = String(body.phone || '').trim();
        const otp = String(body.otp || '').trim();
        const challenge = String(body.challenge || '').trim();

        if (!rawPhone || !otp || !challenge) {
            return sendJson(res, 400, { error: 'Phone number, verification code, and challenge are required.' });
        }

        const normalizedPhone = normalizePhilippinePhone(rawPhone);
        const verification = verifyOtpChallenge(normalizedPhone, otp, challenge);

        if (!verification.valid) {
            return sendJson(res, 400, { error: verification.error || 'Invalid verification code.' });
        }

        try {
            const admin = createPortalAdmin();
            const { user, isGip: isGipUser } = await findAccountByPhone(admin, rawPhone);

            if (!user) {
                return sendJson(res, 404, { error: 'Account record not found.' });
            }

            const resetExpiresAt = Date.now() + (10 * 60 * 1000);
            const resetToken = createResetToken(user.id, normalizedPhone, isGipUser, resetExpiresAt);

            await writeAuditLog(admin, req, {
                eventType: 'auth',
                action: 'forgot_password_otp_verified',
                entityType: 'user',
                entityId: user.id,
                targetUserId: user.id,
                message: `Password reset OTP successfully verified for ${maskPhoneNumber(normalizedPhone)}.`
            });

            return sendJson(res, 200, {
                success: true,
                message: 'Verification code confirmed. Please set your new password.',
                resetToken
            });

        } catch (err) {
            console.error('[FORGOT PASSWORD] verify_otp error:', err);
            return sendJson(res, 500, { error: 'Server error during OTP verification.' });
        }
    }

    /* -------------------------------------------------------------------------- */
    /* ACTION 3: RESET PASSWORD                                                   */
    /* -------------------------------------------------------------------------- */
    if (action === 'reset_password') {
        const resetToken = String(body.resetToken || '').trim();
        const newPassword = String(body.newPassword || '').trim();

        if (!resetToken || !newPassword) {
            return sendJson(res, 400, { error: 'Reset token and new password are required.' });
        }

        if (newPassword.length < 8) {
            return sendJson(res, 400, { error: 'New password must be at least 8 characters long.' });
        }

        const tokenResult = verifyResetToken(resetToken);
        if (!tokenResult.valid) {
            return sendJson(res, 400, { error: tokenResult.error || 'Invalid or expired reset token.' });
        }

        try {
            const admin = createPortalAdmin();
            const hashedPassword = await hashCredential(newPassword);
            const targetTable = tokenResult.isGip ? 'gips' : 'users';

            const { error: updateError } = await admin
                .from(targetTable)
                .update({
                    password: hashedPassword,
                    updated_at: new Date().toISOString()
                })
                .eq('id', tokenResult.userId);

            if (updateError) {
                console.error('[FORGOT PASSWORD] Update password error:', updateError.message);
                return sendJson(res, 500, { error: 'Failed to update password in database.' });
            }

            await writeAuditLog(admin, req, {
                eventType: 'auth',
                action: 'password_reset_completed',
                entityType: 'user',
                entityId: tokenResult.userId,
                targetUserId: tokenResult.userId,
                message: `User completed password reset via SMS verification.`
            });

            return sendJson(res, 200, {
                success: true,
                message: 'Your password has been successfully updated. You may now log in.'
            });

        } catch (err) {
            console.error('[FORGOT PASSWORD] reset_password error:', err);
            return sendJson(res, 500, { error: 'Server error updating password.' });
        }
    }

    return sendJson(res, 400, { error: `Invalid action '${action}'.` });
}
