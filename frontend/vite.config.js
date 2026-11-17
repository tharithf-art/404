import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Leaflet + Recharts are large but expected
    chunkSizeWarningLimit: 1000,
  },
})
