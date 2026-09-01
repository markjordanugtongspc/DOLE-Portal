import { createPortalAdmin } from './_lib/supabase-admin.js';
import { writeAuditLog } from './_lib/audit.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from './_lib/http.js';
import { hashCredential, verifyCredential } from './_lib/security.js';
import { requirePortalSession } from './_lib/session.js';

const profileFields = ['full_name', 'birthday', 'username', 'email', 'phone', 'avatar_url'];
const safeUser = (user = {}) => ({
    id: Number(user.id),
    role_id: Number(user.role_id),
    office_id: user.office_id === null ? null : Number(user.office_id),
    full_name: user.full_name,
    birthday: user.birthday || null,
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url || null,
    approval_status: user.approval_status,
    status: user.status
});

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizeDate = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : value;
};

const loadUser = async (admin, userId, isGip = false) => {
    if (isGip) {
        const { data, error } = await admin
            .from('gips')
            .select('id, full_name, username, email, phone, avatar_url, status, archived_at, password')
            .eq('id', userId)
            .maybeSingle();

        if (error || !data) return { data: null, error };
        return {
            data: {
                ...data,
                role_id: 3,
                office_id: null,
                birthday: null,
                approval_status: 'APPROVED',
                is_gip: true,
                gip_id: data.id
            },
            error: null
        };
    }

    return admin
        .from('users')
        .select('id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, approval_status, status, archived_at, password')
        .eq('id', userId)
        .maybeSingle();
};

/* START PROFILE SETTINGS API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET', 'PUT'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const session = await requirePortalSession(req, res, admin);
        if (!session) return;

        const isGip = Boolean(session.user?.is_gip);

        if (req.method === 'GET') {
            const { data, error } = await loadUser(admin, session.user.id, isGip);
            if (error || !data) return sendJson(res, 404, { error: 'Your user profile could not be found.' });
            return sendJson(res, 200, { data: safeUser(data) });
        }

        const { data: current, error: currentError } = await loadUser(admin, session.user.id, isGip);
        if (currentError || !current) return sendJson(res, 404, { error: 'Your user profile could not be found.' });

        const body = getRequestBody(req);
        const fullName = String(body.full_name || current.full_name || '').trim();
        const username = String(body.username || current.username || '').trim();
        const email = String(body.email || current.email || '').trim().toLowerCase();
        const phone = body.phone !== undefined ? (String(body.phone || '').trim() || null) : current.phone;
        const birthday = isGip ? null : (body.birthday !== undefined ? normalizeDate(String(body.birthday || '').trim()) : current.birthday);
        const avatar_url = body.avatar_url !== undefined ? (body.avatar_url ? String(body.avatar_url).trim() : null) : current.avatar_url;

        if (!fullName || fullName.length > 160) return sendJson(res, 400, { error: 'Please provide a valid full name.' });
        if (!username || username.length > 80) return sendJson(res, 400, { error: 'Please provide a valid username.' });
        if (!email || !isValidEmail(email) || email.length > 180) return sendJson(res, 400, { error: 'Please provide a valid email address.' });
        if (avatar_url && avatar_url.length > 2048) return sendJson(res, 400, { error: 'The avatar URL is too long.' });

        const newPassword = String(body.new_password || '');
        const newPasswordConfirm = String(body.new_password_confirm || '');
        const currentPassword = String(body.current_password || '');
        const currentPasswordConfirm = String(body.current_password_confirm || '');
        const changingPassword = Boolean(newPassword || newPasswordConfirm || currentPassword || currentPasswordConfirm);

        if (changingPassword) {
            if (!currentPassword || !currentPasswordConfirm || currentPassword !== currentPasswordConfirm) {
                return sendJson(res, 400, { error: 'Current password and confirmation must match.' });
            }
            if (!newPassword || !newPasswordConfirm || newPassword !== newPasswordConfirm) {
                return sendJson(res, 400, { error: 'New password and confirmation must match.' });
            }
            if (newPassword.length < 8 || newPassword.length > 256) {
                return sendJson(res, 400, { error: 'The new password must be at least 8 characters long.' });
            }
            const verification = await verifyCredential(current.password, currentPassword);
            if (!verification.valid) return sendJson(res, 400, { error: 'The current password is incorrect.' });
        }

        const duplicateQuery = async (column, value) => {
            const userQ = admin.from('users').select('id').eq(column, value).is('archived_at', null);
            if (!isGip) userQ.neq('id', session.user.id);
            const gipQ = admin.from('gips').select('id').eq(column, value).is('archived_at', null);
            if (isGip) gipQ.neq('id', session.user.id);

            const [uRes, gRes] = await Promise.all([userQ.maybeSingle(), gipQ.maybeSingle()]);
            return { data: uRes.data || gRes.data, error: uRes.error || gRes.error };
        };

        const [usernameMatch, emailMatch] = await Promise.all([
            duplicateQuery('username', username),
            duplicateQuery('email', email)
        ]);
        if (usernameMatch.error || emailMatch.error) return sendJson(res, 500, { error: 'Unable to validate profile uniqueness.' });
        if (usernameMatch.data) return sendJson(res, 409, { error: 'That username is already in use.', field: 'username' });
        if (emailMatch.data) return sendJson(res, 409, { error: 'That email address is already in use.', field: 'email' });

        const targetTable = isGip ? 'gips' : 'users';
        const updates = isGip
            ? { full_name: fullName, username, email, phone, avatar_url, updated_at: new Date().toISOString() }
            : { full_name: fullName, birthday, username, email, phone, avatar_url, updated_at: new Date().toISOString() };

        if (changingPassword) updates.password = await hashCredential(newPassword);

        const { data: updated, error: updateError } = await admin
            .from(targetTable)
            .update(updates)
            .eq('id', session.user.id)
            .select(isGip ? 'id, full_name, username, email, phone, avatar_url, status' : 'id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, approval_status, status')
            .maybeSingle();

        if (updateError || !updated) return sendJson(res, 500, { error: updateError?.message || 'Unable to save your profile.' });

        const finalUser = isGip ? { ...updated, role_id: 3, is_gip: true, gip_id: updated.id, approval_status: 'APPROVED' } : updated;

        try {
            await writeAuditLog(admin, req, {
                actorId: isGip ? null : session.user.id,
                targetUserId: isGip ? null : session.user.id,
                eventType: 'account',
                action: changingPassword ? 'profile_and_password_changed' : 'profile_updated',
                entityType: isGip ? 'gip' : 'user',
                entityId: session.user.id,
                message: changingPassword ? 'Profile and password changed.' : 'Profile updated.',
                metadata: { changed_fields: [...profileFields.filter((field) => Object.prototype.hasOwnProperty.call(updates, field)), ...(changingPassword ? ['password'] : [])] }
            });
        } catch (auditErr) {
            console.warn('[PORTAL AUDIT] Profile update audit log skipped:', auditErr.message);
        }

        return sendJson(res, 200, { data: safeUser(finalUser) });
    } catch (error) {
        console.error('[PORTAL PROFILE] Profile update failed:', error);
        return sendJson(res, 500, { error: error.message || 'Unable to update your profile right now.' });
    }
}
/* END PROFILE SETTINGS API */