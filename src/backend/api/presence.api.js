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

/* START SEND STATUS UPDATE - Sends status and uptime delta to server via fetch or sendBeacon */
export const sendStatusUpdate = async (status = 'online', isBeacon = false, uptimeDelta = 0) => {
    try {
        const payload = JSON.stringify({ status, uptime_delta: uptimeDelta });
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
/* END SEND STATUS UPDATE */

/* START FORMAT TOTAL UPTIME - Formats total seconds into smart compact uptime strings */
export const formatTotalUptime = (totalSeconds = 0) => {
    const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    if (sec < 60) {
        return `${sec}s`;
    }
    if (sec < 3600) {
        const mins = Math.floor(sec / 60);
        const remSec = sec % 60;
        return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
    }
    const hours = (sec / 3600).toFixed(1);
    const cleanHours = hours.endsWith('.0') ? hours.slice(0, -2) : hours;
    return `${cleanHours} hrs`;
};
/* END FORMAT TOTAL UPTIME */

let uptimeInterval = null;
let unsyncedUptimeSeconds = 0;
let currentUptimeTotalSeconds = 0;
let lastRenderedUptimeFormatted = '';

/* START USER UPTIME TRACKER CONTROLLER - Ultra-lightweight in-memory counter with 60s batched DB sync */
export const startUserUptimeTracker = (user, onTick) => {
    if (!user || !user.id) return () => {};

    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
    }

    currentUptimeTotalSeconds = Number(user.total_uptime || 0);
    unsyncedUptimeSeconds = 0;
    lastRenderedUptimeFormatted = formatTotalUptime(currentUptimeTotalSeconds);

    // Initial immediate render
    if (typeof onTick === 'function') {
        onTick({
            totalSeconds: currentUptimeTotalSeconds,
            formatted: lastRenderedUptimeFormatted
        });
    }

    const flushUptimeSync = async (isBeacon = false) => {
        if (unsyncedUptimeSeconds <= 0) return;
        const delta = unsyncedUptimeSeconds;
        unsyncedUptimeSeconds = 0;
        await sendStatusUpdate('online', isBeacon, delta);
    };

    let syncCounter = 0;

    // 1-second in-memory clock (consumes 0.0001% CPU, 0 database queries)
    uptimeInterval = setInterval(() => {
        // Automatically sleep and consume 0 resources if tab is backgrounded/hidden
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return;
        }

        currentUptimeTotalSeconds += 1;
        unsyncedUptimeSeconds += 1;
        syncCounter += 1;

        const newFormatted = formatTotalUptime(currentUptimeTotalSeconds);

        // Only invoke DOM update if text representation actually changed (saves UI repaints on low-end laptops)
        if (newFormatted !== lastRenderedUptimeFormatted || currentUptimeTotalSeconds < 60) {
            lastRenderedUptimeFormatted = newFormatted;
            if (typeof onTick === 'function') {
                onTick({
                    totalSeconds: currentUptimeTotalSeconds,
                    formatted: newFormatted
                });
            }
        }

        // Lightweight batched database sync every 60 seconds (only 1 request/min)
        if (syncCounter >= 60) {
            syncCounter = 0;
            void flushUptimeSync(false);
        }
    }, 1000);

    const handleUnloadSync = () => {
        if (unsyncedUptimeSeconds > 0) {
            void flushUptimeSync(true);
        }
    };

    window.addEventListener('beforeunload', handleUnloadSync);
    window.addEventListener('pagehide', handleUnloadSync);

    return () => {
        if (uptimeInterval) {
            clearInterval(uptimeInterval);
            uptimeInterval = null;
        }
        window.removeEventListener('beforeunload', handleUnloadSync);
        window.removeEventListener('pagehide', handleUnloadSync);
        void flushUptimeSync(false);
    };
};
/* END USER UPTIME TRACKER CONTROLLER */

/* START HANDLE WINDOW UNLOAD - Unloads presence and syncs final offline state and remaining uptime */
const handleWindowUnload = () => {
    if (!currentPresenceUser) return;
    try {
        if (presenceChannel) {
            void presenceChannel.untrack();
        }
        const delta = unsyncedUptimeSeconds;
        unsyncedUptimeSeconds = 0;
        sendStatusUpdate('offline', true, delta);
    } catch {}
};
/* END HANDLE WINDOW UNLOAD */

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
