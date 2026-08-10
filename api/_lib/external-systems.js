import { createClient } from '@supabase/supabase-js';

const safeString = (value) => String(value || '').trim();

const systemConfig = (key) => {
    const configurations = {
        SPES: {
            url: process.env.SPES_SUPABASE_URL || process.env.VITE_SPES_SUPABASE_URL,
            anonKey: process.env.SPES_SUPABASE_ANON_KEY || process.env.VITE_SPES_SUPABASE_ANON_KEY,
            table: 'staffs', select: 'id, full_name, username, email'
        },
        GIP: {
            url: process.env.GIP_SUPABASE_URL || process.env.VITE_GIP_SUPABASE_URL,
            anonKey: process.env.GIP_SUPABASE_ANON_KEY || process.env.VITE_GIP_SUPABASE_ANON_KEY,
            table: 'users', select: 'user_id, full_name, username, email, is_active, portal_sso_enabled'
        }
    };
    return configurations[key] || null;
};

/* START GIP SERVER DIRECTORY LOOKUP - Validates only accounts explicitly enabled by the GIP application */
const getGipDirectoryAccount = async (externalUserId) => {
    const directoryUrl = safeString(process.env.GIP_DIRECTORY_URL);
    const directorySecret = safeString(process.env.GIP_DIRECTORY_CLIENT_SECRET);

    if (directoryUrl && directorySecret) {
        try {
            const endpoint = new URL(directoryUrl);
            endpoint.searchParams.set('id', externalUserId);
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: { 'X-Portal-Directory-Secret': directorySecret, Accept: 'application/json' },
                signal: AbortSignal.timeout(8000)
            });
            const payload = await response.json().catch(() => ({}));
            const user = Array.isArray(payload.data) ? payload.data[0] : null;
            if (response.ok && user?.id) {
                return { id: String(user.id), full_name: safeString(user.full_name), username: safeString(user.username), email: safeString(user.email) };
            }
        } catch (error) {
            console.warn('[GIP DIRECTORY] Account verification fallback:', error.message);
        }
    }

    const config = systemConfig('GIP');
    if (!config?.url || !config?.anonKey) throw new Error('GIP external directory is not configured.');
    const client = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client
        .from(config.table)
        .select(config.select)
        .eq('user_id', externalUserId)
        .eq('is_active', true)
        .eq('portal_sso_enabled', true)
        .maybeSingle();
    if (error || !data) throw new Error('Selected GIP account could not be verified.');
    return { id: String(data.user_id), full_name: safeString(data.full_name), username: safeString(data.username), email: safeString(data.email) };
};
/* END GIP SERVER DIRECTORY LOOKUP */

/* START GIP DIRECTORY SEARCH FALLBACK - Uses the configured GIP Supabase directory if the optional proxy is unavailable */
export const searchGipDirectory = async (fullName) => {
    const term = safeString(fullName);
    const config = systemConfig('GIP');
    if (!config?.url || !config?.anonKey) throw new Error('The GIP account directory is not configured yet.');

    const client = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client
        .from(config.table)
        .select(config.select)
        .ilike('full_name', `%${term}%`)
        .eq('is_active', true)
        .eq('portal_sso_enabled', true)
        .limit(10);

    if (error) throw new Error(`GIP directory search failed: ${error.message}`);
    return (data || []).map((user) => ({
        id: String(user.user_id || ''),
        full_name: safeString(user.full_name),
        username: safeString(user.username),
        email: safeString(user.email)
    })).filter((user) => user.id && user.full_name);
};
/* END GIP DIRECTORY SEARCH FALLBACK */
/* START EXTERNAL ACCOUNT DIRECTORY VALIDATION */
export const validateExternalAccount = async ({ systemKey, externalUserId }) => {
    const key = String(systemKey || '').toUpperCase();
    const identifier = safeString(externalUserId);
    if (!identifier) throw new Error('An external account ID is required.');
    if (key === 'GIP') return getGipDirectoryAccount(identifier);

    const config = systemConfig(key);
    if (!config?.url || !config?.anonKey) throw new Error(`${key} external directory is not configured.`);
    const client = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from(config.table).select(config.select).eq('id', identifier).maybeSingle();
    if (error || !data) throw new Error(`Selected ${key} account could not be verified.`);
    return data;
};
/* END EXTERNAL ACCOUNT DIRECTORY VALIDATION */