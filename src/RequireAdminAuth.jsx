import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

// Guarda de acesso reutilizável para rotas administrativas.
//
// Como funciona:
// 1. Verifica se há um usuário logado no Firebase Auth (onAuthStateChanged).
// 2. Se houver, confere se o e-mail dele está na lista `emailsAutorizados`
//    do documento configuracoes/<configDoc> no Firestore.
// 3. Só libera o conteúdo (children) se as duas condições forem verdadeiras.
//
// Para autorizar alguém: Firebase Console → Firestore Database →
// coleção "configuracoes" → documento "acessoAdmin" (ou "superAdmin") →
// campo "emailsAutorizados" (array) → adicionar o e-mail da pessoa.
// A pessoa também precisa existir como usuário no Firebase Authentication,
// com a senha que ela vai usar aqui.
export default function RequireAdminAuth({ children, configDoc, titulo }) {
  const [status, setStatus] = useState('carregando') // carregando | autorizado | negado | deslogado
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('deslogado')
        return
      }
      try {
        const snap = await getDoc(doc(db, "configuracoes", configDoc))
        const emailsAutorizados = (snap.exists() ? snap.data().emailsAutorizados : []) || []
        const autorizado = emailsAutorizados
          .map(e => (e || '').toLowerCase())
          .includes((user.email || '').toLowerCase())

        if (autorizado) {
          setStatus('autorizado')
        } else {
          setStatus('negado')
          await signOut(auth)
        }
      } catch (e) {
        console.error("Erro ao verificar permissão de acesso:", e)
        setStatus('negado')
        await signOut(auth)
      }
    })
    return () => unsub()
  }, [configDoc])

  const handleLogin = async (e) => {
    e.preventDefault()
    setErro('')
    setEntrando(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha)
      // O onAuthStateChanged acima cuida do resto (verificação + status)
    } catch (err) {
      setErro('E-mail ou senha incorretos.')
    } finally {
      setEntrando(false)
    }
  }

  if (status === 'autorizado') {
    return children
  }

  if (status === 'carregando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white font-black uppercase tracking-widest text-xs animate-pulse">
          Verificando acesso...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm p-8 rounded-[2rem] border border-zinc-800 bg-zinc-950 space-y-5 shadow-2xl">
        <div>
          <h1 className="text-xl font-black uppercase italic tracking-tighter text-white">
            ANTUNES<span className="text-red-600">.OS</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">
            {titulo || 'Acesso Restrito'}
          </p>
        </div>

        {status === 'negado' && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase text-center">
            Esta conta não tem permissão para acessar esta área.
          </div>
        )}

        {erro && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase text-center">
            {erro}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-white outline-none focus:border-red-600 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Senha</label>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-white outline-none focus:border-red-600 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={entrando}
          className="w-full py-3 rounded-xl bg-red-600 hover:brightness-110 text-white font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50"
        >
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
