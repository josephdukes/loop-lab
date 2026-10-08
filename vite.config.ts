import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * ONE PLACE TO CHANGE THE HOSTING ADDRESS:
 * set the LOOPLAB_BASE environment variable when building, e.g.
 *   LOOPLAB_BASE=/loop-lab/ npm run build
 * (the older name LOOP_LAB_BASE still works). Default is "/loop-lab/".
 * For a custom domain at its root, build with LOOPLAB_BASE=/
 * The base must start and end with "/".
 */
function readBase(): string {
  let base = (process.env.LOOPLAB_BASE ?? process.env.LOOP_LAB_BASE)?.trim() || '/loop-lab/'
  if (!base.startsWith('/')) base = '/' + base
  if (!base.endsWith('/')) base += '/'
  return base
}

export default defineConfig({
  base: readBase(),
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // never auto-update: the app shows an "Update ready" toast instead
      injectRegister: false, // registered by hand in src/pwa/registerSW.ts
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Loop Lab',
        short_name: 'Loop Lab',
        description: 'Table tennis robot training log (local-only, works offline).',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0b0b0c',
        background_color: '#0b0b0c',
        // Relative to the manifest file, so they follow whatever base the site is deployed under.
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // no skipWaiting / clientsClaim: the new worker waits until Joe taps "Reload"
      },
    }),
  ],
})
