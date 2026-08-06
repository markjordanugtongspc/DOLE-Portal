import { createClient } from '@supabase/supabase-js';

let client;

const requiredEnvironment = (name) => {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Missing required server environment variable: ${name}`);
    return value;
};

/* START PORTAL SUPABASE ADMIN CLIENT */
export const createPortalAdmin = () => {
    if (client) return client;

    const supabaseUrl = String(
        process.env.PORTAL_SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        ''
    ).trim();

    const serviceRoleKey = String(
        process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        ''
    ).trim();

    if (!supabaseUrl) {
        throw new Error('Missing required environment variable: PORTAL_SUPABASE_URL or VITE_SUPABASE_URL');
    }
    if (!serviceRoleKey) {
        throw new Error('Missing required environment variable: PORTAL_SUPABASE_SERVICE_ROLE_KEY');
    }

    client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return client;
};
/* END PORTAL SUPABASE ADMIN CLIENT */