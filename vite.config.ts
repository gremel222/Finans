import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

const base = './'
const single = process.env.SINGLE_FILE === '1'

export default defineConfig({
  base,
  plugins: [
    react(),
    ...(single
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Финансовая система — Семён',
              short_name: 'Финансы',
              description: 'Офлайн-учёт личных финансов',
              theme_color: '#1F2937',
              background_color: '#EAF4F6',
              display: 'standalone',
              lang: 'ru',
              start_url: base,
              scope: base,
              icons: [
                { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
              navigateFallback: 'index.html',
            },
          }),
        ]),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
})
