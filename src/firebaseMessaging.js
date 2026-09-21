// Ativação de notificações push (Firebase Cloud Messaging) — usado tanto pela tela do
// cliente (Cliente.jsx) quanto pelo painel do barbeiro (PainelBarbeiro.jsx). Pede a
// permissão do navegador, gera o "token" deste aparelho específico e salva ele no
// documento certo (clientes/{telefone} ou barbeiros/{id}), num campo fcmTokens — é uma
// LISTA porque a mesma pessoa pode instalar o app em mais de um aparelho.
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { doc, setDoc, arrayUnion } from 'firebase/firestore'
import { app, db } from './firebase'
import toast from 'react-hot-toast'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Evita registrar o listener de mensagens em primeiro plano mais de uma vez por sessão
// se o cliente clicar no botão "Ativar Notificações" de novo sem precisar.
let listenerPrimeiroPlanoAtivo = false

export const ativarNotificacoes = async (colecao, idDocumento) => {
  if (!idDocumento) {
    toast.error('Precisa estar identificado (telefone/login) antes de ativar notificações.')
    return false
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    toast.error('Este navegador não suporta notificações push.')
    return false
  }

  if (!VAPID_KEY) {
    console.error('VITE_FIREBASE_VAPID_KEY não configurada no .env — gere em Console do Firebase > Configurações > Cloud Messaging.')
    toast.error('Notificações ainda não configuradas pelo administrador.')
    return false
  }

  try {
    const suportado = await isSupported()
    if (!suportado) {
      toast.error('Este navegador não suporta notificações push.')
      return false
    }

    const permissao = await Notification.requestPermission()
    if (permissao !== 'granted') {
      toast('Você optou por não receber notificações.')
      return false
    }

    const registration = await navigator.serviceWorker.ready
    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })

    if (!token) {
      toast.error('Não foi possível gerar o token de notificação.')
      return false
    }

    await setDoc(doc(db, colecao, idDocumento), { fcmTokens: arrayUnion(token) }, { merge: true })

    // Com o app ABERTO (primeiro plano), quem mostra o aviso chegando é este listener —
    // o service worker (src/sw.js) só entra em ação com o app fechado/em segundo plano.
    if (!listenerPrimeiroPlanoAtivo) {
      onMessage(messaging, (payload) => {
        const titulo = payload.notification?.title || 'Barbearia Antunes'
        const corpo = payload.notification?.body || ''
        toast(corpo ? `${titulo} — ${corpo}` : titulo, { icon: '🔔', duration: 6000 })
      })
      listenerPrimeiroPlanoAtivo = true
    }

    toast.success('Notificações ativadas!')
    return true
  } catch (erro) {
    console.error('Erro ao ativar notificações:', erro)
    toast.error('Erro ao ativar notificações neste aparelho.')
    return false
  }
}
