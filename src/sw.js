// Service worker próprio (estratégia "injectManifest" do VitePWA — ver vite.config.js).
// Faz duas coisas: (1) o precache normal do app pra funcionar offline/instalado, igual o
// service worker automático fazia antes; (2) escuta notificações push do Firebase Cloud
// Messaging chegando com o app FECHADO ou em segundo plano (com o app aberto, quem mostra
// o aviso é o onMessage() lá em firebaseMessaging.js, dentro da própria página).

import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// Usa o SDK modular do Firebase (import ES normal, resolvido pelo Vite igual o workbox
// acima) em vez do formato "compat" via importScripts — importScripts() não existe em
// service workers do tipo "module" (que é o que precisamos aqui por causa do import do
// workbox-precaching acima). O próprio Firebase disponibiliza esse pacote "firebase/messaging/sw"
// justamente pra esse cenário (service worker moderno, tipo module).
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

// Mesma config pública de src/firebase.js (são valores públicos, não credenciais —
// tranquilo repetir aqui; um service worker não consegue importar código do app).
const app = initializeApp({
  apiKey: "AIzaSyDvHAf6GShqzUFTbopXXlN39uMzL0leLIY",
  authDomain: "barbearia-antunes-eb17d.firebaseapp.com",
  projectId: "barbearia-antunes-eb17d",
  storageBucket: "barbearia-antunes-eb17d.firebasestorage.app",
  messagingSenderId: "142047287122",
  appId: "1:142047287122:web:0148f7a69fe74500a0cc8b"
})

const messaging = getMessaging(app)

onBackgroundMessage(messaging, (payload) => {
  const titulo = payload.notification?.title || 'Barbearia Antunes'
  const corpo = payload.notification?.body || ''

  self.registration.showNotification(titulo, {
    body: corpo,
    icon: './icon-192x192.png',
    badge: './icon-192x192.png'
  })
})
