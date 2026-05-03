import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Proxy /api/* vers l'API Express en dev pour éviter les problèmes CORS.
    proxy: {
      '/api': 'http://localhost:3003',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
