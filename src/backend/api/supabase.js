/**
 * DOLE Iligan Portal — Supabase Client Initialization
 * Centralized Supabase client — import this in all API modules.
 *
 * Uses VITE_ prefixed env vars (loaded from src/backend/config/.env via vite.config.js envDir)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
        '[Supabase] ❌  Missing environment variables. ' +
        'Ensure src/backend/config/.env exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
}

/**
 * Shared Supabase client instance for all frontend API calls.
 * Uses the anon public key — Row Level Security (RLS) applies.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});

if (window.DEBUG) {
    window.DEBUG.success('SUPABASE', `Client initialized → ${SUPABASE_URL}`);
}
