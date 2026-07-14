/**
 * DOLE Iligan Portal - Authentication API
 * Handles login/logout operations against the users table.
 */

import { supabase } from './supabase.js';

const PUBLIC_USER_SELECT = 'id, role_id, office_id, full_name, username, email, phone, status, archived_at';
const AUTH_CONFIG_ERROR = 'Authentication is not available right now. Please check Supabase environment variables and database access policies.';
const HASH_PREFIX = 'sha256:v1:';
const HASH_NAMESPACE = 'dole-portal-auth';

/* START IS HASHED CREDENTIAL - Detects credentials already stored in portal hash format */
export function isHashedCredential(value) {
    return String(value || '').startsWith(HASH_PREFIX);
}
/* END IS HASHED CREDENTIAL */

/* START HASH CREDENTIAL - Creates the stored credential digest for password and PIN values */
export async function hashCredential(value) {
    const normalizedValue = String(value || '');
    const payload = `${HASH_NAMESPACE}:${normalizedValue}`;
    const bytes = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    return `${HASH_PREFIX}${hash}`;
}
/* END HASH CREDENTIAL */

/* START FIND USER BY IDENTITY - Fetches the user row for a login identifier */
async function findUserByIdentity(field, value) {
    return supabase
        .from('users')
        .select(`${PUBLIC_USER_SELECT}, password, pin`)
        .eq(field, value)
        .is('archived_at', null)
        .maybeSingle();
}
/* END FIND USER BY IDENTITY */

