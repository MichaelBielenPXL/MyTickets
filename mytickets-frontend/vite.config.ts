import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The Aspire host tells us where the API runs; on its own the API listens on port 5099.
const api = process.env.services__api__http__0 ?? process.env.API_HTTP ?? 'http://localhost:5099'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: { '/api': { target: api, changeOrigin: false } },
  },
})
