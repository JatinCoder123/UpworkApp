import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const crmTarget = (env.VITE_CRM_BASE_URL || 'https://upwork.outrightcrm.in').replace(/\/$/, '')
  const mcpTarget = (env.VITE_MCP_CRM_BASE_URL || 'https://crm.outrightsystems.org').replace(/\/$/, '')

  return {
    plugins: [react(), tailwindcss()],
    // The project lives in OneDrive, which turns node_modules files into placeholders (reparse points) that the
    // build's resolver treats as links and cannot follow ("failed to resolve import 'react'"). Not following links fixes it.
    resolve: { preserveSymlinks: true },
    server: {
      proxy: {
        '/crm-entrypoint': {
          target: crmTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/crm-entrypoint/, ''),
        },
        '/mcp-proxy': {
          target: mcpTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/mcp-proxy/, ''),
        },
      },
    },
  }
})
