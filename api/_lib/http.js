/* START SERVER HTTP HELPERS */
export const sendJson = (res, status, payload = {}) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json(payload);
};

export const allowMethods = (req, res, methods) => {
    if (methods.includes(req.method)) return true;
    res.setHeader('Allow', methods.join(', '));
    sendJson(res, 405, { error: 'Method not allowed.' });
    return false;
};

export const getRequestBody = (req) => {
    if (!req.body) return {};
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(req.body); } catch { return {}; }
};

export const requireSameOrigin = (req, res) => {
    const origin = String(req.headers.origin || '').replace(/\/$/, '');
    if (!origin) return true;
    const configuredOrigin = String(process.env.PORTAL_APP_ORIGIN || '').replace(/\/$/, '');
    if (!configuredOrigin) {
        sendJson(res, 500, { error: 'Portal origin is not configured.' });
        return false;
    }
    if (origin !== configuredOrigin) {
        sendJson(res, 403, { error: 'Cross-origin request rejected.' });
        return false;
    }
    return true;
};

export const parseCookies = (req) => Object.fromEntries(
    String(req.headers.cookie || '').split(';').map((item) => {
        const index = item.indexOf('=');
        return index < 0 ? [] : [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
    }).filter(([name]) => name)
);
/* END SERVER HTTP HELPERS */