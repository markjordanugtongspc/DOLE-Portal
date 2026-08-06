import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';
import { randomToken } from '../_lib/security.js';
import { requirePortalSession } from '../_lib/session.js';
import { getSsoSystem, hashSsoValue, resolveSsoCallback } from '../_lib/sso.js';

/* START SSO AUTHORIZATION CODE ISSUE API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const session = await requirePortalSession(req, res, admin);
        if (!session) return;

        const body = getRequestBody(req);
        const system = getSsoSystem(body.system_key);
        if (!system) return sendJson(res, 400, { error: 'This system is not supported for SSO.' });
        if (!system.clientSecret) return sendJson(res, 503, { error: 'This system SSO verifier is not configured yet.' });
        const callbackUrl = await resolveSsoCallback(admin, system);

        const { data: link, error: linkError } = await admin
            .from('external_account_links')
            .select('portal_user_id, system_key, external_user_id, external_full_name, external_username')
            .eq('portal_user_id', session.user.id)
            .eq('system_key', system.key)
            .maybeSingle();
        if (linkError || !link) return sendJson(res, 403, { error: 'Your Portal account is not assigned to this system yet.' });

        const code = randomToken(32);
        const state = randomToken(32);
        const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
        const { error: issueError } = await admin.from('sso_authorization_codes').insert({
            portal_user_id: session.user.id,
            system_key: system.key,
            external_user_id: link.external_user_id,
            external_full_name: link.external_full_name,
            external_username: link.external_username,
            redirect_uri: callbackUrl,
            code_hash: hashSsoValue(code),
            state_hash: hashSsoValue(state),
            expires_at: expiresAt
        });
        if (issueError) return sendJson(res, 500, { error: 'Unable to issue the one-time SSO authorization.' });

        const redirect = new URL(callbackUrl);
        redirect.searchParams.set('code', code);
        redirect.searchParams.set('state', state);
        return sendJson(res, 200, { data: { redirect_url: redirect.toString(), expires_at: expiresAt } });
    } catch (error) {
        console.error('[SSO AUTHORIZE] Failed:', error.message);
        return sendJson(res, 400, { error: error.message || 'SSO authorization is not configured.' });
    }
}
/* END SSO AUTHORIZATION CODE ISSUE API */