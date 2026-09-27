import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

// Detecta "sem conexão com o servidor" combinando dois sinais independentes:
//
// 1) O navegador está sem internet de verdade (navigator.onLine + eventos
//    online/offline da janela).
// 2) Mesmo com internet, o Firestore não está respondendo — usamos o listener
//    do doc "configuracoes/personalizacao" como "sensor" (ele já fica vivo o
//    tempo todo em App.jsx pra aplicar o tema, então não criamos leitura nova
//    nenhuma) e olhamos snapshot.metadata.fromCache: true significa que o dado
//    veio só do cache local (o app usa persistentLocalCache em firebase.js),
//    sem confirmação nenhuma do servidor.
//
// fromCache também vem true por um instante normal logo no primeiro carregamento
// (antes do primeiro round-trip terminar), então só tratamos como "sem conexão"
// se isso persistir por alguns segundos — e não logo de cara.
//
// Se o app NUNCA recebeu nenhuma resposta (nem do cache) depois de um tempo —
// típico de uma primeira visita, sem nada salvo localmente, e sem internet —
// também entra como sem conexão.
const TEMPO_GRACA_CACHE_MS = 5000
const TEMPO_LIMITE_PRIMEIRA_RESPOSTA_MS = 8000

export function useStatusConexao() {
  const [semConexao, setSemConexao] = useState(false)

  useEffect(() => {
    const recebeuAlgumaVezRef = { current: false }
    const timerCacheRef = { current: null }

    const limparTimerCache = () => {
      if (timerCacheRef.current) {
        clearTimeout(timerCacheRef.current)
        timerCacheRef.current = null
      }
    }

    const atualizarPorNavegador = () => {
      if (!navigator.onLine) {
        limparTimerCache()
        setSemConexao(true)
      }
    }
    window.addEventListener('online', atualizarPorNavegador)
    window.addEventListener('offline', atualizarPorNavegador)
    atualizarPorNavegador()

    const timeoutPrimeiraResposta = setTimeout(() => {
      if (!recebeuAlgumaVezRef.current) setSemConexao(true)
    }, TEMPO_LIMITE_PRIMEIRA_RESPOSTA_MS)

    const unsub = onSnapshot(
      doc(db, "configuracoes", "personalizacao"),
      { includeMetadataChanges: true },
      (snapshot) => {
        recebeuAlgumaVezRef.current = true
        clearTimeout(timeoutPrimeiraResposta)

        if (snapshot.metadata.fromCache) {
          if (!timerCacheRef.current) {
            timerCacheRef.current = setTimeout(() => {
              if (navigator.onLine) setSemConexao(true)
              timerCacheRef.current = null
            }, TEMPO_GRACA_CACHE_MS)
          }
        } else {
          limparTimerCache()
          setSemConexao(false)
        }
      },
      () => {
        // Erro do listener (ex: 'unavailable') também conta como sem conexão.
        setSemConexao(true)
      }
    )

    return () => {
      window.removeEventListener('online', atualizarPorNavegador)
      window.removeEventListener('offline', atualizarPorNavegador)
      clearTimeout(timeoutPrimeiraResposta)
      limparTimerCache()
      unsub()
    }
  }, [])

  return semConexao
}
