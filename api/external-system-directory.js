import { createPortalAdmin } from './_lib/supabase-admin.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from './_lib/http.js';
import { requirePortalAdmin } from './_lib/session.js';

const safeString = (value) => String(value || '').trim();

/* START GIP SERVER DIRECTORY PROXY - Keeps the GIP directory credential and account data off the browser */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const administrator = await requirePortalAdmin(req, res, admin);
        if (!administrator) return;

        const body = getRequestBody(req);
        const systemKey = safeString(body.system_key).toUpperCase();
        const fullName = safeString(body.full_name);
        if (systemKey !== 'GIP') return sendJson(res, 400, { error: 'Unsupported external system.' });
        if (fullName.length < 2 || fullName.length > 120) return sendJson(res, 400, { error: 'Enter 2 to 120 characters of the user full name.' });

        const directoryUrl = safeString(process.env.GIP_DIRECTORY_URL);
        const directorySecret = safeString(process.env.GIP_DIRECTORY_CLIENT_SECRET);
        if (!directoryUrl || !directorySecret) return sendJson(res, 503, { error: 'The GIP account directory is not configured yet.' });

        const endpoint = new URL(directoryUrl);
        endpoint.searchParams.set('q', fullName);
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'X-Portal-Directory-Secret': directorySecret, Accept: 'application/json' },
            signal: AbortSignal.timeout(8000)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return sendJson(res, 502, { error: payload.error || 'GIP account directory could not be reached.' });

        const data = Array.isArray(payload.data) ? payload.data.slice(0, 10).map((user) => ({
            id: String(user.id || ''), full_name: safeString(user.full_name), username: safeString(user.username), email: safeString(user.email)
        })).filter((user) => user.id && user.full_name) : [];
        return sendJson(res, 200, { data });
    } catch (error) {
        console.error('[GIP DIRECTORY] Search failed:', error.message);
        return sendJson(res, 502, { error: 'GIP account directory could not be reached.' });
    }
}
/* END GIP SERVER DIRECTORY PROXY */