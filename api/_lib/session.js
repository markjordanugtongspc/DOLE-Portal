import { parseCookies, sendJson } from './http.js';
import { randomToken, sha256 } from './security.js';

const COOKIE_NAME = 'portal_session';
const DEFAULT_TTL_HOURS = 8;
const DEFAULT_REMEMBER_TTL_HOURS = 24 * 7;
const DEFAULT_INACTIVITY_HOURS = 2;

const numberEnvironment = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const safeUser = (user = {}) => ({
    id: Number(user.id), role_id: Number(user.role_id), office_id: user.office_id === null ? null : Number(user.office_id),
    full_name: user.full_name, username: user.username, email: user.email, phone: user.phone,
    birthday: user.birthday, avatar_url: user.avatar_url || null,
    approval_status: user.approval_status, status: user.status
});

const isSecureRuntime = (req) => {
    const host = String(req?.headers?.host || '').toLowerCase();
    if (host.includes('localhost') || host.includes('127.0.0.1')) return false;
    return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL_URL);
};

const cookieAttributes = (maxAge, req) => [
    'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', isSecureRuntime(req) ? 'Secure' : '', 'SameSite=Lax'
].filter(Boolean).join('; ');

/* START PORTAL DATABASE SESSION HELPERS */
export const createSessionCookie = (token, maxAge, req) => `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes(maxAge, req)}`;
export const clearSessionCookie = (req) => `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; ${isSecureRuntime(req) ? 'Secure; ' : ''}SameSite=Lax`;

export const issuePortalSession = async (admin, userId, remember = false) => {
    const ttlHours = numberEnvironment('PORTAL_REMEMBER_SESSION_TTL_HOURS', DEFAULT_REMEMBER_TTL_HOURS);
    const normalTtlHours = numberEnvironment('PORTAL_SESSION_TTL_HOURS', DEFAULT_TTL_HOURS);
    const maxAge = Math.floor((remember ? ttlHours : normalTtlHours) * 60 * 60);
    const token = randomToken();
    const now = new Date();
    const { error } = await admin.from('portal_sessions').insert({
        user_id: Number(userId),
        token_hash: sha256(token),
        expires_at: new Date(now.getTime() + maxAge * 1000).toISOString(),
        last_activity_at: now.toISOString()
    });
    if (error) throw new Error('Unable to create the secure Portal session.');
    return { token, maxAge };
};

export const getPortalSession = async (req, admin) => {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;

    const { data, error } = await admin
        .from('portal_sessions')
        .select('id, user_id, expires_at, last_activity_at, users!inner(id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, approval_status, status, archived_at)')
        .eq('token_hash', sha256(token))
        .is('revoked_at', null)
        .maybeSingle();
    if (error || !data) return null;

    const now = Date.now();
    const inactivityHours = numberEnvironment('PORTAL_INACTIVITY_TIMEOUT_HOURS', DEFAULT_INACTIVITY_HOURS);
    const inactivityCutoff = now - inactivityHours * 60 * 60 * 1000;
    const expiresAt = new Date(data.expires_at || 0).getTime();
    const lastActivityAt = new Date(data.last_activity_at || 0).getTime();

    if (!Number.isFinite(expiresAt) || expiresAt <= now || !Number.isFinite(lastActivityAt) || lastActivityAt <= inactivityCutoff) {
        const timestamp = new Date(now).toISOString();
        await Promise.all([
            admin.from('portal_sessions').update({ revoked_at: timestamp }).eq('id', data.id),
            admin.from('users').update({ status: 'offline', last_seen: timestamp }).eq('id', data.user_id)
        ]);
        return null;
    }

    const user = Array.isArray(data.users) ? data.users[0] : data.users;
    if (!user || user.archived_at || String(user.approval_status || '').toUpperCase() !== 'APPROVED') return null;

    // START SESSION ACTIVITY TOUCH
    // Every authenticated request keeps the server-side inactivity window current.
    await admin.from('portal_sessions').update({ last_activity_at: new Date(now).toISOString() }).eq('id', data.id);
    // END SESSION ACTIVITY TOUCH
    return { sessionId: data.id, user: safeUser(user) };
};

export const requirePortalSession = async (req, res, admin) => {
    const session = await getPortalSession(req, admin);
    if (!session) {
        sendJson(res, 401, { error: 'Your secure session is missing or expired. Please sign in again.' });
        return null;
    }
    return session;
};

export const requirePortalAdmin = async (req, res, admin) => {
    const session = await requirePortalSession(req, res, admin);
    if (!session) return null;
    if (Number(session.user.role_id) !== 1) {
        sendJson(res, 403, { error: 'Only an approved Portal administrator can assign external accounts.' });
        return null;
    }
    return session;
};

export const revokePortalSession = async (admin, sessionId) => {
    if (!sessionId) return;
    await admin.from('portal_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId);
};
/* END PORTAL DATABASE SESSION HELPERS */