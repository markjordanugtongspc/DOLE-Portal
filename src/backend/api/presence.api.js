/**
 * DOLE Portal — Real-Time Supabase Presence & Activity Lifecycle Manager
 * Leverages Supabase Realtime Presence (https://supabase.com/docs/guides/realtime/presence)
 * Handles live online/offline tracking, 16-minute inactivity timeout, tab closing, and real-time sync.
 */

import { supabase } from './supabase.js';

const PRESENCE_CHANNEL_NAME = 'portal-presence';
const INACTIVITY_TIMEOUT_MS = 16 * 60 * 1000; // 16 minutes

let presenceChannel = null;
let currentPresenceUser = null;
let inactivityTimer = null;
let inactivityCallback = null;
let lastInteractionTimestamp = Date.now();
const syncSubscribers = new Set();

/**
 * Derives unique presence key for a user or GIP assistant.
 * @param {object} user
 * @returns {string} e.g. "user:1" or "gip:5"
 */
export const getPresenceKey = (user) => {
    if (!user || !user.id) return null;
    const isGip = Boolean(user.is_gip || user.gip_id);
    return `${isGip ? 'gip' : 'user'}:${user.id}`;
};

/**
 * Extracts Sets of online user and GIP IDs from Supabase Presence state.
 * @param {object} state - Presence state object
 * @returns {{ onlineUsers: Set<number>, onlineGips: Set<number>, presenceState: object }}
 */
export const parsePresenceState = (state = {}) => {
    const onlineUsers = new Set();
    const onlineGips = new Set();

    Object.entries(state).forEach(([key, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) {
            if (key.startsWith('gip:')) {
                const id = Number(key.replace('gip:', ''));
                if (!isNaN(id)) onlineGips.add(id);
            } else if (key.startsWith('user:')) {
                const id = Number(key.replace('user:', ''));
                if (!isNaN(id)) onlineUsers.add(id);
            }
        }
    });

    return { onlineUsers, onlineGips, presenceState: state };
};

const notifySubscribers = () => {
    if (!presenceChannel) return;
    const state = presenceChannel.presenceState();
    const parsed = parsePresenceState(state);
    syncSubscribers.forEach((cb) => {
        try {
            cb(parsed);
        } catch (err) {
            console.error('[PRESENCE] Subscriber callback error:', err);
        }
    });
};

/**
 * Sends a status update to the server (online/offline).
 * Uses fetch when page is active, fallback to sendBeacon when unloading.
 * @param {'online'|'offline'} status
 * @param {boolean} isBeacon
 */
export const sendStatusUpdate = async (status = 'online', isBeacon = false) => {
    try {
        const payload = JSON.stringify({ status });
        if (isBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon('/api/auth/me', blob);
            return;
        }
        await fetch('/api/auth/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });
    } catch (err) {
        if (window.DEBUG) window.DEBUG.warn('PRESENCE', 'Status update request failed:', err?.message || err);
    }
};

/**
 * Unload event handler to untrack presence and mark user offline.
 */
const handleWindowUnload = () => {
    if (!currentPresenceUser) return;
    try {
        if (presenceChannel) {
            void presenceChannel.untrack();
        }
        sendStatusUpdate('offline', true);
    } catch {}
};

/**
 * Initializes and tracks Supabase Presence for an authenticated user.
 * @param {object} user - Active session user object
 */
export const initPresence = async (user) => {
    if (!user || !user.id) return null;

    const presenceKey = getPresenceKey(user);
    if (!presenceKey) return null;

    currentPresenceUser = user;

    // If channel already exists for this user, ensure tracking is active
    if (!presenceChannel) {
        presenceChannel = supabase.channel(PRESENCE_CHANNEL_NAME, {
            config: {
                presence: {
                    key: presenceKey
                }
            }
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                if (window.DEBUG) window.DEBUG.flow('PRESENCE', 'Presence sync updated', presenceChannel.presenceState());
                notifySubscribers();
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                if (window.DEBUG) window.DEBUG.flow('PRESENCE', `User joined presence: ${key}`, newPresences);
                notifySubscribers();
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                if (window.DEBUG) window.DEBUG.flow('PRESENCE', `User left presence: ${key}`, leftPresences);
                notifySubscribers();
            });

        presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                try {
                    await presenceChannel.track({
                        user_id: user.id,
                        is_gip: Boolean(user.is_gip || user.gip_id),
                        full_name: user.full_name || user.username,
                        role_id: user.role_id,
                        online_at: new Date().toISOString()
                    });
                    if (window.DEBUG) window.DEBUG.success('PRESENCE', `Presence tracked for ${presenceKey}`);
                    await sendStatusUpdate('online', false);
                } catch (err) {
                    console.error('[PRESENCE] Failed to track presence:', err);
                }
            }
        });

        // Register unload listeners for tab close and navigation away
        window.removeEventListener('beforeunload', handleWindowUnload);
        window.removeEventListener('pagehide', handleWindowUnload);
        window.addEventListener('beforeunload', handleWindowUnload);
        window.addEventListener('pagehide', handleWindowUnload);
    } else {
        // Channel already connected, update presence tracking
        try {
            await presenceChannel.track({
                user_id: user.id,
                is_gip: Boolean(user.is_gip || user.gip_id),
                full_name: user.full_name || user.username,
                role_id: user.role_id,
                online_at: new Date().toISOString()
            });
            await sendStatusUpdate('online', false);
        } catch {}
    }

    return presenceChannel;
};