/* START VERIFY CREDENTIAL - Accepts hashed credentials and upgrades matching legacy plaintext */
async function verifyCredential(user, credentialField, rawCredential) {
    const storedCredential = user?.[credentialField] || '';
    const submittedCredential = String(rawCredential || '');

    if (isHashedCredential(submittedCredential)) {
        return storedCredential === submittedCredential;
    }

    const hashedCredential = await hashCredential(submittedCredential);

    if (storedCredential === hashedCredential) return true;

    if (storedCredential && storedCredential === submittedCredential) {
        const { error } = await supabase
            .from('users')
            .update({ [credentialField]: hashedCredential, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        if (error) {
            if (window.DEBUG) window.DEBUG.error('AUTH-API', `Failed to hash ${credentialField}`, error.message);
            return false;
        }
        user[credentialField] = hashedCredential;
        return true;
    }

    return false;
}
/* END VERIFY CREDENTIAL */

/* START UPGRADE LEGACY CREDENTIALS - Converts any remaining plaintext password/PIN after login */
async function upgradeLegacyCredentials(user) {
    const updates = {};

    for (const field of ['password', 'pin']) {
        const storedCredential = user?.[field];
        if (storedCredential && !storedCredential.startsWith(HASH_PREFIX)) {
            updates[field] = await hashCredential(storedCredential);
        }
    }

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

    if (error && window.DEBUG) {
        window.DEBUG.error('AUTH-API', 'Failed to upgrade legacy credentials', error.message);
    }
}
/* END UPGRADE LEGACY CREDENTIALS */

/* START SANITIZE USER - Removes credential columns before returning session data */
function sanitizeUser(user) {
    if (!user) return null;
    const { password, pin, ...safeUser } = user;
    return safeUser;
}
/* END SANITIZE USER */


/* START DETECT AUTH VISIBILITY ISSUE - Checks whether anon can see required auth lookup data */
async function detectAuthVisibilityIssue() {
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .limit(1);

    return Boolean(error || !data || data.length === 0);
}
/* END DETECT AUTH VISIBILITY ISSUE */
/* START HANDLE IDENTITY LOOKUP - Converts Supabase lookup result into auth-friendly errors */
async function handleIdentityLookup({ data, error }, notFoundMessage, debugLabel) {
    if (error) {
        if (window.DEBUG) window.DEBUG.error('AUTH-API', debugLabel, error.message);
        return { data: null, error: AUTH_CONFIG_ERROR, code: 'auth_query_failed', field: 'credential' };
    }

    if (!data) {
        if (await detectAuthVisibilityIssue()) {
            return { data: null, error: AUTH_CONFIG_ERROR, code: 'auth_visibility_failed', field: 'credential' };
        }
        return { data: null, error: notFoundMessage, code: 'identity_not_found', field: 'identity' };
    }

    return { data, error: null };
}
/* END HANDLE IDENTITY LOOKUP */

/* START FINISH LOGIN - Upgrades credentials, marks user online, and returns safe session data */
async function finishLogin(user) {
    await upgradeLegacyCredentials(user);
    await _setOnlineStatus(user.id);
    return { data: sanitizeUser(user), error: null };
}
/* END FINISH LOGIN */

/**
 * Login with Username and Password.
 * @param {string} username
 * @param {string} password
 * @returns {{ data: object|null, error: string|null, code?: string, field?: string }}
 */
export async function loginWithUsername(username, password) {
    if (window.DEBUG) window.DEBUG.log('AUTH-API', `Login attempt: username="${username}"`);

    const lookup = await handleIdentityLookup(
        await findUserByIdentity('username', username),
        'Username was not found.',
        'Username lookup failed'
    );
    if (lookup.error) return lookup;

    if (!(await verifyCredential(lookup.data, 'password', password))) {
        return { data: null, error: 'Incorrect password.', code: 'credential_invalid', field: 'credential' };
    }

    if (window.DEBUG) window.DEBUG.success('AUTH-API', `Logged in: ${lookup.data.username}`);
    return finishLogin(lookup.data);
}

/**
 * Login with Email and Password.
 * @param {string} email
 * @param {string} password
 * @returns {{ data: object|null, error: string|null, code?: string, field?: string }}
 */
export async function loginWithEmail(email, password) {
    if (window.DEBUG) window.DEBUG.log('AUTH-API', `Login attempt: email="${email}"`);

    const lookup = await handleIdentityLookup(
        await findUserByIdentity('email', email),
        'Email address was not found.',
        'Email lookup failed'
    );
    if (lookup.error) return lookup;

    if (!(await verifyCredential(lookup.data, 'password', password))) {
        return { data: null, error: 'Incorrect password.', code: 'credential_invalid', field: 'credential' };
    }

    return finishLogin(lookup.data);
}

/**
 * Login with Phone Number and 4-digit PIN.
 * @param {string} phone - PH format: starts with 9, 10 digits
 * @param {string} pin - 4-digit PIN
 * @returns {{ data: object|null, error: string|null, code?: string, field?: string }}
 */
export async function loginWithPhone(phone, pin) {
    if (window.DEBUG) window.DEBUG.log('AUTH-API', `Login attempt: phone="+63${phone}"`);

    const normalizedPhone = phone.startsWith('+63') ? phone : `+63${phone}`;
    const lookup = await handleIdentityLookup(
        await findUserByIdentity('phone', normalizedPhone),
        'Phone number was not found.',
        'Phone lookup failed'
    );
    if (lookup.error) return lookup;

    if (!(await verifyCredential(lookup.data, 'pin', pin))) {
        return { data: null, error: 'Incorrect PIN.', code: 'credential_invalid', field: 'credential' };
    }

    return finishLogin(lookup.data);
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
        id: user.id,
        role_id: user.role_id,
        office_id: user.office_id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        status: 'online',
        loggedInAt: new Date().toISOString()
    }));
    if (window.DEBUG) window.DEBUG.success('AUTH-API', 'Session saved to localStorage.');
}

/**
 * Clear the session on logout and set user status to offline.
 */
export async function logout() {
    const user = getCurrentUser();
    let statusError = null;

    if (user?.id) {
        const { error } = await supabase
            .from('users')
            .update({ status: 'offline', last_seen: new Date().toISOString() })
            .eq('id', user.id);
        statusError = error;
    }

    localStorage.removeItem('dole_session');
    if (statusError && window.DEBUG) {
        window.DEBUG.error('AUTH-API', 'Failed to set user offline during logout', statusError.message);
    }
    if (window.DEBUG) window.DEBUG.log('AUTH-API', 'Session cleared. User logged out.');
    return { error: statusError?.message || null };
}

async function _setOnlineStatus(userId) {
    await supabase
        .from('users')
        .update({ status: 'online', last_seen: new Date().toISOString() })
        .eq('id', userId);
}