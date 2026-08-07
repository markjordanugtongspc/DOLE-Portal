/**
 * DOLE Iligan Portal - Authentication API
 * Handles login/logout operations against the users table.
 */

import { supabase } from './supabase.js';
import { createNotification } from './notifications.api.js';

const PUBLIC_USER_SELECT_BASE = 'id, role_id, office_id, full_name, username, email, phone, status, archived_at';
const PUBLIC_USER_SELECT = `${PUBLIC_USER_SELECT_BASE}, approval_status`;
const AUTH_CONFIG_ERROR = 'Authentication is not available right now. Please check Supabase environment variables and database access policies.';
const HASH_PREFIX = 'sha256:v1:';
const HASH_NAMESPACE = 'dole-portal-auth';
const APPROVAL_PENDING = 'PENDING';
const APPROVAL_APPROVED = 'APPROVED';
const APPROVAL_DECLINED = 'DECLINED';

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




/* START SANITIZE USER - Removes credential columns before returning session data */
function sanitizeUser(user) {
    if (!user) return null;
    const { password, pin, ...safeUser } = user;
    return safeUser;
}
/* END SANITIZE USER */






/* START FIND EXISTING REGISTRATION FIELD - Checks duplicate identities before public registration */
async function findExistingRegistrationField(field, value) {
    if (!value) return null;

    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq(field, value)
        .is('archived_at', null)
        .limit(1)
        .maybeSingle();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('AUTH-API', `Duplicate ${field} check failed`, error.message);
        return { error: AUTH_CONFIG_ERROR };
    }

    return data ? { exists: true } : null;
}
/* END FIND EXISTING REGISTRATION FIELD */

/* START REGISTER PENDING USER - Creates a new public registration awaiting approval */
export async function registerPendingUser(payload) {
    const safePayload = {
        full_name: String(payload.full_name || '').trim(),
        office_id: payload.office_id ? Number(payload.office_id) : null,
        role_id: Number(payload.role_id || 3),
        username: String(payload.username || '').trim(),
        email: String(payload.email || '').trim(),
        phone: String(payload.phone || '').trim() || null,
        password: await hashCredential(payload.password || ''),
        status: 'offline',
        approval_status: APPROVAL_PENDING
    };

    const usernameExists = await findExistingRegistrationField('username', safePayload.username);
    if (usernameExists?.error) return { data: null, error: usernameExists.error, code: 'register_unavailable' };
    if (usernameExists?.exists) return { data: null, error: 'That username is already in use.', code: 'username_taken', field: 'username' };

    const emailExists = await findExistingRegistrationField('email', safePayload.email);
    if (emailExists?.error) return { data: null, error: emailExists.error, code: 'register_unavailable' };
    if (emailExists?.exists) return { data: null, error: 'That email address is already registered.', code: 'email_taken', field: 'email' };

    if (safePayload.phone) {
        const phoneExists = await findExistingRegistrationField('phone', safePayload.phone);
        if (phoneExists?.error) return { data: null, error: phoneExists.error, code: 'register_unavailable' };
        if (phoneExists?.exists) return { data: null, error: 'That phone number is already registered.', code: 'phone_taken', field: 'phone' };
    }

    const { data, error } = await supabase
        .from('users')
        .insert([safePayload])
        .select(`${PUBLIC_USER_SELECT}`)
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('AUTH-API', 'Register pending user failed', error.message);
        if (/approval_status/i.test(error.message || '') && /column/i.test(error.message || '')) {
            return {
                data: null,
                error: 'Approval status is not configured yet. Please run the supplied Supabase SQL first.',
                code: 'approval_column_missing'
            };
        }
        return { data: null, error: error.message, code: 'register_failed' };
    }

    await createNotification({
        type: 'registration_pending',
        title: 'New user registration',
        message: `${data.full_name || data.username || 'A new user'} registered and is waiting for approval.`,
        recipientRoles: ['admin', 'hr'],
        subjectUserId: data.id,
        actionUrl: '/src/pages/user/admin/staffs/'
    });
    return { data: sanitizeUser(data), error: null };
}
/* END REGISTER PENDING USER */

