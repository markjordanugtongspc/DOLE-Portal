/* START SERVER SESSION PAGE GUARD */
try { localStorage.removeItem('dole_session'); } catch {}
const routeMatch = window.location.pathname.match(/\/src\/pages\/user\/(admin|staff)\//);

const redirectToLogin = () => window.location.replace('/?auth=login_required');
const dashboardFor = (roleId) => Number(roleId) === 1
    ? '/src/pages/user/admin/dashboard/'
    : '/src/pages/user/staff/dashboard/';

import { authStorage } from './modules/storage.js';

let cachedSessionUser = null;
try {
    cachedSessionUser = authStorage.getUserSession();
} catch {}

if (routeMatch && cachedSessionUser) {
    window.__PORTAL_SESSION = cachedSessionUser;
    const roleId = Number(cachedSessionUser.role_id);
    const requiredRole = routeMatch[1];
    const isAlertsRoute = /\/src\/pages\/user\/admin\/alerts\//.test(window.location.pathname);
    const allowed = isAlertsRoute
        ? roleId === 1 || roleId === 2
        : requiredRole === 'admin' ? roleId === 1 : roleId === 2 || roleId === 3;
    if (allowed) {
        document.documentElement.classList.remove('portal-auth-checking');
    }
}

import { detectActiveUserSession } from '../backend/api/auth.api.js';

const validateProtectedRoute = async () => {
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
        const requiredRole = routeMatch[1];
        const isAlertsRoute = /\/src\/pages\/user\/admin\/alerts\//.test(window.location.pathname);
        const allowed = isAlertsRoute
            ? roleId === 1 || roleId === 2
            : requiredRole === 'admin' ? roleId === 1 : roleId === 2 || roleId === 3;

        if (!allowed) return window.location.replace(dashboardFor(roleId));
        document.documentElement.classList.remove('portal-auth-checking');
    } catch {
        if (cachedSessionUser && String(cachedSessionUser.approval_status || '').toUpperCase() === 'APPROVED') {
            window.__PORTAL_SESSION = cachedSessionUser;
            document.documentElement.classList.remove('portal-auth-checking');
            return;
        }
        authStorage.clearUserSession();
        redirectToLogin();
    }
};

window.__PORTAL_SESSION_READY = validateProtectedRoute();
await window.__PORTAL_SESSION_READY;
/* END SERVER SESSION PAGE GUARD */