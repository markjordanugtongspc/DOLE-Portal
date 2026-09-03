/* START SERVER SESSION PAGE GUARD */
try { localStorage.removeItem('dole_session'); } catch {}
const userRouteMatch = window.location.pathname.match(/\/src\/pages\/user\/(admin|staff)\//);
const isToolsRoute = /\/src\/pages\/tools\//.test(window.location.pathname);
const isAboutRoute = /\/src\/pages\/about\//.test(window.location.pathname);
const routeMatch = isToolsRoute ? ['/src/pages/tools/', 'tools'] : userRouteMatch;

const redirectToLogin = () => window.location.replace('/?auth=login_required');
const dashboardFor = (roleId) => Number(roleId) === 1
    ? '/src/pages/user/admin/dashboard/'
    : '/src/pages/user/staff/dashboard/';

import { authStorage } from './modules/storage.js';

let cachedSessionUser = null;
try {
    const raw = authStorage.getUserSession();
    if (raw && raw.id && raw.role_id) {
        cachedSessionUser = raw;
    } else {
        authStorage.clearUserSession();
    }
} catch {}

if (isAboutRoute) {
    // Global page: always remove checking state and allow immediate view
    document.documentElement.classList.remove('portal-auth-checking');
    if (cachedSessionUser) {
        window.__PORTAL_SESSION = cachedSessionUser;
    }
} else if (routeMatch && cachedSessionUser) {
    window.__PORTAL_SESSION = cachedSessionUser;
    const roleId = Number(cachedSessionUser.role_id);
    const isGip = Boolean(cachedSessionUser.is_gip || cachedSessionUser.gip_id);
    const requiredRole = routeMatch[1];
    const isAlertsRoute = /\/src\/pages\/user\/admin\/alerts\//.test(window.location.pathname);
    const isAssistantsRoute = /\/src\/pages\/user\/staff\/assistants\//.test(window.location.pathname);
    const allowed = isToolsRoute
        ? true
        : isAssistantsRoute
        ? !isGip && (roleId === 2 || roleId === 3)
        : isAlertsRoute
        ? roleId === 1 || roleId === 2
        : requiredRole === 'admin' ? roleId === 1 : roleId === 2 || roleId === 3;
    if (allowed) {
        document.documentElement.classList.remove('portal-auth-checking');
    }
}

import { detectActiveUserSession, logout, refreshPortalSession } from '../backend/api/auth.api.js';
import { initPresence } from '../backend/api/presence.api.js';

/* START INACTIVITY SESSION TIMEOUT - 16 Minutes Inactivity Auto-Offline & Logout */
const INACTIVITY_LIMIT_MS = 16 * 60 * 1000; // 16 minutes
const SESSION_HEARTBEAT_MS = 4 * 60 * 1000; // 4 minutes
let inactivityTimer = null;
let heartbeatTimer = null;
let lastInteractionAt = Date.now();
let timeoutInProgress = false;

const startInactivityMonitor = () => {
    if (inactivityTimer || !routeMatch) return;

    const expireSession = async () => {
        if (timeoutInProgress) return;
        timeoutInProgress = true;
        window.clearInterval(heartbeatTimer);
        await logout();
        window.location.replace('/?auth=session_timeout');
    };

    const scheduleExpiry = () => {
        window.clearTimeout(inactivityTimer);
        const remaining = Math.max(0, INACTIVITY_LIMIT_MS - (Date.now() - lastInteractionAt));
        inactivityTimer = window.setTimeout(expireSession, remaining);
    };

    const recordInteraction = () => {
        lastInteractionAt = Date.now();
        scheduleExpiry();
    };

    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, recordInteraction, { passive: true });
    });

    heartbeatTimer = window.setInterval(async () => {
        if (Date.now() - lastInteractionAt >= INACTIVITY_LIMIT_MS) return expireSession();
        const user = await refreshPortalSession();
        if (!user) window.location.replace('/?auth=session_expired');
    }, SESSION_HEARTBEAT_MS);

    scheduleExpiry();
};
/* END INACTIVITY SESSION TIMEOUT */
const validateProtectedRoute = async () => {
    if (isAboutRoute) {
        // Global accessible page: detect user if logged in to populate sidebar/avatar, but never redirect away
        try {
            const user = await detectActiveUserSession();
            if (user) {
                window.__PORTAL_SESSION = user;
                void initPresence(user);
                startInactivityMonitor();
            }
        } catch {}
        document.documentElement.classList.remove('portal-auth-checking');
        return;
    }

    if (!routeMatch) return;
    if (!cachedSessionUser) {
        document.documentElement.classList.add('portal-auth-checking');
    }
    try {
        const user = await detectActiveUserSession({ force: true });
        if (!user) {
            authStorage.clearUserSession();
            return redirectToLogin();
        }

        const roleId = Number(user.role_id);
        const isGip = Boolean(user.is_gip || user.gip_id);
        const requiredRole = routeMatch[1];
        const isAlertsRoute = /\/src\/pages\/user\/admin\/alerts\//.test(window.location.pathname);
        const isAssistantsRoute = /\/src\/pages\/user\/staff\/assistants\//.test(window.location.pathname);
        const allowed = isToolsRoute
            ? true
            : isAssistantsRoute
            ? !isGip && (roleId === 2 || roleId === 3)
            : isAlertsRoute
            ? roleId === 1 || roleId === 2
            : requiredRole === 'admin' ? roleId === 1 : roleId === 2 || roleId === 3;

        if (!allowed) return window.location.replace(dashboardFor(roleId));
        window.__PORTAL_SESSION = user;
        document.documentElement.classList.remove('portal-auth-checking');
        void initPresence(user);
        startInactivityMonitor();
    } catch {
        authStorage.clearUserSession();
        redirectToLogin();
    }
};

window.__PORTAL_SESSION_READY = validateProtectedRoute();
await window.__PORTAL_SESSION_READY;
/* END SERVER SESSION PAGE GUARD */