/**
 * DOLE Iligan Portal — GIPs API
 * CRUD operations for GIP assistants table.
 * Used by: assistants-manage.js (Staff manages own GIP assistants, max 2)
 */

import { supabase } from './supabase.js';
import { hashCredential } from './auth.api.js';

/**
 * Fetch all active GIP assistants created by a specific staff user.
 * @param {number} createdBy  — The staff user's ID (users.id)
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchGipsByStaff(createdBy) {
    const { data, error } = await supabase
        .from('gips')
        .select('id, full_name, username, email, phone, status, created_at')
        .eq('created_by', createdBy)
        .is('archived_at', null)
        .order('created_at', { ascending: true });

    if (error) {
        if (window.DEBUG) window.DEBUG.error('GIPS-API', 'Failed to fetch GIPs', error.message);
        return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
}

/**
 * Fetch all GIPs (admin view — all assistants).
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchAllGips() {
    const { data, error } = await supabase
        .from('gips')
        .select(`
            id, full_name, username, email, phone, status, created_at,
            users!gips_created_by_fkey ( full_name, username )
        `)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        if (window.DEBUG) window.DEBUG.error('GIPS-API', 'Failed to fetch all GIPs', error.message);
        return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
}

/**
 * Count active GIPs for a specific staff member (enforce max 2 limit).
 * @param {number} createdBy
 * @returns {number}
 */
export async function countGipsByStaff(createdBy) {
    const { count, error } = await supabase
        .from('gips')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', createdBy)
        .is('archived_at', null);

    if (error) return 0;
    return count || 0;
}

/**
 * Create a new GIP assistant.
 * Enforces max 2 per staff member at application level.
 * @param {object} payload  — { full_name, username, email, phone, password, created_by }
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createGip(payload) {
    const safePayload = { ...payload };
    if (safePayload.password) safePayload.password = await hashCredential(safePayload.password);

    // Enforce max 2 per staff
    const currentCount = await countGipsByStaff(safePayload.created_by);
    if (currentCount >= 2) {
        return { data: null, error: 'Maximum of 2 GIP assistants allowed per staff member.' };
    }

    const { data, error } = await supabase
        .from('gips')
        .insert([safePayload])
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('GIPS-API', 'Create GIP failed', error.message);
        return { data: null, error: error.message };
    }
    if (window.DEBUG) window.DEBUG.success('GIPS-API', `GIP created: ${payload.username}`);
    return { data, error: null };
}

/**
 * Update a GIP assistant's profile.
 * @param {number} gipId
 * @param {object} updates
 * @returns {{ data: object|null, error: string|null }}
 */
export async function updateGip(gipId, updates) {
    const safeUpdates = { ...updates };
    if (safeUpdates.password) safeUpdates.password = await hashCredential(safeUpdates.password);

    const { data, error } = await supabase
        .from('gips')
        .update({ ...safeUpdates, updated_at: new Date().toISOString() })
        .eq('id', gipId)
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('GIPS-API', `Update GIP ${gipId} failed`, error.message);
        return { data: null, error: error.message };
    }
    return { data, error: null };
}

/**
 * Archive (soft-delete) a GIP assistant.
 * @param {number} gipId
 * @returns {{ error: string|null }}
 */
export async function archiveGip(gipId) {
    const { error } = await supabase
        .from('gips')
        .update({ archived_at: new Date().toISOString(), status: 'offline' })
        .eq('id', gipId);

    if (error) {
        if (window.DEBUG) window.DEBUG.error('GIPS-API', `Archive GIP ${gipId} failed`, error.message);
        return { error: error.message };
    }
    if (window.DEBUG) window.DEBUG.success('GIPS-API', `GIP ${gipId} archived.`);
    return { error: null };
}

/**
 * Update GIP online/offline status.
 * @param {number} gipId
 * @param {'online'|'offline'} status
 * @returns {{ error: string|null }}
 */
export async function updateGipStatus(gipId, status) {
    const { error } = await supabase
        .from('gips')
        .update({ status })
        .eq('id', gipId);

    if (error) return { error: error.message };
    return { error: null };
}
