import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, requireSameOrigin, sendJson } from '../_lib/http.js';
import { clearSessionCookie, getPortalSession, revokePortalSession } from '../_lib/session.js';

/* START PORTAL LOGOUT API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;
    try {
        const admin = createPortalAdmin();
        const session = await getPortalSession(req, admin);
        if (session) {
            await Promise.all([
                revokePortalSession(admin, session.sessionId),
                admin.from('users').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', session.user.id)
            ]);
        }
        res.setHeader('Set-Cookie', clearSessionCookie(req));
        return sendJson(res, 200, { data: { logged_out: true } });
    } catch (error) {
        console.error('[PORTAL AUTH] Logout failed:', error.message);
        res.setHeader('Set-Cookie', clearSessionCookie(req));
        return sendJson(res, 200, { data: { logged_out: true } });
    }
}
/* END PORTAL LOGOUT API */