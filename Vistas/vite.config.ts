import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api/finanzas': 'http://127.0.0.1:3000' },
  },
  preview: {
    host: '127.0.0.1',
    proxy: { '/api/finanzas': 'http://127.0.0.1:3000' },
  },
})
