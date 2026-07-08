import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'd7d — dashboard',
        short_name: 'd7d',
        description: 'Your personal, client-only dashboard: bookmarks, notes, search.',
        theme_color: '#0E0E11',
        background_color: '#0E0E11',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Favicons — opaque cross-origin responses cached for offline (§6.1)
            urlPattern: ({ url }) => url.hostname === 'icons.duckduckgo.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'favicons',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Weather — fresh when online, cached fallback offline (§6.2)
            urlPattern: ({ url }) => url.hostname.endsWith('open-meteo.com'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
