import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      // ... (existing PWA config)
      registerType: 'autoUpdate',
      injectRegister: 'script',
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/js\.paystack\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /.*\.js$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'js-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              }
            }
          },
          // 🛡️ FIX CRIT-04: Supabase API responses must NEVER be cached.
          // Caching auth responses can leak premium status, stale user data, or session info.
          // The sw.js fetch handler already correctly bypasses all supabase.co requests.
        ]
      },
      manifest: {
        name: 'CBT Elite Platform',
        short_name: 'CBT Elite',
        description: 'Premium Computer Based Testing and Learning Platform',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            "src": "pwa-192x192.png",
            "sizes": "192x192",
            "type": "image/png"
          },
          {
            "src": "pwa-512x512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@supabase/supabase-js', 'lucide-static']
        }
      }
    }
  }
})
