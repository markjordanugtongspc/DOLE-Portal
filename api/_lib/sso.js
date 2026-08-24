import { secureEquals, sha256 } from './security.js';

const systemEnvironment = {
    SPES: { titleToken: 'spes', callbackOverride: 'SSO_SPES_CALLBACK_URL', secret: 'SSO_SPES_CLIENT_SECRET' },
    GIP: { titleToken: 'gip', callbackOverride: 'SSO_GIP_CALLBACK_URL', secret: 'SSO_GIP_CLIENT_SECRET' }
};

/* START CALLBACK FROM URL - Validates and constructs SSO callback URL from system base URL */
const callbackFromUrl = (value) => {
    const target = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
        throw new Error('The external system URL is not a valid SSO callback base.');
    }
    return new URL('/sso/callback', target).toString();
};
/* END CALLBACK FROM URL */

/* START GET SSO SYSTEM - Resolves external system SSO credentials and configuration */
export const getSsoSystem = (value) => {
    const key = String(value || '').toUpperCase();
    const configuration = systemEnvironment[key];
    if (!configuration) return null;
    return {
        key,
        titleToken: configuration.titleToken,
        callbackOverride: String(process.env[configuration.callbackOverride] || '').trim(),
        clientSecret: String(process.env[configuration.secret] || '').trim()
    };
};
/* END GET SSO SYSTEM */

/* START DYNAMIC SSO CALLBACK RESOLUTION - Uses the active Portal systems.system_url CRUD value in production */
export const resolveSsoCallback = async (admin, system) => {
    if (!system) throw new Error('The requested external system is not supported.');

    // Local development may override the shared production database URL without changing it.
    if (system.callbackOverride) return callbackFromUrl(system.callbackOverride);

    const { data, error } = await admin
        .from('systems')
        .select('id, title, system_url, is_active, archived_at')
        .eq('is_active', true)
        .is('archived_at', null);
    if (error) throw new Error('Unable to read the configured external systems.');

    const matches = (data || []).filter((item) => String(item.title || '').toLowerCase().includes(system.titleToken));
    if (matches.length !== 1 || !matches[0].system_url) {
        throw new Error(`Configure one active ${system.key} system URL before launching SSO.`);
    }
    return callbackFromUrl(matches[0].system_url);
};
/* END DYNAMIC SSO CALLBACK RESOLUTION */

/* START VERIFY SSO CLIENT - Authenticates external system request via timing-safe secret comparison */
export const verifySsoClient = (req, system) => {
    const supplied = String(req.headers['x-sso-client-secret'] || '');
    return Boolean(system?.clientSecret && supplied && secureEquals(supplied, system.clientSecret));
};
/* END VERIFY SSO CLIENT */

/* START HASH SSO VALUE - Generates SHA-256 hash for secure token verification */
export const hashSsoValue = (value) => sha256(value);
/* END HASH SSO VALUE */