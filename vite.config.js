import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  base: './', // CRÍTICO: Permite que o .exe encontre os arquivos locais
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: false, // Diz ao plugin para usar o seu manifest.json existente na pasta public
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      devOptions: {
        enabled: true // Permite que você teste a instalação rodando 'npm run dev'
      }
    }),
    electron([
      {
        entry: 'electron/main.js', // Onde ficará o código do Desktop
      },
    ]),
    renderer(),
  ],
})