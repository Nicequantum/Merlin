import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Maybach Tech - Mercedes-Maybach Technician',
        short_name: 'MaybachTech',
        description: 'Professional tool for Mercedes-Maybach technicians to scan repair orders and generate warranty stories with Grok AI.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/logo.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  },
  build: {
    // Force esbuild minifier (avoids terser/serialize-javascript crypto issues in some envs)
    minify: 'esbuild',
    sourcemap: false
  }
})
