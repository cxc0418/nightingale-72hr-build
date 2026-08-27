import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 激活 Tailwind v4
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Nightingale EHR',
        short_name: 'Nightingale',
        description: 'Collaborative Longitudinal Patient Record',
        theme_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  }
})