/**
 * Untracks the user from Supabase Presence and sets database status to offline.
 */
export const untrackPresence = async () => {
    try {
        if (presenceChannel) {
            await presenceChannel.untrack();
        }
    } catch (err) {
        if (window.DEBUG) window.DEBUG.warn('PRESENCE', 'Failed to untrack presence channel:', err);
    }

    await sendStatusUpdate('offline', false);
    currentPresenceUser = null;
    notifySubscribers();
};

/**
 * Subscribes a callback to live presence state changes.
 * @param {Function} callback - ({ onlineUsers, onlineGips, presenceState }) => void
 * @returns {Function} unsubscribe function
 */
export const subscribeToPresenceSync = (callback) => {
    if (typeof callback !== 'function') return () => {};
    syncSubscribers.add(callback);

    // If presence is already active, provide immediate current state
    if (presenceChannel) {
        try {
            const state = presenceChannel.presenceState();
            callback(parsePresenceState(state));
        } catch {}
    }

    return () => {
        syncSubscribers.delete(callback);
    };
};

/**
 * Returns current snapshot of online presence.
 */
export const getOnlinePresenceSnapshot = () => {
    if (!presenceChannel) return { onlineUsers: new Set(), onlineGips: new Set(), presenceState: {} };
    return parsePresenceState(presenceChannel.presenceState());
};

/**
 * 16-Minute User Inactivity Monitor.
 * Automatically untracks presence, marks user offline, and invokes timeout callback.
 * @param {Function} onTimeout - Action to perform on timeout (e.g. show notice, logout, redirect)
 * @param {number} timeoutMs - Inactivity timeout in ms (defaults to 16 minutes = 960,000ms)
 */
export const startInactivityMonitor = (onTimeout, timeoutMs = INACTIVITY_TIMEOUT_MS) => {
    inactivityCallback = onTimeout;

    const resetInactivity = () => {
        lastInteractionTimestamp = Date.now();
        if (inactivityTimer) clearTimeout(inactivityTimer);

        inactivityTimer = setTimeout(async () => {
            if (window.DEBUG) window.DEBUG.warn('PRESENCE', `16 minutes inactivity reached. Setting status OFFLINE and logging out...`);
            await untrackPresence();
            if (typeof inactivityCallback === 'function') {
                inactivityCallback();
            }
        }, timeoutMs);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((evt) => {
        window.addEventListener(evt, resetInactivity, { passive: true });
    });

    resetInactivity();

    return () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        activityEvents.forEach((evt) => {
            window.removeEventListener(evt, resetInactivity);
        });
    };
};
