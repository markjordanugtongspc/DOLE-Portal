/**
 * DOLE Iligan Portal — Users API
 * CRUD operations for the users table (Staff, Admin, HR accounts).
 * Used primarily by: staffs-manage.js (Admin manages staff list)
 */

import { supabase } from './supabase.js';

/**
 * Fetch all active users (non-archived), optionally filtered by role.
 * @param {number|null} roleId  — Filter by role_id (optional)
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchUsers(roleId = null) {
    let query = supabase
        .from('users')
        .select(`
            id,
            full_name,
            username,
            email,
            phone,
            status,
            last_seen,
            created_at,
            role_id,
            office_id,
            gip_id,
            archived_at,
            roles ( name ),
            offices ( name )
        `)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

    if (roleId !== null) {
        query = query.eq('role_id', roleId);
    }

    const { data, error } = await query;
    if (error) {
        if (window.DEBUG) window.DEBUG.error('USERS-API', 'Failed to fetch users', error.message);
        return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
}

/**
 * Fetch a single user by ID.
 * @param {number} userId
 * @returns {{ data: object|null, error: string|null }}
 */
export async function fetchUserById(userId) {
    const { data, error } = await supabase
        .from('users')
        .select(`
            id, full_name, username, email, phone, status, last_seen,
            role_id, office_id, gip_id, created_at, archived_at,
            roles ( name ),
            offices ( name )
        `)
        .eq('id', userId)
        .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
}

/**
 * Create a new user (staff, HR, or admin).
 * @param {object} payload  — { role_id, office_id, full_name, username, email, phone, password }
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createUser(payload) {
    const { data, error } = await supabase
        .from('users')
        .insert([payload])
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('USERS-API', 'Create user failed', error.message);
        return { data: null, error: error.message };
    }
    if (window.DEBUG) window.DEBUG.success('USERS-API', `User created: ${payload.username}`);
    return { data, error: null };
}

/**
 * Update an existing user's profile fields.
 * @param {number} userId
 * @param {object} updates  — Partial user object (only changed fields)
 * @returns {{ data: object|null, error: string|null }}
 */
export async function updateUser(userId, updates) {
    const { data, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('USERS-API', `Update user ${userId} failed`, error.message);
        return { data: null, error: error.message };
    }
    if (window.DEBUG) window.DEBUG.success('USERS-API', `User ${userId} updated.`);
    return { data, error: null };
}

/**
 * Archive (soft-delete) a user — sets archived_at timestamp.
 * Archived users cannot log in and are hidden from active lists.
 * @param {number} userId
 * @returns {{ error: string|null }}
 */
export async function archiveUser(userId) {
    const { error } = await supabase
        .from('users')
        .update({ archived_at: new Date().toISOString(), status: 'offline' })
        .eq('id', userId);

    if (error) {
        if (window.DEBUG) window.DEBUG.error('USERS-API', `Archive user ${userId} failed`, error.message);
        return { error: error.message };
    }
    if (window.DEBUG) window.DEBUG.success('USERS-API', `User ${userId} archived.`);
    return { error: null };
}

/**
 * Fetch all roles for dropdown population.
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchRoles() {
    const { data, error } = await supabase.from('roles').select('*').order('id');
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
}

/**
 * Fetch all offices for dropdown population.
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchOffices() {
    const { data, error } = await supabase.from('offices').select('*').order('name');
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
}
