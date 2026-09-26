import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

// Aviso fixo no topo da tela quando o NAVEGADOR perde conexão com a internet.
//
// Por que isso importa: o Firestore está configurado com cache offline
// (persistentLocalCache, em firebase.js) — então, sem internet, o app continua rodando
// "por baixo dos panos" mostrando os últimos dados que tinha, em vez de travar ou dar erro.
// Isso é ótimo pra não quebrar a experiência, mas tem um efeito colateral: ninguém percebe
// que está vendo uma "foto antiga" da agenda (um agendamento novo de outro cliente, uma
// confirmação do bot, etc. não vão aparecer até a conexão voltar). Este aviso deixa isso
// visível.
//
// Limitação conhecida: isso detecta a internet do aparelho cair de verdade (navigator.onLine
// / eventos "online"/"offline" do navegador). Não cobre o caso raro de "internet ok, mas o
// Firestore especificamente está inacessível" (ex: bloqueio de firewall/DNS só pro Google) —
// esse caso teria que ser feito ouvindo o estado de cada listener do Firestore, o que é bem
// mais invasivo de implementar em todo o app.
export default function ConnectionBanner() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const ficouOnline = () => setOnline(true)
    const ficouOffline = () => setOnline(false)
    window.addEventListener('online', ficouOnline)
    window.addEventListener('offline', ficouOffline)
    return () => {
      window.removeEventListener('online', ficouOnline)
      window.removeEventListener('offline', ficouOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-500 text-black text-[11px] font-black uppercase tracking-widest text-center py-2 px-4 flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top">
      <WifiOff size={14} />
      Sem conexão — os dados na tela podem estar desatualizados
    </div>
  )
}
