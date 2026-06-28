import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// node:sqlite was added in Node.js 22.5+ and is not in builtinModules,
// so Vite does not recognise it as an external built-in and tries to load
// it as a file.  This plugin intercepts the import and re-exports it via
// createRequire, which bypasses Vite's module system entirely.
const nodeSqlitePlugin = {
  name: 'node-sqlite',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id === 'node:sqlite') {
      return '\0virtual:node-sqlite'
    }
  },
  load(id: string) {
    if (id === '\0virtual:node-sqlite') {
      return `
        import { createRequire } from 'module';
        const _require = createRequire(import.meta.url);
        const _m = _require('node:sqlite');
        export const DatabaseSync = _m.DatabaseSync;
        export const StatementSync = _m.StatementSync;
        export const Session = _m.Session;
        export const constants = _m.constants;
        export const backup = _m.backup;
      `
    }
  },
}

export default defineConfig({
  plugins: [react(), nodeSqlitePlugin],
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
  },
})
