import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, sendJson } from '../_lib/http.js';
import { getPortalSession } from '../_lib/session.js';

/* START PORTAL CURRENT SESSION & STATUS API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET', 'POST', 'PATCH'])) return;
    try {
        const admin = createPortalAdmin();
        const session = await getPortalSession(req, admin);

        if (req.method === 'POST' || req.method === 'PATCH') {
            if (!session || !session.user) {
                return sendJson(res, 401, { error: 'No active session found.' });
            }
            const body = getRequestBody(req);
            const status = body.status === 'online' ? 'online' : 'offline';
            const timestamp = new Date().toISOString();

            if (session.user.is_gip) {
                await admin.from('gips').update({ status, updated_at: timestamp }).eq('id', session.user.id);
            } else {
                await admin.from('users').update({ status, last_seen: timestamp }).eq('id', session.user.id);
            }

            return sendJson(res, 200, { data: { status, user_id: session.user.id } });
        }

        return sendJson(res, 200, { data: session?.user || null });
    } catch (error) {
        console.error('[PORTAL AUTH] Session / status handler failed:', error.message);
        return sendJson(res, 200, { data: null });
    }
}
/* END PORTAL CURRENT SESSION & STATUS API */
