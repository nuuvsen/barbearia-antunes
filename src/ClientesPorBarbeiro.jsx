import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { Users, ChevronRight, Target, ShieldCheck } from 'lucide-react'

export default function ClientesPorBarbeiro({ barbeiros }) {
  const [atendimentos, setAtendimentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [fidelidade, setFidelidade] = useState({})

  useEffect(() => {
    // Busca todos os atendimentos concluídos para calcular a recorrência
    const q = query(
      collection(db, "agendamentos"),
      where("status", "==", "concluido")
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => doc.data())
      processarFidelidade(docs)
      setLoading(false)
    })

    return () => unsub()
  }, [barbeiros])

  const processarFidelidade = (dados) => {
    const mapaClientes = {} // { nomeCliente: { barbeiroId: count } }

    // 1. Agrupar atendimentos por cliente e barbeiro
    dados.forEach(atend => {
      const cNome = atend.clienteNome || atend.clienteId // Fallback para ID se não tiver nome
      const bId = atend.barbeiroId

      if (!mapaClientes[cNome]) mapaClientes[cNome] = {}
      mapaClientes[cNome][bId] = (mapaClientes[cNome][bId] || 0) + 1
    })

    // 2. Determinar o "Barbeiro Favorito" de cada cliente
    const contagemFidelidade = {}
    barbeiros.forEach(b => contagemFidelidade[b.id] = 0)

    Object.values(mapaClientes).forEach(preferencias => {
      // Encontra qual barbeiro tem mais atendimentos para este cliente específico
      const ordenado = Object.entries(preferencias).sort((a, b) => b[1] - a[1])
      const melhorBarbeiroId = ordenado[0][0]
      const frequenciaNoMelhor = ordenado[0][1]

      // Critério: Ser o favorito e ter pelo menos 2 atendimentos para ser considerado "Fixo"
      if (contagemFidelidade.hasOwnProperty(melhorBarbeiroId) && frequenciaNoMelhor >= 2) {
        contagemFidelidade[melhorBarbeiroId]++
      }
    })

    setFidelidade(contagemFidelidade)
  }

  // Encontra o maior número de clientes fixos para basear a barra de progresso (escala relativa)
  const maxClientesFixos = Math.max(...Object.values(fidelidade), 1)

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1 mb-6 px-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--cor-primaria)' }}>
          Índice de Retenção
        </h3>
        <p className="text-[11px] font-bold opacity-50 uppercase">
          Clientes que cortam mais com você do que com outros (mín. 2 vezes)
        </p>
      </div>

      {loading ? (
        <div className="p-10 text-center font-black uppercase text-[10px] tracking-widest opacity-30">
          Analisando histórico de fidelidade...
        </div>
      ) : (
        barbeiros.map(b => {
          const totalFixos = fidelidade[b.id] || 0
          const porcentagemBarra = (totalFixos / maxClientesFixos) * 100

          return (
            <div key={b.id} className="p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:brightness-110" 
                 style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
              
              <div className="flex items-center gap-4 min-w-[220px]">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative" 
                     style={{ backgroundColor: 'var(--cor-input-bg)' }}>
                  <Users size={20} style={{ color: 'var(--cor-primaria)' }} />
                  {totalFixos > 10 && (
                    <div className="absolute -top-1 -right-1">
                      <ShieldCheck size={16} className="text-green-500 fill-green-500/20" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-black uppercase text-sm tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                    {b.nome}
                  </p>
                  <p className="text-[9px] font-black uppercase text-green-500/70 tracking-widest flex items-center gap-1">
                    <Target size={10} /> Base Fiel
                  </p>
                </div>
              </div>
              
              <div className="flex-1 px-4">
                <div className="flex justify-between mb-2">
                   <span className="text-[8px] font-black uppercase opacity-40 tracking-widest">Lealdade na Barbearia</span>
                   <span className="text-[8px] font-black uppercase" style={{ color: 'var(--cor-primaria)' }}>
                    {totalFixos} Clientes
                   </span>
                </div>
                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-1000 ease-out" 
                    style={{ 
                      width: `${porcentagemBarra}%`,
                      backgroundColor: 'var(--cor-primaria)',
                      boxShadow: '0 0 10px var(--cor-primaria-suave)'
                    }} 
                  /> 
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xl font-black italic" style={{ color: 'var(--cor-texto-principal)' }}>
                    {totalFixos}
                  </p>
                  <p className="text-[8px] font-black uppercase opacity-50 tracking-widest">Fixos</p>
                </div>
                <ChevronRight size={20} className="opacity-10" />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}