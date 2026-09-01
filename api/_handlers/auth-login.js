import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { writeAuditLog } from '../_lib/audit.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';
import { hashCredential, verifyCredential } from '../_lib/security.js';
import { createSessionCookie, issuePortalSession } from '../_lib/session.js';

const identityColumnByMode = { username: 'username', email: 'email', phone: 'phone' };
const safeUser = (user) => ({
    id: Number(user.id), role_id: Number(user.role_id), office_id: user.office_id === null ? null : Number(user.office_id),
    full_name: user.full_name, username: user.username, email: user.email, phone: user.phone,
    birthday: user.birthday, avatar_url: user.avatar_url || null,
    approval_status: user.approval_status, status: 'online',
    is_gip: Boolean(user.is_gip),
    gip_id: user.gip_id || null
});

const maskIdentity = (identity) => {
    const value = String(identity || '').trim();
    if (!value) return null;
    if (value.includes('@')) {
        const [local, domain] = value.split('@');
        return `${local.slice(0, 1)}***@${domain}`;
    }
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
};

const recordLoginAudit = async (req, details) => {
    try {
        await writeAuditLog(createPortalAdmin(), req, {
            eventType: 'auth',
            action: details.success ? 'login_succeeded' : 'login_failed',
            entityType: 'session',
            entityId: details.userId,
            targetUserId: details.userId,
            message: details.success ? 'User logged in.' : 'Failed login attempt.',
            metadata: {
                mode: details.mode,
                reason: details.reason,
                identity_hint: maskIdentity(details.identity),
            },
        });
    } catch (error) {
        console.error('[PORTAL AUDIT] Login audit failed:', error.message);
    }
};

/* START PORTAL BACKEND LOGIN API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    const body = getRequestBody(req);
    const mode = String(body.mode || 'username').toLowerCase();
    const column = identityColumnByMode[mode];
    const identity = String(body.identity || '').trim();
    const credential = String(body.credential || '');
    const credentialColumn = mode === 'phone' ? 'pin' : 'password';
    const normalizedIdentity = mode === 'phone' && /^9\d{9}$/.test(identity) ? `+63${identity}` : identity;

    if (!column || !identity || !credential || credential.length > 1024) {
        await recordLoginAudit(req, { mode, identity, reason: 'invalid_input' });
        return sendJson(res, 400, { error: 'A valid login identity and credential are required.', field: 'credential' });
    }

    try {
        const admin = createPortalAdmin();
        let { data: user, error } = await admin
            .from('users')
            .select('id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, approval_status, status, archived_at, password, pin')
            .eq(column, normalizedIdentity)
            .maybeSingle();

        if (error) {
            console.error('[PORTAL AUTH] Supabase query error:', error.message);
            return sendJson(res, 500, { error: 'Database query failed during authentication.' });
        }

        let isGipUser = false;
        // If not found in users table, check gips table
        if (!user) {
            const { data: gip, error: gipError } = await admin
                .from('gips')
                .select('id, full_name, username, email, phone, avatar_url, status, archived_at, password, created_by')
                .eq(column, normalizedIdentity)
                .maybeSingle();

            if (gipError) {
                console.error('[PORTAL AUTH] Supabase GIP query error:', gipError.message);
                return sendJson(res, 500, { error: 'Database query failed during authentication.' });
            }

            if (gip && !gip.archived_at) {
                isGipUser = true;
                user = {
                    id: gip.id,
                    role_id: 3, // Staff / Assistant role
                    office_id: null,
                    full_name: gip.full_name,
                    birthday: null,
                    username: gip.username,
                    email: gip.email,
                    phone: gip.phone,
                    avatar_url: gip.avatar_url,
                    approval_status: 'APPROVED',
                    status: gip.status || 'offline',
                    archived_at: gip.archived_at,
                    password: gip.password,
                    pin: null,
                    is_gip: true,
                    gip_id: gip.id,
                    created_by: gip.created_by
                };
            }
        }

        if (!user || user.archived_at) {
            await recordLoginAudit(req, { mode, identity, reason: 'credential_invalid', userId: user?.id });
            return sendJson(res, 401, { error: 'Invalid login credentials.', code: 'credential_invalid', field: 'credential' });
        }

        const verification = await verifyCredential(user[credentialColumn], credential);
        if (!verification.valid) {
            await recordLoginAudit(req, { mode, identity, reason: 'credential_invalid', userId: user.id });
            return sendJson(res, 401, { error: 'Invalid login credentials.', code: 'credential_invalid', field: 'credential' });
        }

        const approvalStatus = String(user.approval_status || 'PENDING').toUpperCase();
        if (approvalStatus !== 'APPROVED') {
            const errorMessage = approvalStatus === 'DECLINED'
                ? 'Your registration request was declined. Please contact your HR office or Portal administrator.'
                : 'Your registration is still pending approval.';
            await recordLoginAudit(req, { mode, identity, reason: `approval_${approvalStatus.toLowerCase()}`, userId: user.id });
            return sendJson(res, 403, { error: errorMessage, code: `approval_${approvalStatus.toLowerCase()}`, field: 'identity' });
        }

        if (verification.upgrade) {
            const targetTable = isGipUser ? 'gips' : 'users';
            await admin.from(targetTable).update({ [credentialColumn]: await hashCredential(credential), updated_at: new Date().toISOString() }).eq('id', user.id);
        }
        
        const targetTable = isGipUser ? 'gips' : 'users';
        await admin.from(targetTable).update({ status: 'online', updated_at: new Date().toISOString() }).eq('id', user.id);

        const session = await issuePortalSession(admin, user.id, Boolean(body.remember), isGipUser, user.created_by);
        res.setHeader('Set-Cookie', createSessionCookie(session.token, session.maxAge, req));
        await recordLoginAudit(req, { mode, identity, reason: 'authenticated', success: true, userId: user.id });
        return sendJson(res, 200, { data: safeUser(user) });
    } catch (error) {
        console.error('[PORTAL AUTH] Login failed:', error.message || error);
        return sendJson(res, 500, { error: error.message || 'Server authentication is not configured.' });
    }
}
/* END PORTAL BACKEND LOGIN API */
