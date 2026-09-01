import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, sendJson } from '../_lib/http.js';
import { getPortalSession } from '../_lib/session.js';

/* START PORTAL CURRENT SESSION API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET'])) return;
    try {
        const session = await getPortalSession(req, createPortalAdmin());
        return sendJson(res, 200, { data: session?.user || null });
    } catch (error) {
        console.error('[PORTAL AUTH] Session lookup failed:', error.message);
        return sendJson(res, 200, { data: null });
    }
}
/* END PORTAL CURRENT SESSION API */
