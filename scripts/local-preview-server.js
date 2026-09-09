import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const configDir = path.resolve(__dirname, '../src/backend/config');
const port = Number(process.env.PORT || 4180);

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

const apiIndexPath = path.resolve(__dirname, '../api/index.js');

/* START READ JSON BODY UTILITY - Parses incoming JSON request payload */
const readJsonBody = async (req) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return raw; }
};
/* END READ JSON BODY UTILITY */

/* START DECORATE RESPONSE UTILITY - Adds status and json helper methods to HTTP response */
const decorateResponse = (res) => {
    res.status = (status) => { res.statusCode = status; return res; };
    res.json = (payload) => {
        if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
        return res;
    };
    return res;
};
/* END DECORATE RESPONSE UTILITY */

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

/* START SERVE STATIC FILES - Serves built production assets from dist directory */
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
/* END SERVE STATIC FILES */

/* START LOCAL PREVIEW SERVER - Serves production bundle and forwards API calls to centralized router */
const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', `http://localhost:${port}`).pathname;

    if (pathname.startsWith('/api/') || pathname === '/api') {
        try {
            req.body = await readJsonBody(req);
            const { default: handler } = await import(`${pathToFileURL(apiIndexPath).href}?update=${Date.now()}`);
            await handler(req, decorateResponse(res));
        } catch (error) {
            console.error('[LOCAL PREVIEW API] Failed:', error);
            if (!res.headersSent) decorateResponse(res).status(500).json({ error: error.message || 'Local Preview API failed.' });
        }
        return;
    }

    serveStatic(req, res, pathname);
});
/* END LOCAL PREVIEW SERVER */

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const nextPort = port + 1;
        console.warn(`\n  ⚠️ Port ${port} is already in use. Retrying preview server on http://localhost:${nextPort}...\n`);
        server.listen(nextPort);
    } else {
        console.error('[LOCAL PREVIEW SERVER ERROR]', err);
    }
});

server.listen(port, () => {
    const currentPort = server.address()?.port || port;
    console.log(`\n  ➜ Portal Production Preview ready at http://localhost:${currentPort}\n`);
});
