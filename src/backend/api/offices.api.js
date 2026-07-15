/**
 * DOLE Iligan Portal — Offices API
 * Operations for the offices table.
 */

import { supabase } from './supabase.js';

/**
 * Fetch all offices for dropdown population.
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchOffices() {
    const { data, error } = await supabase
        .from('offices')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        if (window.DEBUG) window.DEBUG.error('OFFICES-API', 'Failed to fetch offices', error.message);
        return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
}
