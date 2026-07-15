/**
 * DOLE Iligan Portal — Systems API
 * CRUD operations for the systems table.
 * Used by: dashboard.js (Staff systems grid), admin systems management page.
 *
 * Image Strategy:
 *  - Default systems use local asset paths (/src/assets/images/slider/...)
 *  - User-uploaded images go to Supabase Storage bucket 'system-images'
 *    and their public URL is stored in image_url column.
 */

import { supabase } from './supabase.js';

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'system-images';

/**
 * Fetch systems from the database.
 * Staff pages pass the default active-only view; admin pages can include inactive rows.
 * @param {{ activeOnly?: boolean, includeArchived?: boolean }} options
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchSystems({ activeOnly = true, includeArchived = false } = {}) {
    let query = supabase
        .from('systems')
        .select('id, title, description, system_url, image_url, color, is_active, created_at, archived_at')
        .order('created_at', { ascending: true });

    if (!includeArchived) {
        query = query.is('archived_at', null);
    }

    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        if (window.DEBUG) window.DEBUG.error('SYSTEMS-API', 'Failed to fetch systems', error.message);
        return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
}

/**
 * Fetch a single system by ID.
 * @param {number} systemId
 * @returns {{ data: object|null, error: string|null }}
 */
export async function fetchSystemById(systemId) {
    const { data, error } = await supabase
        .from('systems')
        .select('*')
        .eq('id', systemId)
        .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
}

/**
 * Create a new system entry.
 * @param {object} payload  — { title, description, system_url, image_url, color }
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createSystem(payload) {
    const { data, error } = await supabase
        .from('systems')
        .insert([payload])
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('SYSTEMS-API', 'Create system failed', error.message);
        return { data: null, error: error.message };
    }
    if (window.DEBUG) window.DEBUG.success('SYSTEMS-API', `System created: "${payload.title}"`);
    return { data, error: null };
}

/**
 * Update a system entry.
 * @param {number} systemId
 * @param {object} updates
 * @returns {{ data: object|null, error: string|null }}
 */
export async function updateSystem(systemId, updates) {
    const { data, error } = await supabase
        .from('systems')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', systemId)
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('SYSTEMS-API', `Update system ${systemId} failed`, error.message);
        return { data: null, error: error.message };
    }
    return { data, error: null };
}

/**
 * Archive (soft-delete) a system.
 * @param {number} systemId
 * @returns {{ error: string|null }}
 */
export async function archiveSystem(systemId) {
    const { error } = await supabase
        .from('systems')
        .update({ archived_at: new Date().toISOString(), is_active: false })
        .eq('id', systemId);

    if (error) return { error: error.message };
    return { error: null };
}

/**
 * Restore an archived (soft-deleted) system.
 * @param {number} systemId
 * @returns {{ error: string|null }}
 */
export async function restoreSystem(systemId) {
    const { error } = await supabase
        .from('systems')
        .update({ archived_at: null, is_active: true })
        .eq('id', systemId);

    if (error) return { error: error.message };
    return { error: null };
}

/**
 * Upload a system image to Supabase Storage and return the public URL.
 * Only called when admin uploads a NEW image — existing local paths are preserved.
 *
 * @param {File} file           — The File object from an <input type="file">
 * @param {number} systemId     — Used as the storage file name for uniqueness
 * @returns {{ url: string|null, error: string|null }}
 */
export async function uploadSystemImage(file, systemId) {
    const ext      = file.name.split('.').pop().toLowerCase();
    const filePath = `system-${systemId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type,
        });

    if (uploadError) {
        if (window.DEBUG) window.DEBUG.error('SYSTEMS-API', 'Image upload failed', uploadError.message);
        return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    if (window.DEBUG) window.DEBUG.success('SYSTEMS-API', `Image uploaded: ${data.publicUrl}`);
    return { url: data.publicUrl, error: null };
}
