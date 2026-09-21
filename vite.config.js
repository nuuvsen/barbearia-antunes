import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/', // Domínio na raiz do servidor (nginx) — precisa ser absoluto (não './') pra funcionar
              // com o React Router quando alguém acessa/atualiza uma rota interna direto
              // (ex: /admin), senão os arquivos JS/CSS não carregam certo.
              // domínio quanto dentro de uma subpasta no servidor).
  server: {
    host: true, // Faz o Vite escutar em 0.0.0.0 (não só localhost), pra dar pra acessar
                // pelo IP do PC (ex: 10.100.10.10:5173) a partir do celular na mesma rede.
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: false, // Diz ao plugin para usar o seu manifest.json existente na pasta public
      // Trocado de "generateSW" (padrão, automático) para "injectManifest": precisamos de um
      // service worker PRÓPRIO (src/sw.js) pra poder também escutar notificações push em
      // segundo plano (Firebase Cloud Messaging) — o service worker 100% automático do
      // generateSW não tem como incluir esse código extra.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      devOptions: {
        enabled: true, // Permite que você teste a instalação rodando 'npm run dev'
        type: 'module' // Necessário no modo dev quando a estratégia é "injectManifest"
      }
    }),
  ],
})
