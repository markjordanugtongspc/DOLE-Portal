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
    client = createClient(
        String(process.env.PORTAL_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim(),
        requiredEnvironment('PORTAL_SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
    return client;
};
/* END PORTAL SUPABASE ADMIN CLIENT */