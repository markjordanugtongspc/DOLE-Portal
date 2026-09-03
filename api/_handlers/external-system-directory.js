import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';
import { requirePortalSession } from '../_lib/session.js';
import { searchGipDirectory } from '../_lib/external-systems.js';

const safeString = (value) => String(value || '').trim();

/* START GIP SERVER DIRECTORY PROXY - Keeps the GIP directory credential and account data off the browser */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const session = await requirePortalSession(req, res, admin);
        if (!session) return;
        const roleId = Number(session.user.role_id);
        if (roleId !== 1 && roleId !== 3) {
            return sendJson(res, 403, { error: 'Only an approved Portal administrator or staff member can search external directories.' });
        }
        const administrator = session;

        const body = getRequestBody(req);
        const systemKey = safeString(body.system_key).toUpperCase();
        const fullName = safeString(body.full_name);
        if (systemKey !== 'GIP') return sendJson(res, 400, { error: 'Unsupported external system.' });
        if (fullName.length < 2 || fullName.length > 120) return sendJson(res, 400, { error: 'Enter 2 to 120 characters of the user full name.' });

        const directoryUrl = safeString(process.env.GIP_DIRECTORY_URL);
        const directorySecret = safeString(process.env.GIP_DIRECTORY_CLIENT_SECRET);

        // START GIP DIRECTORY PRIMARY LOOKUP
        if (directoryUrl && directorySecret) {
            try {
                const endpoint = new URL(directoryUrl);
                endpoint.searchParams.set('q', fullName);
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: { 'X-Portal-Directory-Secret': directorySecret, Accept: 'application/json' },
                    signal: AbortSignal.timeout(8000)
                });
                const payload = await response.json().catch(() => ({}));
                if (response.ok) {
                    const data = Array.isArray(payload.data) ? payload.data.slice(0, 10).map((user) => ({
                        id: String(user.id || ''), full_name: safeString(user.full_name), username: safeString(user.username), email: safeString(user.email)
                    })).filter((user) => user.id && user.full_name) : [];
                    return sendJson(res, 200, { data });
                }
                console.warn('[GIP DIRECTORY] Primary lookup returned:', response.status);
            } catch (error) {
                console.warn('[GIP DIRECTORY] Primary lookup unavailable:', error.message);
            }
        }
        // END GIP DIRECTORY PRIMARY LOOKUP

        // START GIP DIRECTORY SUPABASE FALLBACK
        const data = await searchGipDirectory(fullName);
        return sendJson(res, 200, { data });
        // END GIP DIRECTORY SUPABASE FALLBACK
    } catch (error) {
        console.error('[GIP DIRECTORY] Search failed:', error.message);
        return sendJson(res, 502, { error: error.message || 'GIP account directory could not be reached.' });
    }
}
/* END GIP SERVER DIRECTORY PROXY */
