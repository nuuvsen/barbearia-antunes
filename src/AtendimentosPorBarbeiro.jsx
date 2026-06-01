import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { Scissors, TrendingUp, Award, PieChart, Star, StarHalf } from 'lucide-react'

export default function AtendimentosPorBarbeiro({ barbeiros }) {
  const [atendimentos, setAtendimentos] = useState([])
  const [avaliacoes, setAvaliacoes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // CORREÇÃO 1: Buscando pela exata string que está no banco ("Concluído")
    const qAtendimentos = query(
      collection(db, "agendamentos"),
      where("status", "==", "Concluído") 
    )

    const unsubAtend = onSnapshot(qAtendimentos, (snap) => {
      const dados = snap.docs.map(doc => doc.data())
      setAtendimentos(dados)
    })

    const qAvaliacoes = query(collection(db, "avaliacoes"))
    
    const unsubAval = onSnapshot(qAvaliacoes, (snap) => {
      const dados = snap.docs.map(doc => doc.data())
      setAvaliacoes(dados)
      setLoading(false)
    })

    return () => {
      unsubAtend()
      unsubAval()
    }
  }, [])

  // CORREÇÃO 2: Agora filtramos pelo NOME do barbeiro, que é como está salvo no banco
  const obterMetricasServicos = (nomeBarbeiro) => {
    // Filtramos usando a chave 'barbeiro', que guarda o nome do profissional
    const lista = atendimentos.filter(a => a.barbeiro === nomeBarbeiro)
    const contagem = {}

    lista.forEach(atend => {
      const nomeServico = atend.servico || "Serviço Padrão"
      contagem[nomeServico] = (contagem[nomeServico] || 0) + 1
    })

    const servicosOrdenados = Object.entries(contagem).sort((a, b) => b[1] - a[1])
    
    return {
      total: lista.length,
      ranking: servicosOrdenados,
      principal: servicosOrdenados.length > 0 ? servicosOrdenados[0][0] : 'Nenhum'
    }
  }

  // Calcula a média e total de avaliações NPS do barbeiro
  const obterMetricasAvaliacoes = (nomeBarbeiro) => {
    const listaAvaliacoes = avaliacoes.filter(a => a.barbeiro === nomeBarbeiro)
    
    if (listaAvaliacoes.length === 0) return { media: 0, total: 0 }

    const soma = listaAvaliacoes.reduce((acc, curr) => acc + curr.nota, 0)
    const media = (soma / listaAvaliacoes.length).toFixed(1)

    return {
      media: parseFloat(media),
      total: listaAvaliacoes.length
    }
  }

  // Desenha as 5 estrelas (Cheias, Meias ou Vazias)
  const renderizarEstrelas = (media) => {
    const estrelas = []
    const cheias = Math.floor(media)
    const meia = media - cheias >= 0.5 ? 1 : 0
    const vazias = 5 - cheias - meia

    // Estrelas Preenchidas (Amarelas)
    for (let i = 0; i < cheias; i++) estrelas.push(<Star key={`c-${i}`} size={16} fill="currentColor" className="text-yellow-500" />)
    // Meia Estrela (Amarela)
    if (meia) estrelas.push(<StarHalf key="m" size={16} fill="currentColor" className="text-yellow-500" />)
    // Estrelas Vazias (Cinzas)
    for (let i = 0; i < vazias; i++) estrelas.push(<Star key={`v-${i}`} size={16} className="text-gray-500 opacity-30" />)

    return estrelas
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      
      {loading ? (
        <div className="py-20 text-center font-black uppercase text-xs tracking-widest opacity-40">
          Carregando histórico e avaliações...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {barbeiros.map(b => {
            // CORREÇÃO: Passando o b.nome ao invés do b.id para bater com os dados da agenda
            const metrics = obterMetricasServicos(b.nome)
            const nps = obterMetricasAvaliacoes(b.nome) 

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
                <div className="pt-6 border-t border-dashed text-center" style={{ borderColor: 'var(--cor-borda)' }}>
                  <p className="text-5xl font-black italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                    {metrics.total}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-6">Atendimentos Totais</p>
                </div>

                {/* ⭐ BLOCO DE NPS (AVALIAÇÕES) */}
                <div className="p-5 rounded-3xl border flex items-center justify-between" 
                     style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50">NPS / Qualidade</p>
                    <div className="flex text-yellow-500 mt-1">
                      {renderizarEstrelas(nps.media)}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black italic" style={{ color: 'var(--cor-texto-principal)' }}>
                      {nps.media > 0 ? nps.media : '--'}
                    </p>
                    <p className="text-[9px] font-bold uppercase opacity-40">
                      {nps.total} {nps.total === 1 ? 'Voto' : 'Votos'}
                    </p>
                  </div>
                </div>

                {/* Lista de Serviços Detalhada */}
                <div className="space-y-3 pt-2">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center gap-2">
                    <PieChart size={12} /> Detalhamento por serviço
                  </p>
                  
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {metrics.ranking.length > 0 ? (
                      metrics.ranking.map(([nome, qtd]) => (
                        <div key={nome} className="flex justify-between items-center p-3 rounded-2xl border border-transparent" 
                             style={{ backgroundColor: 'var(--cor-bg-geral)' }}>
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
                <div className="pt-2 border-t border-dashed mt-auto" style={{ borderColor: 'var(--cor-borda)' }}>
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-green-500 flex items-center justify-center gap-1 pt-2">
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