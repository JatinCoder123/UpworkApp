import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// GoDaddy, NameSilo and Moz do not send usable CORS headers, so the browser
// cannot call them directly. These dev/preview proxies forward the request
// unchanged (credentials still come from the frontend's VITE_* env values).
const passThrough = (prefix, target) => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(new RegExp(`^${prefix}`), ''),
})

const proxy = {
  '/proxy/godaddy': passThrough('/proxy/godaddy', 'https://api.godaddy.com'),
  '/proxy/namesilo': passThrough('/proxy/namesilo', 'https://www.namesilo.com'),
  '/proxy/moz': passThrough('/proxy/moz', 'https://lsapi.seomoz.com'),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
})
