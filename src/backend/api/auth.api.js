/**
 * DOLE Iligan Portal — Authentication API
 * Handles all login/logout operations against the users table.
 *
 * Login Modes (matching auth.js UI):
 *  1. Username + Password
 *  2. Email    + Password
 *  3. Phone    + PIN (4-digit)
 */

import { supabase } from './supabase.js';

/**
 * Login with Username and Password.
 * @param {string} username
 * @param {string} password
 * @returns {{ data: object|null, error: string|null }}
 */
export async function loginWithUsername(username, password) {
    if (window.DEBUG) window.DEBUG.log('AUTH-API', `Login attempt: username="${username}"`);

    const { data, error } = await supabase
        .from('users')
        .select('id, role_id, office_id, full_name, username, email, phone, status, archived_at')
        .eq('username', username)
        .eq('password', password)   // ⚠️ Replace with bcrypt compare when hashing is implemented
        .is('archived_at', null)    // Only active (non-archived) users
        .single();

    if (error || !data) {
        if (window.DEBUG) window.DEBUG.error('AUTH-API', 'Username login failed', error?.message);
        return { data: null, error: 'Invalid username or password.' };
    }

    await _setOnlineStatus(data.id);
    if (window.DEBUG) window.DEBUG.success('AUTH-API', `Logged in: ${data.username}`);
    return { data, error: null };
}

/**
 * Login with Email and Password.
 * @param {string} email
 * @param {string} password
 * @returns {{ data: object|null, error: string|null }}
 */
export async function loginWithEmail(email, password) {
    if (window.DEBUG) window.DEBUG.log('AUTH-API', `Login attempt: email="${email}"`);

    const { data, error } = await supabase
        .from('users')
        .select('id, role_id, office_id, full_name, username, email, phone, status, archived_at')
        .eq('email', email)
        .eq('password', password)
        .is('archived_at', null)
        .single();

    if (error || !data) {
        if (window.DEBUG) window.DEBUG.error('AUTH-API', 'Email login failed', error?.message);
        return { data: null, error: 'Invalid email or password.' };
    }

    await _setOnlineStatus(data.id);
    return { data, error: null };
}

/**
 * Login with Phone Number and 4-digit PIN.
 * @param {string} phone  — PH format: starts with 9, 10 digits
 * @param {string} pin    — 4-digit PIN
 * @returns {{ data: object|null, error: string|null }}
 */
export async function loginWithPhone(phone, pin) {
    if (window.DEBUG) window.DEBUG.log('AUTH-API', `Login attempt: phone="+63${phone}"`);

    // Normalize phone to +63XXXXXXXXXX format
    const normalizedPhone = phone.startsWith('+63') ? phone : `+63${phone}`;

    const { data, error } = await supabase
        .from('users')
        .select('id, role_id, office_id, full_name, username, email, phone, status, archived_at')
        .eq('phone', normalizedPhone)
        .eq('pin', pin)             // ⚠️ Replace with bcrypt compare when hashing is implemented
        .is('archived_at', null)
        .single();

    if (error || !data) {
        if (window.DEBUG) window.DEBUG.error('AUTH-API', 'Phone+PIN login failed', error?.message);
        return { data: null, error: 'Invalid phone number or PIN.' };
    }

    await _setOnlineStatus(data.id);
    return { data, error: null };
}

/**
 * Get the current session user from localStorage.
 * @returns {object|null}
 */
export function getCurrentUser() {
    const raw = localStorage.getItem('dole_session');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Save the user session to localStorage after successful login.
 * @param {object} user
 */
export function saveSession(user) {
    localStorage.setItem('dole_session', JSON.stringify({
        id:        user.id,
        role_id:   user.role_id,
        office_id: user.office_id,
        full_name: user.full_name,
        username:  user.username,
        email:     user.email,
        phone:     user.phone,
        status:    'online',
        loggedInAt: new Date().toISOString()
    }));
    if (window.DEBUG) window.DEBUG.success('AUTH-API', 'Session saved to localStorage.');
}

/**
 * Clear the session on logout and set user status to offline.
 */
export async function logout() {
    const user = getCurrentUser();
    if (user?.id) {
        await supabase
            .from('users')
            .update({ status: 'offline', last_seen: new Date().toISOString() })
            .eq('id', user.id);
    }
    localStorage.removeItem('dole_session');
    if (window.DEBUG) window.DEBUG.log('AUTH-API', 'Session cleared. User logged out.');
}

// ─── Internal Helper ───────────────────────────────────────────────────────────

async function _setOnlineStatus(userId) {
    await supabase
        .from('users')
        .update({ status: 'online', last_seen: new Date().toISOString() })
        .eq('id', userId);
}
