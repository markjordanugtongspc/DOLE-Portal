import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

// Plugin to auto-increment version on build
function autoVersion() {
  return {
    name: 'auto-version',
    apply: 'build', // Only run during build phase
    buildStart() {
      const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'package.json')
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        const parts = pkg.version.split('.')
        parts[2] = String(Number(parts[2]) + 1)
        pkg.version = parts.join('.')
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
        console.log(`\n[auto-version] Bumped version to: ${pkg.version}\n`)
      } catch (err) {
        console.error('[auto-version] Failed to auto-increment version:', err)
      }
    }
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    autoVersion(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'index.html'),
        admin: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src/pages/user/admin/dashboard/index.html'),
        staff: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src/pages/user/staff/dashboard/index.html'),
        systems: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src/pages/user/admin/systems/index.html'),
        staffs: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src/pages/user/admin/staffs/index.html'),
      }
    }
  }
})
