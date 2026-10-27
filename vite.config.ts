import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/grow_together/',
  // Phaser 한 덩어리(약 1.2MB)가 경고 기준을 넘는 건 의도된 것
  build: { chunkSizeWarningLimit: 1600 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '같이 크는 중',
        short_name: '같이크기',
        lang: 'ko',
        theme_color: '#ff8a5b',
        background_color: '#fff6ec',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/grow_together/',
        scope: '/grow_together/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
