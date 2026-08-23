import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Plugin: auto-increment patch version on each build ───────────────────────

function autoVersion() {
  return {
    name: 'auto-version',
    apply: 'build',
    buildStart() {
      const packageJsonPath = path.resolve(__dirname, 'package.json')
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        const parts = pkg.version.split('.')
        let major = Number(parts[0])
        let minor = Number(parts[1])
        let patch = Number(parts[2])

        patch += 1
        if (patch > 9) {
          patch = 0
          minor += 1
        }
        if (minor > 9) {
          minor = 0
          major += 1
        }

        pkg.version = `${major}.${minor}.${patch}`
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
        console.log(`\n[auto-version] Bumped version to: ${pkg.version}\n`)
      } catch (err) {
        console.error('[auto-version] Failed to auto-increment version:', err)
      }
    }
  }
}

// ─── Plugin: copy static asset folders to dist after build ────────────────────
// Copies src/assets/images, src/assets/logos, src/assets/icons → dist/src/assets/...
// so that relative paths used in HTML (e.g. /src/assets/logos/dole_logo.png) continue
// to resolve correctly when serving the dist build.
function copyStaticAssets() {
  const srcAssetsDir  = path.resolve(__dirname, 'src/assets')
  const distAssetsDir = path.resolve(__dirname, 'dist/src/assets')

  /** Recursively copy a directory */
  function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath  = path.join(src,  entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  return {
    name: 'copy-static-assets',
    apply: 'build',
    closeBundle() {
      const subfolders = ['images', 'logos', 'icons']
      for (const folder of subfolders) {
        const src  = path.join(srcAssetsDir,  folder)
        const dest = path.join(distAssetsDir, folder)
        if (fs.existsSync(src)) {
          copyDir(src, dest)
          console.log(`[copy-static-assets] Copied src/assets/${folder} → dist/src/assets/${folder}`)
        }
      }
    }
  }
}

// ─── Helper: Auto-discover all HTML files ───────────────────────────────────────
function getHtmlEntries() {
  const entries = { main: path.resolve(__dirname, 'index.html') }
  const srcPagesDir = path.resolve(__dirname, 'src/pages')

  function findHtml(dir) {
    if (!fs.existsSync(dir)) return
    for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, file.name)
      if (file.isDirectory()) {
        findHtml(fullPath)
      } else if (file.name.endsWith('.html')) {
        // Create a unique key for rollup (e.g. src_pages_user_admin_index)
        const relativePath = path.relative(__dirname, fullPath)
        const key = relativePath.replace(/\.html$/, '').replace(/[\\/]/g, '_')
        entries[key] = fullPath
      }
    }
  }

  findHtml(srcPagesDir)
  return entries
}


// ─── Plugin: Local API Middleware for Vite dev server ───────────────────────
function localApiMiddleware() {
  return {
    name: 'local-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost:5173');
        if (!url.pathname.startsWith('/api/')) return next();

        let handlerPath = null;
        if (url.pathname === '/api/chatbot' || url.pathname === '/api/chatbot/chatbot.api') {
          handlerPath = path.resolve(__dirname, 'api/chatbot/chatbot.api.js');
        } else if (url.pathname === '/api/auth/login') {
          handlerPath = path.resolve(__dirname, 'api/auth/login.js');
        } else if (url.pathname === '/api/auth/me') {
          handlerPath = path.resolve(__dirname, 'api/auth/me.js');
        } else if (url.pathname === '/api/auth/logout') {
          handlerPath = path.resolve(__dirname, 'api/auth/logout.js');
        } else if (url.pathname === '/api/profile') {
          handlerPath = path.resolve(__dirname, 'api/profile.js');
        } else if (url.pathname === '/api/audit-logs') {
          handlerPath = path.resolve(__dirname, 'api/audit-logs.js');
        } else if (url.pathname === '/api/external-account-links') {
          handlerPath = path.resolve(__dirname, 'api/external-account-links.js');
        } else if (url.pathname === '/api/external-system-directory') {
          handlerPath = path.resolve(__dirname, 'api/external-system-directory.js');
        } else if (url.pathname === '/api/sso/authorize') {
          handlerPath = path.resolve(__dirname, 'api/sso/authorize.js');
        } else if (url.pathname === '/api/sso/consume') {
          handlerPath = path.resolve(__dirname, 'api/sso/consume.js');
        }

        if (!handlerPath || !fs.existsSync(handlerPath)) return next();

        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          if (raw) {
            try { req.body = JSON.parse(raw); } catch { req.body = raw; }
          } else {
            req.body = {};
          }

          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (payload) => {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
            return res;
          };

          const handlerUrl = `${pathToFileURL(handlerPath).href}?t=${Date.now()}`;
          const { default: handler } = await import(handlerUrl);
          await handler(req, res);
        } catch (err) {
          console.error('[Vite Local API Middleware] Error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    autoVersion(),
    copyStaticAssets(),
    localApiMiddleware(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.ico', 'dole-logo.ico', 'icons.svg'],
      manifest: {
        name: 'DOLE ILIGAN Portal',
        short_name: 'DOLE Portal',
        description: 'DOLE Region X Implementors Login Portal & Administrative System',
        theme_color: '#1d4ed8',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/src/assets/logos/dole_logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/src/assets/logos/dole_logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,jpg,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /.*\.html.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-pages',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-libraries',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  worker: {
    format: 'es'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@scribe.js/canvas': fileURLToPath(new URL('./src/scripts/modules/mock-canvas.js', import.meta.url))
    }
  },
  // Read .env from src/backend/config/ — all Supabase credentials are stored there
  envDir: path.resolve(__dirname, 'src/backend/config'),
  // public/ is copied as-is to dist/ root by Vite automatically (favicon, icons.svg, etc.)
  publicDir: 'public',
  preview: {
    port: 4180,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: getHtmlEntries()
    }
  }
})

