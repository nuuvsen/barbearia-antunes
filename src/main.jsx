import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Bug real encontrado (28/09/2026): um deploy novo podia demorar muito pra "pegar" de
// verdade em quem já tinha o app instalado (cliente ou Team Antunes) — o navegador só
// rechecava por uma versão nova sozinho de vez em quando, o que quase nunca acontecia
// num PWA que o barbeiro deixa aberto/minimizado o dia todo. Registrando manualmente (em
// vez do script automático do VitePWA — ver injectRegister:false em vite.config.js), dá
// pra forçar essa checagem toda vez que o app volta a ficar visível (o barbeiro desbloqueia
// o celular e volta pro app). Com registerType "autoUpdate", uma versão nova encontrada já
// assume e recarrega a página sozinha, sem precisar perguntar nada.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
