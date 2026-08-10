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

const loadUser = (admin, userId) => admin
    .from('users')
    .select('id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, approval_status, status, archived_at, password, pin')
    .eq('id', userId)
    .single();

/* START PROFILE SETTINGS API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET', 'PUT'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const session = await requirePortalSession(req, res, admin);
        if (!session) return;

        if (req.method === 'GET') {
            const { data, error } = await loadUser(admin, session.user.id);
            if (error || !data) return sendJson(res, 404, { error: 'Your user profile could not be found.' });
            return sendJson(res, 200, { data: safeUser(data) });
        }

        const body = getRequestBody(req);
        const fullName = String(body.full_name || '').trim();
        const username = String(body.username || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim() || null;
        const birthday = normalizeDate(String(body.birthday || '').trim());
        const avatarUrl = body.avatar_url === null || body.avatar_url === '' ? null : String(body.avatar_url || '').trim();

        if (!fullName || fullName.length > 160) return sendJson(res, 400, { error: 'Please provide a valid full name.' });
        if (!username || username.length > 80) return sendJson(res, 400, { error: 'Please provide a valid username.' });
        if (!email || !isValidEmail(email) || email.length > 180) return sendJson(res, 400, { error: 'Please provide a valid email address.' });
        if (String(body.birthday || '').trim() && !birthday) return sendJson(res, 400, { error: 'Please provide a valid birthday.' });
        if (avatarUrl && avatarUrl.length > 2048) return sendJson(res, 400, { error: 'The avatar URL is too long.' });

        const { data: current, error: currentError } = await loadUser(admin, session.user.id);
        if (currentError || !current) return sendJson(res, 404, { error: 'Your user profile could not be found.' });

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
            if (newPassword.length < 12 || newPassword.length > 256) {
                return sendJson(res, 400, { error: 'The new password must be 12 to 256 characters long.' });
            }
            const verification = await verifyCredential(current.password, currentPassword);
            if (!verification.valid) return sendJson(res, 400, { error: 'The current password is incorrect.' });
        }

        const duplicateQuery = async (column, value) => admin
            .from('users')
            .select('id')
            .eq(column, value)
            .neq('id', session.user.id)
            .is('archived_at', null)
            .maybeSingle();
        const [usernameMatch, emailMatch] = await Promise.all([
            duplicateQuery('username', username),
            duplicateQuery('email', email)
        ]);
        if (usernameMatch.error || emailMatch.error) return sendJson(res, 500, { error: 'Unable to validate profile uniqueness.' });
        if (usernameMatch.data) return sendJson(res, 409, { error: 'That username is already in use.', field: 'username' });
        if (emailMatch.data) return sendJson(res, 409, { error: 'That email address is already in use.', field: 'email' });

        const updates = { full_name: fullName, birthday, username, email, phone, avatar_url, updated_at: new Date().toISOString() };
        if (changingPassword) updates.password = await hashCredential(newPassword);
        const { data: updated, error: updateError } = await admin
            .from('users')
            .update(updates)
            .eq('id', session.user.id)
            .select('id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, approval_status, status')
            .single();
        if (updateError || !updated) return sendJson(res, 500, { error: updateError?.message || 'Unable to save your profile.' });

        await writeAuditLog(admin, req, {
            actorId: session.user.id,
            targetUserId: session.user.id,
            eventType: 'account',
            action: changingPassword ? 'profile_and_password_changed' : 'profile_updated',
            entityType: 'user',
            entityId: session.user.id,
            message: changingPassword ? 'User profile and password changed.' : 'User profile changed.',
            metadata: { changed_fields: [...profileFields.filter((field) => Object.prototype.hasOwnProperty.call(updates, field)), ...(changingPassword ? ['password'] : [])] }
        });

        return sendJson(res, 200, { data: safeUser(updated) });
    } catch (error) {
        console.error('[PORTAL PROFILE] Profile update failed:', error.message);
        return sendJson(res, 500, { error: 'Unable to update your profile right now.' });
    }
}
/* END PROFILE SETTINGS API */