import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const port = Number(process.env.PORT || 4180);

const localEnvironment = loadEnv('production', process.cwd(), '');
for (const [name, value] of Object.entries(localEnvironment)) {
    if (!(name in process.env)) process.env[name] = value;
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

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2'
};

const serveStatic = (req, res, pathname) => {
    let filePath = path.join(distDir, pathname);
    
    // Handle root or directory paths
    if (pathname === '/' || pathname.endsWith('/')) {
        filePath = path.join(distDir, pathname, 'index.html');
    } else if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
    } else if (!path.extname(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        // Fallback for SPA routing
        filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (err) {
        res.writeHead(500);
        res.end('Server Error loading static file');
    }
};

const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', `http://localhost:${port}`).pathname;
    const loadHandler = apiHandlers[pathname];

    if (!loadHandler) return serveStatic(req, res, pathname);

    try {
        req.body = await readJsonBody(req);
        const { default: handler } = await loadHandler();
        await handler(req, decorateResponse(res));
    } catch (error) {
        console.error('[LOCAL PREVIEW API] Failed:', error.message);
        if (!res.headersSent) decorateResponse(res).status(500).json({ error: 'Local Preview API failed.' });
    }
});

server.listen(port, () => {
    console.log(`\n  ➜ Portal Production Preview ready at http://localhost:${port}\n`);
});
