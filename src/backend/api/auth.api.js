/**
 * DOLE Iligan Portal - Authentication API
 * Handles login/logout operations against the users table.
 */

import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase.js';
import { createNotification } from './notifications.api.js';

const PUBLIC_USER_SELECT_BASE = 'id, role_id, office_id, full_name, birthday, username, email, phone, avatar_url, status, archived_at';
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

const SPES_SUPABASE_URL = import.meta.env.VITE_SPES_SUPABASE_URL || 'https://pprmqnrevuyllhkxejbu.supabase.co';
const SPES_SUPABASE_ANON_KEY = import.meta.env.VITE_SPES_SUPABASE_ANON_KEY || 'sb_publishable_0sCQGxGm-VH-wDE6jN1CsA_UtJ3vvP3';

let spesClientInstance = null;
export const getSpesClient = () => {
    if (!spesClientInstance && SPES_SUPABASE_URL && SPES_SUPABASE_ANON_KEY) {
        spesClientInstance = createClient(SPES_SUPABASE_URL, SPES_SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }
    return spesClientInstance;
};

/* START FIND EXISTING SPES STAFF FIELD - Checks duplicate identities in SPES system */
async function findExistingSpesStaffField(field, value) {
    if (!value) return null;
    const client = getSpesClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('staffs')
            .select('id')
            .eq(field, value)
            .is('archive_at', null)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.warn('[AUTH-API] SPES duplicate check error:', error.message);
            return null;
        }

        return data ? { exists: true } : null;
    } catch {
        return null;
    }
}
/* END FIND EXISTING SPES STAFF FIELD */

/* START SYNC USER TO SPES - Copies registered user to SPES staffs table */
export async function syncUserToSpes(payload) {
    const client = getSpesClient();
    if (!client) {
        return { data: null, error: 'SPES client is not configured.' };
    }

    const spesStaffPayload = {
        full_name: String(payload.full_name || '').trim(),
        office_id: payload.office_id ? Number(payload.office_id) : null,
        role_id: Number(payload.role_id || 3), // Role 3 = Officer / Staff in SPES
        username: String(payload.username || '').trim(),
        email: String(payload.email || '').trim(),
        phone: String(payload.phone || '').trim() || null,
        password: String(payload.password || ''), // SPES database trigger auto-hashes to $2a$06$ bcrypt
        status: 'OFFLINE',
        approved: false // Requires approval by SPES admin in SPES system
    };

    try {
        const { data, error } = await client
            .from('staffs')
            .insert([spesStaffPayload])
            .select('id, full_name, username, email, office_id, role_id, status, approved')
            .single();

        if (error) {
            if (window.DEBUG) window.DEBUG.error('AUTH-API', 'SPES sync failed', error.message);
            console.error('[AUTH-API] SPES sync error:', error.message);
            return { data: null, error: error.message };
        }

        if (window.DEBUG) window.DEBUG.success('AUTH-API', `Synced user ${data.username} to SPES staffs (ID: ${data.id})`);
        return { data, error: null };
    } catch (err) {
        console.error('[AUTH-API] Exception during SPES sync:', err);
        return { data: null, error: err.message };
    }
}
/* END SYNC USER TO SPES */

/* START REGISTER PENDING USER - Creates a new public registration awaiting approval and syncs to SPES */
export async function registerPendingUser(payload) {
    const rawPlainPassword = String(payload.password || '');
    const safePayload = {
        full_name: String(payload.full_name || '').trim(),
        office_id: payload.office_id ? Number(payload.office_id) : null,
        role_id: Number(payload.role_id || 3),
        username: String(payload.username || '').trim(),
        email: String(payload.email || '').trim(),
        phone: String(payload.phone || '').trim() || null,
        password: await hashCredential(rawPlainPassword),
        status: 'offline',
        approval_status: APPROVAL_PENDING
    };

    // 1. Check duplicate username in Portal
    const usernameExists = await findExistingRegistrationField('username', safePayload.username);
    if (usernameExists?.error) return { data: null, error: usernameExists.error, code: 'register_unavailable' };
    if (usernameExists?.exists) return { data: null, error: 'That username is already in use in the Portal.', code: 'username_taken', field: 'username' };

    // Check duplicate username in SPES
    const spesUsernameExists = await findExistingSpesStaffField('username', safePayload.username);
    if (spesUsernameExists?.exists) return { data: null, error: 'That username is already in use in the SPES system.', code: 'spes_username_taken', field: 'username' };

    // 2. Check duplicate email in Portal
    const emailExists = await findExistingRegistrationField('email', safePayload.email);
    if (emailExists?.error) return { data: null, error: emailExists.error, code: 'register_unavailable' };
    if (emailExists?.exists) return { data: null, error: 'That email address is already registered in the Portal.', code: 'email_taken', field: 'email' };

    // Check duplicate email in SPES
    const spesEmailExists = await findExistingSpesStaffField('email', safePayload.email);
    if (spesEmailExists?.exists) return { data: null, error: 'That email address is already registered in the SPES system.', code: 'spes_email_taken', field: 'email' };

    // 3. Check duplicate phone in Portal
    if (safePayload.phone) {
        const phoneExists = await findExistingRegistrationField('phone', safePayload.phone);
        if (phoneExists?.error) return { data: null, error: phoneExists.error, code: 'register_unavailable' };
        if (phoneExists?.exists) return { data: null, error: 'That phone number is already registered.', code: 'phone_taken', field: 'phone' };
    }

    // 4. Insert into Portal users table
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

    // 5. Throw copy to SPES staffs table with identical password & pending approval
    const spesSync = await syncUserToSpes({
        full_name: safePayload.full_name,
        office_id: safePayload.office_id,
        role_id: safePayload.role_id,
        username: safePayload.username,
        email: safePayload.email,
        phone: safePayload.phone,
        password: rawPlainPassword
    });

    await createNotification({
        type: 'registration_pending',
        title: 'New user registration',
        message: `${data.full_name || data.username || 'A new user'} registered (synced with SPES) and is waiting for approval.`,
        recipientRoles: ['admin', 'hr'],
        subjectUserId: data.id,
        actionUrl: '/src/pages/user/admin/staffs/'
    });

    const sanitized = sanitizeUser(data);
    if (sanitized) {
        sanitized.spes_synced = Boolean(!spesSync.error);
        sanitized.spes_staff_id = spesSync.data?.id || null;
    }

    return { data: sanitized, error: null, spesSyncError: spesSync.error };
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
        const responseData = Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
        return { data: responseData ?? null, error: null };
    } catch {
        return { data: null, error: 'Unable to reach the Portal authentication service.', code: 'auth_backend_unavailable', field: 'credential' };
    }
};

