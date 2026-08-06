import { createClient } from '@supabase/supabase-js';

/* START EXTERNAL SYSTEM USER SEARCH API */
const EXTERNAL_SYSTEMS = {
    SPES: {
        key: 'SPES',
        label: 'SYSTEM 1',
        name: 'SPES Monitoring',
        tableName: 'staffs',
        selectFields: 'id, full_name, username, email, roles ( name ), offices ( name, location )',
        url: import.meta.env.VITE_SPES_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SPES_SUPABASE_ANON_KEY
    },
    GIP: {
        key: 'GIP',
        label: 'SYSTEM 2',
        name: 'DOLE GIP System',
        tableName: 'users',
        selectFields: 'id, full_name, username, email, role_id',
        adminRoleId: 1,
        url: import.meta.env.VITE_GIP_SUPABASE_URL,
        anonKey: import.meta.env.VITE_GIP_SUPABASE_ANON_KEY
    }
};

const clients = new Map();

export const getExternalSystemConfigs = () => Object.values(EXTERNAL_SYSTEMS);

const getClient = (system) => {
    if (!system.url || !system.anonKey) {
        return { client: null, error: `${system.name} is not configured. Add its public anon/publishable key to the Portal environment.` };
    }
    if (!clients.has(system.key)) {
        clients.set(system.key, createClient(system.url, system.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        }));
    }
    return { client: clients.get(system.key), error: null };
};

/**
 * Search one external system by full name.
 * Only safe directory fields are selected; the external RLS policy remains authoritative.
 */
export async function fetchExternalUsers({ systemKey, fullName }) {
    const system = EXTERNAL_SYSTEMS[systemKey];
    const term = String(fullName || '').trim();
    if (!system) return { data: [], error: 'Unknown external system.' };
    if (term.length < 2) return { data: [], error: 'Enter at least 2 characters of the user full name.' };

    if (systemKey === 'GIP') {
        try {
            const response = await fetch('/api/external-system-directory', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system_key: 'GIP', full_name: term })
            });
            const payload = await response.json();
            return response.ok
                ? { data: (payload.data || []).map((user) => ({ ...user, system_key: system.key, system_name: system.name })), error: null }
                : { data: [], error: payload.error || `Unable to search ${system.name}.` };
        } catch {
            return { data: [], error: `Unable to search ${system.name}.` };
        }
    }

    const { client, error: clientError } = getClient(system);
    if (clientError) return { data: [], error: clientError };

    let query = client
        .from(system.tableName)
        .select(system.selectFields)
        .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(10);

    if (system.adminRoleId) query = query.eq('role_id', system.adminRoleId);

    const { data, error } = await query;

    if (error) {
        window.DEBUG?.error('EXTERNAL-SYSTEMS-API', `Failed to search ${system.name}.`, error.message);
        return { data: [], error: `Unable to search ${system.name}. ${error.message}` };
    }

    return {
        data: (data || []).filter((user) => !system.adminRoleId || Number(user.role_id) === Number(system.adminRoleId)).map((user) => ({ ...user, system_key: system.key, system_name: system.name })),
        error: null
    };
}
/* END EXTERNAL SYSTEM USER SEARCH API */