import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, sendJson } from '../_lib/http.js';
import { requirePortalSession } from '../_lib/session.js';

/* START PORTAL CURRENT SESSION API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET'])) return;
    try {
        const session = await requirePortalSession(req, res, createPortalAdmin());
        if (!session) return;
        return sendJson(res, 200, { data: session.user });
    } catch (error) {
        console.error('[PORTAL AUTH] Session lookup failed:', error.message);
        return sendJson(res, 500, { error: 'Server authentication is not configured.' });
    }
}
/* END PORTAL CURRENT SESSION API */