const loginWithPortalBackend = async (mode, identity, credential, remember = false) => {
    const result = await portalApiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mode, identity, credential, remember })
    });
    if (!result.error && result.data?.id) saveSession(result.data);
    return result;
};

export const loginWithUsername = (username, password, remember = false) => loginWithPortalBackend('username', username, password, remember);
export const loginWithEmail = (email, password, remember = false) => loginWithPortalBackend('email', email, password, remember);
export const loginWithPhone = (phone, pin, remember = false) => loginWithPortalBackend('phone', phone, pin, remember);

export const getCachedCurrentUser = () => (currentUserCache?.id ? currentUserCache : null);

/**
 * Detects if a user is currently logged in across all storage and backend API layers.
 * 1. Checks memory cache
 * 2. Queries /api/auth/me serverless endpoint
 * 3. Clears local display state when the server session is unavailable
 * Ensures user session state is updated globally on window.__PORTAL_SESSION and authStorage.
 */
export async function detectActiveUserSession({ force = false } = {}) {
    if (!force && currentUserCache && currentUserCache.id) {
        window.__PORTAL_SESSION = currentUserCache;
        return currentUserCache;
    }

    const result = await portalApiRequest('/api/auth/me');
    const user = (result.error || !result.data || !result.data.id) ? null : result.data;
    // START SERVER-AUTH-ONLY SESSION
    // The browser cache is display state only; it must never recreate a revoked or idle session.
    saveSession(user);
    // END SERVER-AUTH-ONLY SESSION
    return user;
}

export async function refreshPortalSession() {
    const result = await portalApiRequest('/api/auth/me');
    const user = (result.error || !result.data || !result.data.id) ? null : result.data;
    saveSession(user);
    return user;
}
export async function getCurrentUser(options = {}) {
    return detectActiveUserSession(options);
}

import { authStorage } from '../../scripts/modules/storage.js';
import { resetAnnouncementDismissal } from '../../scripts/modules/announcement-banner.js';
import { initPresence, untrackPresence } from './presence.api.js';

export function saveSession(user) {
    currentUserCache = (user && user.id) ? user : null;
    if (currentUserCache) {
        window.__PORTAL_SESSION = currentUserCache;
        authStorage.setUserSession(currentUserCache);
        void initPresence(currentUserCache);
    } else {
        delete window.__PORTAL_SESSION;
        authStorage.clearUserSession();
        void untrackPresence();
    }
    try {
        window.dispatchEvent(new CustomEvent('portal:auth-changed', { detail: currentUserCache }));
    } catch {}
}

export async function logout() {
    await untrackPresence();
    const result = await portalApiRequest('/api/auth/logout', { method: 'POST' });
    saveSession(null);
    resetAnnouncementDismissal();
    return { error: result.error };
}

/* START FORGOT PASSWORD API HELPERS */
export const requestForgotPasswordOtp = async (phone) => {
    const result = await portalApiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_otp', phone })
    });
    if (result.error) return { error: result.error };
    const payload = result.data || {};
    return { ...payload, error: null };
};

export const verifyForgotPasswordOtp = async (phone, otp, challenge) => {
    const result = await portalApiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify_otp', phone, otp, challenge })
    });
    if (result.error) return { error: result.error };
    const payload = result.data || {};
    return { ...payload, error: null };
};

export const resetPasswordWithToken = async (resetToken, newPassword) => {
    const result = await portalApiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ action: 'reset_password', resetToken, newPassword })
    });
    if (result.error) return { error: result.error };
    const payload = result.data || {};
    return { ...payload, error: null };
};
/* END FORGOT PASSWORD API HELPERS */
/* END BACKEND COOKIE AUTH CLIENT */