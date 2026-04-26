import { useState, useEffect } from 'react'
import { db } from './firebase'
import { 
  doc, getDoc, setDoc, collection, 
  onSnapshot, query, orderBy, deleteDoc 
} from 'firebase/firestore'
import { ShieldCheck, Users, Save, MessageSquare, Trash2, Clock } from 'lucide-react'

export default function SuperAdmin() {
  const [limite, setLimite] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [solicitacoes, setSolicitacoes] = useState([])

  // 1. Carrega o limite e escuta as solicitações em tempo real
  useEffect(() => {
    // Carregar Limite Atual
    const carregarLimite = async () => {
      const docRef = doc(db, "configuracoes", "plano")
      const snap = await getDoc(docRef)
      if (snap.exists()) setLimite(snap.data().limiteBarbeiros)
    }
    carregarLimite()

    // Escutar "Chat" de Solicitações (Coleção 'solicitacoes')
    const q = query(collection(db, "solicitacoes"), orderBy("data", "desc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setSolicitacoes(lista)
    })

    return () => unsubscribe()
  }, [])

  const salvarLimite = async () => {
    setSalvando(true)
    try {
      await setDoc(doc(db, "configuracoes", "plano"), {
        limiteBarbeiros: Number(limite)
      })
      alert("Limite atualizado!")
    } catch (e) {
      alert("Erro ao salvar")
    } finally { setSalvando(false) }
  }

  const excluirSolicitacao = async (id) => {
    await deleteDoc(doc(db, "solicitacoes", id))
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA 1: CONFIGURAÇÃO DE LIMITE */}
        <div className="lg:col-span-1">
          <div className="bg-[#111111] border border-[#1f1f1f] p-8 rounded-[32px] sticky top-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-red-600 p-3 rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <h1 className="text-xl font-black uppercase italic">Super <span className="text-red-600">Admin</span></h1>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] flex items-center gap-2">
                  <Users size={14} className="text-red-600" /> Limite Global de Barbeiros
                </label>
                <input 
                  type="number" 
                  value={limite} 
                  onChange={e => setLimite(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-2xl font-black focus:border-red-600 outline-none"
                />
              </div>

              <button 
                onClick={salvarLimite}
                disabled={salvando}
                className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {salvando ? "Salvando..." : <><Save size={20} /> Atualizar</>}
              </button>
            </div>
          </div>
        </div>

        {/* COLUNA 2 e 3: CENTRAL DE SOLICITAÇÕES (CHAT) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="text-red-600" />
            <h2 className="text-lg font-black uppercase tracking-tighter">Solicitações dos Clientes</h2>
            <span className="bg-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{solicitacoes.length}</span>
          </div>

          <div className="space-y-3">
            {solicitacoes.length === 0 ? (
              <div className="bg-[#111] border border-dashed border-[#1f1f1f] p-10 rounded-[32px] text-center text-gray-600">
                <p className="uppercase font-black text-xs tracking-widest">Nenhuma solicitação pendente</p>
              </div>
            ) : (
              solicitacoes.map((s) => (
                <div key={s.id} className="bg-[#111] border border-[#1f1f1f] p-6 rounded-[24px] flex items-center justify-between hover:border-red-600/50 transition-all">
                  <div className="flex gap-4 items-center">
                    <div className="bg-[#1a1a1a] p-3 rounded-full text-red-600">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="font-black uppercase text-sm tracking-tight">{s.cliente || "Barbearia Desconhecida"}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Clock size={12} /> {s.data?.toDate().toLocaleString('pt-BR')}
                      </p>
                      <p className="text-red-500 font-bold text-xs mt-2 uppercase tracking-tighter">Pedido: {s.mensagem}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => excluirSolicitacao(s.id)}
                    className="p-3 bg-[#1a1a1a] text-gray-500 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}