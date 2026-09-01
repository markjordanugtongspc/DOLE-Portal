/* START SERVER HTTP HELPERS */
export const sendJson = (res, status, payload = {}) => {
    try {
        if (!res.headersSent) res.setHeader('Cache-Control', 'no-store');
    } catch {}
    if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(status).json(payload);
    }
    if (typeof res.status === 'function') {
        res.status(status);
    } else {
        res.statusCode = status;
    }
    if (typeof res.json === 'function') {
        return res.json(payload);
    }
    if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return res.end(JSON.stringify(payload));
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

    const configuredOrigin = String(
        process.env.PORTAL_APP_ORIGIN ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    ).replace(/\/$/, '');

    const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
    const requestProto = String(req.headers['x-forwarded-proto'] || 'https').trim();
    const requestOrigin = requestHost ? `${requestProto}://${requestHost}`.replace(/\/$/, '') : '';

    if (configuredOrigin && origin === configuredOrigin) return true;
    if (requestOrigin && origin === requestOrigin) return true;

    if (!configuredOrigin && !requestOrigin) {
        sendJson(res, 500, { error: 'Portal origin is not configured.' });
        return false;
    }

    sendJson(res, 403, { error: 'Cross-origin request rejected.' });
    return false;
};

export const parseCookies = (req) => Object.fromEntries(
    String(req.headers.cookie || '').split(';').map((item) => {
        const index = item.indexOf('=');
        return index < 0 ? [] : [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
    }).filter(([name]) => name)
);
/* END SERVER HTTP HELPERS */