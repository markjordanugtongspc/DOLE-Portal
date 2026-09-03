/**
 * DOLE Portal — Centralized Serverless Backend Router
 * Consolidates all API endpoints into a single Vercel Serverless Function entry-point.
 * Complies with Vercel Hobby Plan (≤ 12 Serverless Functions limit).
 */

import handleAuthLogin from './_handlers/auth-login.js';
import handleAuthMe from './_handlers/auth-me.js';
import handleAuthLogout from './_handlers/auth-logout.js';
import handleAuthForgotPassword from './_handlers/auth-forgot-password.js';
import handleProfile from './_handlers/profile.js';
import handleAuditLogs from './_handlers/audit-logs.js';
import handleExternalAccountLinks from './_handlers/external-account-links.js';
import handleExternalSystemDirectory from './_handlers/external-system-directory.js';
import handleSsoAuthorize from './_handlers/sso-authorize.js';
import handleSsoConsume from './_handlers/sso-consume.js';
import handleChatbot from './_handlers/chatbot.js';
import handleSmsSend from './_handlers/sms-send.js';
import { sendJson } from './_lib/http.js';

/* START ROUTE REGISTRY */
const routes = {
    '/api/auth/login': handleAuthLogin,
    '/api/auth/me': handleAuthMe,
    '/api/auth/logout': handleAuthLogout,
    '/api/auth/forgot-password': handleAuthForgotPassword,
    '/api/profile': handleProfile,
    '/api/audit-logs': handleAuditLogs,
    '/api/external-account-links': handleExternalAccountLinks,
    '/api/external-system-directory': handleExternalSystemDirectory,
    '/api/sso/authorize': handleSsoAuthorize,
    '/api/sso/consume': handleSsoConsume,
    '/api/chatbot': handleChatbot,
    '/api/chatbot/chatbot.api': handleChatbot,
    '/api/sms': handleSmsSend,
    '/api/sms/send': handleSmsSend
};
/* END ROUTE REGISTRY */

/* START PATHNAME RESOLVER */
const resolvePathname = (req) => {
    // 1. Direct URL inspection
    if (req.url) {
        try {
            const parsed = new URL(req.url, 'http://localhost');
            const clean = parsed.pathname.replace(/\/+$/, '') || '/';
            if (clean in routes) return clean;
        } catch {}
    }

    // 2. Check Vercel rewrite headers
    const matchedPath = req.headers['x-matched-path'];
    if (matchedPath) {
        try {
            const parsed = new URL(matchedPath, 'http://localhost');
            const clean = parsed.pathname.replace(/\/+$/, '') || '/';
            if (clean in routes) return clean;
        } catch {
            const clean = String(matchedPath).replace(/\/+$/, '') || '/';
            if (clean in routes) return clean;
        }
    }

    // 3. Check raw request URL fallback
    const rawPath = String(req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
    if (rawPath in routes) return rawPath;

    return rawPath;
};
/* END PATHNAME RESOLVER */

const handlerPaths = {
    '/api/auth/login': './_handlers/auth-login.js',
    '/api/auth/me': './_handlers/auth-me.js',
    '/api/auth/logout': './_handlers/auth-logout.js',
    '/api/auth/forgot-password': './_handlers/auth-forgot-password.js',
    '/api/profile': './_handlers/profile.js',
    '/api/audit-logs': './_handlers/audit-logs.js',
    '/api/external-account-links': './_handlers/external-account-links.js',
    '/api/external-system-directory': './_handlers/external-system-directory.js',
    '/api/sso/authorize': './_handlers/sso-authorize.js',
    '/api/sso/consume': './_handlers/sso-consume.js',
    '/api/chatbot': './_handlers/chatbot.js',
    '/api/chatbot/chatbot.api': './_handlers/chatbot.js',
    '/api/sms': './_handlers/sms-send.js',
    '/api/sms/send': './_handlers/sms-send.js'
};

/* START MAIN DISPATCHER - Resolves and executes the matched API route handler */
export default async function handler(req, res) {
    const pathname = resolvePathname(req);
    const handlerRelativePath = handlerPaths[pathname];

    if (handlerRelativePath) {
        try {
            let routeHandler = routes[pathname];
            if (process.env.NODE_ENV !== 'production') {
                const moduleUrl = new URL(handlerRelativePath, import.meta.url).href;
                const freshModule = await import(`${moduleUrl}?ts=${Date.now()}`);
                routeHandler = freshModule.default || routeHandler;
            }
            return await routeHandler(req, res);
        } catch (error) {
            console.error(`[PORTAL API ROUTER] Exception at ${pathname}:`, error);
            return sendJson(res, 500, { error: error.message || 'Internal Server Error.' });
        }
    }

    return sendJson(res, 404, {
        error: `Endpoint not found: ${pathname}`,
        availableEndpoints: Object.keys(routes)
    });
}
/* END MAIN DISPATCHER */
