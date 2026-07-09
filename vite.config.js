import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
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

export default defineConfig({
  plugins: [
    tailwindcss(),
    autoVersion(),
    copyStaticAssets(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // public/ is copied as-is to dist/ root by Vite automatically (favicon, icons.svg, etc.)
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main:    path.resolve(__dirname, 'index.html'),
        admin:   path.resolve(__dirname, 'src/pages/user/admin/dashboard/index.html'),
        staff:   path.resolve(__dirname, 'src/pages/user/staff/dashboard/index.html'),
        systems: path.resolve(__dirname, 'src/pages/user/admin/systems/index.html'),
        staffs:  path.resolve(__dirname, 'src/pages/user/admin/staffs/index.html'),
      }
    }
  }
})

