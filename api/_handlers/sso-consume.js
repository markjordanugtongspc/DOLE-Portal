import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, sendJson } from '../_lib/http.js';
import { getSsoSystem, hashSsoValue, verifySsoClient } from '../_lib/sso.js';

/* START SINGLE-USE SSO AUTHORIZATION CONSUME API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    const body = getRequestBody(req);
    const system = getSsoSystem(body.system_key);
    const code = String(body.code || '');
    const state = String(body.state || '');
    if (!system || !code || !state || !verifySsoClient(req, system)) {
        return sendJson(res, 401, { error: 'The system callback is not authorized.' });
    }

    try {
        const { data, error } = await createPortalAdmin().rpc('consume_sso_authorization_code', {
            p_code_hash: hashSsoValue(code),
            p_state_hash: hashSsoValue(state),
            p_system_key: system.key
        });
        const match = Array.isArray(data) ? data[0] : data;
        if (error || !match) return sendJson(res, 401, { error: 'The SSO code is invalid, expired, or already used.' });
        return sendJson(res, 200, {
            data: {
                system_key: match.system_key,
                external_user_id: String(match.external_user_id),
                external_full_name: match.external_full_name || null,
                external_username: match.external_username || null
            }
        });
    } catch (error) {
        console.error('[SSO CONSUME] Failed:', error.message);
        return sendJson(res, 500, { error: 'SSO code validation is not configured.' });
    }
}
/* END SINGLE-USE SSO AUTHORIZATION CONSUME API */