/* START BACKEND COOKIE AUTH CLIENT */
// Clear the legacy browser session on the login page too.
try { localStorage.removeItem('dole_session'); } catch {}
let currentUserCache = window.__PORTAL_SESSION || null;

const portalApiRequest = async (url, options = {}) => {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { data: null, error: payload.error || 'The Portal authentication request failed.', code: payload.code, field: payload.field };
        return { data: payload.data ?? payload, error: null };
    } catch {
        return { data: null, error: 'Unable to reach the Portal authentication service.', code: 'auth_backend_unavailable', field: 'credential' };
    }
};

const loginWithPortalBackend = async (mode, identity, credential, remember = false) => {
    const result = await portalApiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mode, identity, credential, remember })
    });
    if (!result.error) saveSession(result.data);
    return result;
};

export const loginWithUsername = (username, password, remember = false) => loginWithPortalBackend('username', username, password, remember);
export const loginWithEmail = (email, password, remember = false) => loginWithPortalBackend('email', email, password, remember);
export const loginWithPhone = (phone, pin, remember = false) => loginWithPortalBackend('phone', phone, pin, remember);

export const getCachedCurrentUser = () => currentUserCache;

/**
 * Detects if a user is currently logged in across all storage and backend API layers.
 * 1. Checks memory cache
 * 2. Queries /api/auth/me serverless endpoint
 * 3. Fallbacks to verifying stored user against Supabase database directly
 * 4. Fallbacks to browser storage (sessionStorage/localStorage)
 * Ensures user session state is updated globally on window.__PORTAL_SESSION and authStorage.
 */
export async function detectActiveUserSession({ force = false } = {}) {
    if (!force && currentUserCache) {
        window.__PORTAL_SESSION = currentUserCache;
        return currentUserCache;
    }

    let user = null;

    // 1. Try serverless backend session check (/api/auth/me)
    try {
        const result = await portalApiRequest('/api/auth/me');
        if (!result.error && result.data) {
            user = result.data;
        }
    } catch (err) {
        if (window.DEBUG) window.DEBUG.warn('AUTH-API', 'Serverless session fetch error', err);
    }

    // 2. Retrieve local/session browser storage
    const storedUser = authStorage.getUserSession();

    // 3. If server check produced no user, query Supabase database directly for stored user ID
    if (!user && storedUser?.id) {
        try {
            const { data: dbUser, error: dbError } = await supabase
                .from('users')
                .select('id, role_id, office_id, full_name, username, email, phone, approval_status, status, archived_at')
                .eq('id', Number(storedUser.id))
                .maybeSingle();

            if (!dbError && dbUser && !dbUser.archived_at) {
                const approvalStatus = String(dbUser.approval_status || 'APPROVED').toUpperCase();
                if (approvalStatus === 'APPROVED') {
                    user = {
                        id: Number(dbUser.id),
                        role_id: Number(dbUser.role_id),
                        office_id: dbUser.office_id === null ? null : Number(dbUser.office_id),
                        full_name: dbUser.full_name,
                        username: dbUser.username,
                        email: dbUser.email,
                        phone: dbUser.phone,
                        approval_status: dbUser.approval_status || 'APPROVED',
                        status: dbUser.status || 'online'
                    };
                }
            }
        } catch (err) {
            if (window.DEBUG) window.DEBUG.error('AUTH-API', 'Supabase user session detection failed', err);
        }
    }

    // 4. Final fallback to cached browser storage user if approved
    if (!user && storedUser && String(storedUser.approval_status || 'APPROVED').toUpperCase() === 'APPROVED') {
        user = storedUser;
    }

    // Synchronize global window & storage state
    saveSession(user);
    return user;
}

export async function getCurrentUser(options = {}) {
    return detectActiveUserSession(options);
}

import { authStorage } from '../../scripts/modules/storage.js';

export function saveSession(user) {
    currentUserCache = user || null;
    if (currentUserCache) {
        window.__PORTAL_SESSION = currentUserCache;
        authStorage.setUserSession(currentUserCache);
    } else {
        delete window.__PORTAL_SESSION;
        authStorage.clearUserSession();
    }
}

export async function logout() {
    const result = await portalApiRequest('/api/auth/logout', { method: 'POST' });
    saveSession(null);
    return { error: result.error };
}
/* END BACKEND COOKIE AUTH CLIENT */