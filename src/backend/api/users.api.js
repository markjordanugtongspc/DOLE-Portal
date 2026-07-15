/**
 * DOLE Iligan Portal — Users API
 * CRUD operations for the users table (Staff, Admin, HR accounts).
 * Used primarily by: staffs-manage.js (Admin manages staff list)
 */

import { supabase } from './supabase.js';
import { hashCredential } from './auth.api.js';

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
            birthday,
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
 * Fetch count metrics used by the admin dashboard cards.
 * Counts active users by id from the users table.
 * @returns {{ data: { totalStaff: number|null, totalResigned: number|null }, error: string|null }}
 */
export async function fetchUserDashboardCounts() {
    const [activeUsersResult, resignedResult] = await Promise.all([
        supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .is('archived_at', null),
        supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .not('archived_at', 'is', null),
    ]);

    const error = activeUsersResult.error || resignedResult.error;
    if (error) {
        if (window.DEBUG) window.DEBUG.error('USERS-API', 'Failed to fetch dashboard user counts', error.message);
        return { data: { totalStaff: null, totalResigned: null }, error: error.message };
    }
    const totalStaff = activeUsersResult.count ?? 0;

    return {
        data: {
            totalStaff,
            totalResigned: resignedResult.count ?? 0,
        },
        error: null,
    };
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
            id, full_name, birthday, username, email, phone, status, last_seen,
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
    const safePayload = { ...payload };
    if (safePayload.password) safePayload.password = await hashCredential(safePayload.password);
    if (safePayload.pin) safePayload.pin = await hashCredential(safePayload.pin);

    const { data, error } = await supabase
        .from('users')
        .insert([safePayload])
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
    const safeUpdates = { ...updates };
    if (safeUpdates.password) safeUpdates.password = await hashCredential(safeUpdates.password);
    if (safeUpdates.pin) safeUpdates.pin = await hashCredential(safeUpdates.pin);

    const { data, error } = await supabase
        .from('users')
        .update({ ...safeUpdates, updated_at: new Date().toISOString() })
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

export { fetchOffices } from './offices.api.js';
