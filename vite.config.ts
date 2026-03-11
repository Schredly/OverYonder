import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
        timeout: 300000,        // 5 min — incoming request timeout
        proxyTimeout: 300000,   // 5 min — outgoing proxy timeout (ServiceNow + LLM)
      },
    },
  },
})
