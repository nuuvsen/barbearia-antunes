import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { Scissors, TrendingUp, ChevronDown, Award, PieChart } from 'lucide-react'

export default function AtendimentosPorBarbeiro({ barbeiros }) {
  const [atendimentos, setAtendimentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Busca todos os atendimentos concluídos
    const q = query(
      collection(db, "agendamentos"),
      where("status", "==", "concluido")
    )

    const unsub = onSnapshot(q, (snap) => {
      const dados = snap.docs.map(doc => doc.data())
      setAtendimentos(dados)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  // Função para processar os serviços de um barbeiro específico
  const obterMetricasServicos = (barbeiroId) => {
    const lista = atendimentos.filter(a => a.barbeiroId === barbeiroId)
    const contagem = {}

    lista.forEach(atend => {
      const nomeServico = atend.servico || "Serviço Padrão"
      contagem[nomeServico] = (contagem[nomeServico] || 0) + 1
    })

    // Converte para array e ordena do mais realizado para o menos
    const servicosOrdenados = Object.entries(contagem).sort((a, b) => b[1] - a[1])
    
    return {
      total: lista.length,
      ranking: servicosOrdenados, // [[nome, qtd], [nome, qtd]]
      principal: servicosOrdenados.length > 0 ? servicosOrdenados[0][0] : 'Nenhum'
    }
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      
      {loading ? (
        <div className="py-20 text-center font-black uppercase text-xs tracking-widest opacity-40">
          Carregando histórico de atendimentos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {barbeiros.map(b => {
            const metrics = obterMetricasServicos(b.id)

            return (
              <div key={b.id} className="p-8 rounded-[3rem] border flex flex-col space-y-6 transition-all hover:scale-[1.01]" 
                   style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                
                {/* Cabeçalho do Barbeiro */}
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center rotate-3 shadow-lg" 
                       style={{ backgroundColor: 'var(--cor-primaria-opaca)' }}>
                    <Scissors size={28} style={{ color: 'var(--cor-primaria)' }} />
                  </div>
                  <div>
                    <p className="font-black uppercase text-xl tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                      {b.nome}
                    </p>
                    {metrics.total > 0 && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 mt-1">
                        <Award size={12} className="text-green-500" />
                        <span className="text-[9px] font-black uppercase text-green-500 tracking-widest">
                          Top: {metrics.principal}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grande Total */}
                <div className="py-6 border-y border-dashed text-center" style={{ borderColor: 'var(--cor-borda)' }}>
                  <p className="text-5xl font-black italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                    {metrics.total}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Atendimentos Totais</p>
                </div>

                {/* Lista de Serviços Detalhada */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center gap-2">
                    <PieChart size={12} /> Detalhamento por serviço
                  </p>
                  
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {metrics.ranking.length > 0 ? (
                      metrics.ranking.map(([nome, qtd]) => (
                        <div key={nome} className="flex justify-between items-center p-3 rounded-2xl" 
                             style={{ backgroundColor: 'var(--cor-input-bg)' }}>
                          <span className="text-[10px] font-bold uppercase truncate pr-4" style={{ color: 'var(--cor-texto-principal)' }}>
                            {nome}
                          </span>
                          <span className="font-black text-xs px-2 py-1 rounded-lg bg-black/20" 
                                style={{ color: 'var(--cor-primaria)' }}>
                            {qtd}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] italic opacity-30 text-center py-4">Sem registros ainda</p>
                    )}
                  </div>
                </div>

                {/* Rodapé de Tendência */}
                <div className="pt-2">
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-green-500 flex items-center justify-center gap-1">
                     <TrendingUp size={10} /> Consistência de Agenda
                   </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}