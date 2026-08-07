import http from 'node:http';
import { createServer as createViteServer, loadEnv } from 'vite';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.resolve(__dirname, '../src/backend/config');
const port = Number(process.env.PORT || 5173);
const localEnvironment = {
    ...loadEnv('production', process.cwd(), ''),
    ...loadEnv('development', process.cwd(), ''),
    ...loadEnv('production', configDir, ''),
    ...loadEnv('development', configDir, '')
};
for (const [name, value] of Object.entries(localEnvironment)) {
    if (value && !(name in process.env)) process.env[name] = value;
}
process.env.PORTAL_APP_ORIGIN = `http://localhost:${port}`;

const apiHandlers = {
    '/api/auth/login': () => import(`../api/auth/login.js?update=${Date.now()}`),
    '/api/auth/me': () => import(`../api/auth/me.js?update=${Date.now()}`),
    '/api/auth/logout': () => import(`../api/auth/logout.js?update=${Date.now()}`),
    '/api/external-account-links': () => import(`../api/external-account-links.js?update=${Date.now()}`),
    '/api/external-system-directory': () => import(`../api/external-system-directory.js?update=${Date.now()}`),
    '/api/sso/authorize': () => import(`../api/sso/authorize.js?update=${Date.now()}`),
    '/api/sso/consume': () => import(`../api/sso/consume.js?update=${Date.now()}`)
};

/* START LOCAL PORTAL API SERVER - Executes Vercel route handlers before Vite in development */
const readJsonBody = async (req) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return raw; }
};

const decorateResponse = (res) => {
    res.status = (status) => { res.statusCode = status; return res; };
    res.json = (payload) => {
        if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
        return res;
    };
    return res;
};

const vite = await createViteServer({
    configFile: 'vite.config.js',
    server: { middlewareMode: true },
    appType: 'spa'
});

const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', `http://localhost:${port}`).pathname;
    const loadHandler = apiHandlers[pathname];

    if (!loadHandler) return vite.middlewares(req, res);

    try {
        req.body = await readJsonBody(req);
        const { default: handler } = await loadHandler();
        await handler(req, decorateResponse(res));
    } catch (error) {
        console.error('[LOCAL PORTAL API] Failed:', error.message);
        if (!res.headersSent) decorateResponse(res).status(500).json({ error: 'Local Portal API failed to start.' });
    }
});

server.listen(port, () => {
    console.log(`Portal local server ready at http://localhost:${port}`);
});
/* END LOCAL PORTAL API SERVER */