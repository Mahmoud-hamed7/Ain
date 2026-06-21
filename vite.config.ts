/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    proxy: {
      '/hub': {
        target: 'https://4498-197-54-154-143.ngrok-free.app',
        changeOrigin: true,
        secure: false,
        ws: true, // Needed for SignalR websockets
      },
    },
  },
})
