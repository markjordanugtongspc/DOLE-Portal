/* START SERVER SESSION PAGE GUARD */
try { localStorage.removeItem('dole_session'); } catch {}
const routeMatch = window.location.pathname.match(/\/src\/pages\/user\/(admin|staff)\//);

const redirectToLogin = () => window.location.replace('/?auth=login_required');
const dashboardFor = (roleId) => Number(roleId) === 1
    ? '/src/pages/user/admin/dashboard/'
    : '/src/pages/user/staff/dashboard/';

let cachedSessionUser = null;
try {
    const raw = sessionStorage.getItem('portal_user');
    if (raw) cachedSessionUser = JSON.parse(raw);
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

const validateProtectedRoute = async () => {
    if (!routeMatch) return;
    if (!cachedSessionUser) {
        document.documentElement.classList.add('portal-auth-checking');
    }
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        const user = response.ok ? payload.data : null;
        if (!user) {
            try { sessionStorage.removeItem('portal_user'); } catch {}
            return redirectToLogin();
        }

        window.__PORTAL_SESSION = user;
        try { sessionStorage.setItem('portal_user', JSON.stringify(user)); } catch {}

        const roleId = Number(user.role_id);
        const requiredRole = routeMatch[1];
        const isAlertsRoute = /\/src\/pages\/user\/admin\/alerts\//.test(window.location.pathname);
        const allowed = isAlertsRoute
            ? roleId === 1 || roleId === 2
            : requiredRole === 'admin' ? roleId === 1 : roleId === 2 || roleId === 3;
        if (!allowed) return window.location.replace(dashboardFor(roleId));
        document.documentElement.classList.remove('portal-auth-checking');
    } catch {
        try { sessionStorage.removeItem('portal_user'); } catch {}
        redirectToLogin();
    }
};

window.__PORTAL_SESSION_READY = validateProtectedRoute();
await window.__PORTAL_SESSION_READY;
/* END SERVER SESSION PAGE GUARD */