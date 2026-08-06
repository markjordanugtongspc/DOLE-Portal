import { parseCookies, sendJson } from './http.js';
import { randomToken, sha256 } from './security.js';

const COOKIE_NAME = 'portal_session';
const DEFAULT_TTL_HOURS = 8;
const DEFAULT_REMEMBER_TTL_HOURS = 24 * 7;

const numberEnvironment = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const safeUser = (user = {}) => ({
    id: Number(user.id), role_id: Number(user.role_id), office_id: user.office_id === null ? null : Number(user.office_id),
    full_name: user.full_name, username: user.username, email: user.email, phone: user.phone,
    approval_status: user.approval_status, status: user.status
});

const isSecureRuntime = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL_URL);
const cookieAttributes = (maxAge) => [
    'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', isSecureRuntime() ? 'Secure' : '', 'SameSite=Lax'
].filter(Boolean).join('; ');

/* START PORTAL DATABASE SESSION HELPERS */
export const createSessionCookie = (token, maxAge) => `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes(maxAge)}`;
export const clearSessionCookie = () => `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; ${isSecureRuntime() ? 'Secure; ' : ''}SameSite=Lax`;

export const issuePortalSession = async (admin, userId, remember = false) => {
    const ttlHours = numberEnvironment('PORTAL_REMEMBER_SESSION_TTL_HOURS', DEFAULT_REMEMBER_TTL_HOURS);
    const normalTtlHours = numberEnvironment('PORTAL_SESSION_TTL_HOURS', DEFAULT_TTL_HOURS);
    const maxAge = Math.floor((remember ? ttlHours : normalTtlHours) * 60 * 60);
    const token = randomToken();
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
    const { error } = await admin.from('portal_sessions').insert({
        user_id: Number(userId), token_hash: sha256(token), expires_at: expiresAt
    });
    if (error) throw new Error('Unable to create the secure Portal session.');
    return { token, maxAge };
};

export const getPortalSession = async (req, admin) => {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;
    const { data, error } = await admin
        .from('portal_sessions')
        .select('id, user_id, expires_at, users!inner(id, role_id, office_id, full_name, username, email, phone, approval_status, status, archived_at)')
        .eq('token_hash', sha256(token))
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
    if (error || !data) return null;
    const user = Array.isArray(data.users) ? data.users[0] : data.users;
    if (!user || user.archived_at || String(user.approval_status || '').toUpperCase() !== 'APPROVED') return null;
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