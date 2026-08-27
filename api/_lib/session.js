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

/* START ISSUE PORTAL SESSION - Creates secure cookie session for regular users and GIP assistants */
export const issuePortalSession = async (admin, userId, remember = false, isGip = false, createdBy = null) => {
    const ttlHours = numberEnvironment('PORTAL_REMEMBER_SESSION_TTL_HOURS', DEFAULT_REMEMBER_TTL_HOURS);
    const normalTtlHours = numberEnvironment('PORTAL_SESSION_TTL_HOURS', DEFAULT_TTL_HOURS);
    const maxAge = Math.floor((remember ? ttlHours : normalTtlHours) * 60 * 60);
    const rawToken = randomToken();
    const token = isGip ? `gip:${userId}:${rawToken}` : rawToken;
    const now = new Date();
    
    // For foreign key constraint on portal_sessions.user_id (which references public.users(id))
    let sessionUserId = Number(userId);
    if (isGip) {
        if (createdBy && Number.isFinite(Number(createdBy))) {
            sessionUserId = Number(createdBy);
        } else {
            // Find valid created_by or fallback to an existing valid user id in users table
            const { data: gipRecord } = await admin
                .from('gips')
                .select('created_by')
                .eq('id', userId)
                .maybeSingle();

            if (gipRecord?.created_by) {
                sessionUserId = Number(gipRecord.created_by);
            } else {
                const { data: fallbackUser } = await admin
                    .from('users')
                    .select('id')
                    .limit(1)
                    .maybeSingle();
                sessionUserId = fallbackUser?.id ? Number(fallbackUser.id) : 1;
            }
        }
    }

    const { error } = await admin.from('portal_sessions').insert({
        user_id: sessionUserId,
        token_hash: sha256(token),
        expires_at: new Date(now.getTime() + maxAge * 1000).toISOString(),
        last_activity_at: now.toISOString()
    });
    
    if (error) {
        console.error('[PORTAL AUTH] Session insert error:', error.message);
        throw new Error(error.message || 'Unable to create the secure Portal session.');
    }
    return { token, maxAge };
};
/* END ISSUE PORTAL SESSION */

/* START GET PORTAL SESSION - Resolves active session from request cookies for users and GIP assistants */
export const getPortalSession = async (req, admin) => {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;

    const { data, error } = await admin
        .from('portal_sessions')
        .select('id, user_id, expires_at, last_activity_at')
        .eq('token_hash', sha256(token))
        .is('revoked_at', null)
        .maybeSingle();
    if (error || !data) return null;

    const now = Date.now();
    const inactivityHours = numberEnvironment('PORTAL_INACTIVITY_TIMEOUT_HOURS', DEFAULT_INACTIVITY_HOURS);
    const inactivityCutoff = now - inactivityHours * 60 * 60 * 1000;
    const expiresAt = new Date(data.expires_at || 0).getTime();
    const lastActivityAt = new Date(data.last_activity_at || 0).getTime();

    const isGipToken = token.startsWith('gip:');
    const gipId = isGipToken ? Number(token.split(':')[1]) : null;

    if (!Number.isFinite(expiresAt) || expiresAt <= now || !Number.isFinite(lastActivityAt) || lastActivityAt <= inactivityCutoff) {
        const timestamp = new Date(now).toISOString();
        const updates = [admin.from('portal_sessions').update({ revoked_at: timestamp }).eq('id', data.id)];
        if (isGipToken && gipId) {
            updates.push(admin.from('gips').update({ status: 'offline' }).eq('id', gipId));
        } else {
            updates.push(admin.from('users').update({ status: 'offline', last_seen: timestamp }).eq('id', data.user_id));
        }
        await Promise.all(updates);
        return null;
    }

    let user = null;
    let isGip = false;

    if (isGipToken && gipId) {
        const { data: gipRecord } = await admin
            .from('gips')
            .select('id, full_name, username, email, phone, avatar_url, status, archived_at, created_by')
            .eq('id', gipId)
            .is('archived_at', null)
            .maybeSingle();

        if (gipRecord) {
            isGip = true;
            user = {
                id: gipRecord.id,
                role_id: 3,
                office_id: null,
                full_name: gipRecord.full_name,
                birthday: null,
                username: gipRecord.username,
                email: gipRecord.email,
                phone: gipRecord.phone,
                avatar_url: gipRecord.avatar_url,
                approval_status: 'APPROVED',
                status: gipRecord.status || 'online',
                archived_at: gipRecord.archived_at,
                is_gip: true,
                gip_id: gipRecord.id
            };
        }
    } else {
        const { data: userRecord } = await admin
            .from('users')
            .select('id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, approval_status, status, archived_at')
            .eq('id', data.user_id)
            .is('archived_at', null)
            .maybeSingle();

        user = userRecord;
    }

    if (!user || user.archived_at || String(user.approval_status || '').toUpperCase() !== 'APPROVED') return null;

    // START SESSION ACTIVITY TOUCH
    // Every authenticated request keeps the server-side inactivity window current.
    await admin.from('portal_sessions').update({ last_activity_at: new Date(now).toISOString() }).eq('id', data.id);
    // END SESSION ACTIVITY TOUCH
    return { sessionId: data.id, user: { ...safeUser(user), is_gip: isGip, gip_id: isGip ? user.id : null } };
};
/* END GET PORTAL SESSION */

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