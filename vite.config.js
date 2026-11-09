import { fileURLToPath, URL } from 'node:url'
import { hostname } from 'node:os'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { todoApi } from './server/todoApi.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    // The shared list for all my devices lives in data/todos.json
    todoApi(fileURLToPath(new URL('./data/todos.json', import.meta.url))),
  ],
  // Listen on all network cards so my phone can open it (Wi-Fi IP or Tailscale)
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // This PC's own name, so Tailscale's http://<pc-name>:5173 is allowed
    allowedHosts: [hostname().toLowerCase()],
    watch: { ignored: ['**/data/**'] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
