import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { Star, Calendar, TrendingUp, Scissors, Clock } from 'lucide-react'

export default function MediaPorBarbeiro({ barbeiros }) {
  const [filtro, setFiltro] = useState('mes') // 'dia', 'mes', 'ano'
  const [atendimentos, setAtendimentos] = useState([])
  const [loading, setLoading] = useState(true)

  // Busca os atendimentos concluídos no Firebase
  useEffect(() => {
    setLoading(true)

    // Pegamos a data atual para formatar igual ao banco (YYYY-MM-DD)
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const dia = String(hoje.getDate()).padStart(2, '0')

    let dataBusca = ''
    let operador = '>='

    // Ajusta a string de busca de acordo com o filtro selecionado
    if (filtro === 'dia') {
      dataBusca = `${ano}-${mes}-${dia}`
      operador = '==' // Se for dia, a data do banco tem que ser EXATAMENTE igual
    } else if (filtro === 'mes') {
      dataBusca = `${ano}-${mes}-01`
      operador = '>=' // Se for mês, pega do dia 01 em diante
    } else if (filtro === 'ano') {
      dataBusca = `${ano}-01-01`
      operador = '>=' // Se for ano, pega do dia 01/01 em diante
    }

    // Query corrigida: Usa o campo "data" (string) ao invés de Timestamp
    const q = query(
      collection(db, "agendamentos"),
      where("status", "==", "Concluído"),
      where("data", operador, dataBusca)
    )

    const unsub = onSnapshot(q, (snap) => {
      const dados = snap.docs.map(doc => doc.data())
      setAtendimentos(dados)
      setLoading(false)
    })

    return () => unsub()
  }, [filtro])

  // Função para calcular estatísticas de cada barbeiro
  const calcularEstatisticas = (nomeBarbeiro) => {
    // CORREÇÃO: Compara com a.barbeiro (que tem o NOME) em vez de ID
    const atendimentosDoBarbeiro = atendimentos.filter(a => a.barbeiro === nomeBarbeiro)
    
    if (atendimentosDoBarbeiro.length === 0) return { principal: 'Nenhum', total: 0 }

    // Conta a frequência de cada tipo de corte
    const contagemCortes = {}
    atendimentosDoBarbeiro.forEach(atend => {
      const nomeCorte = atend.servico || 'Corte Padrão'
      contagemCortes[nomeCorte] = (contagemCortes[nomeCorte] || 0) + 1
    })

    // Descobre o corte mais frequente
    const topCorte = Object.entries(contagemCortes).sort((a, b) => b[1] - a[1])[0]

    return {
      principal: topCorte[0],
      total: atendimentosDoBarbeiro.length,
      quantidadePrincipal: topCorte[1]
    }
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* SELETOR DE PERÍODO */}
      <div className="flex justify-center md:justify-start gap-2 mb-8">
        {[
          { id: 'dia', label: 'Hoje' },
          { id: 'mes', label: 'Este Mês' },
          { id: 'ano', label: 'Este Ano' }
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setFiltro(p.id)}
            className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border"
            style={{ 
              backgroundColor: filtro === p.id ? 'var(--cor-primaria)' : 'transparent',
              borderColor: filtro === p.id ? 'var(--cor-primaria)' : 'var(--cor-borda)',
              color: filtro === p.id ? '#fff' : 'var(--cor-texto-secundario)'
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 opacity-50 font-black uppercase text-xs tracking-widest">Calculando Métricas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {barbeiros.map(b => {
            // CORREÇÃO: Passa o NOME do barbeiro pra função ao invés do ID
            const stats = calcularEstatisticas(b.nome)
            
            return (
              <div key={b.id} className="p-6 rounded-[2.5rem] border flex flex-col gap-4 transition-all hover:brightness-110" 
                   style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                       <Scissors size={20} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>{b.nome}</p>
                      <p className="text-[9px] font-bold uppercase opacity-50 tracking-widest">Especialista em {stats.principal}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black italic" style={{ color: 'var(--cor-primaria)' }}>
                      {stats.total}
                    </p>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-50">Cortes Totais</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1 flex items-center gap-1">
                      <TrendingUp size={10} /> O que mais sai
                    </p>
                    <p className="text-[10px] font-black uppercase truncate" style={{ color: 'var(--cor-texto-principal)' }}>
                      {stats.principal}
                    </p>
                  </div>
                  <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
                    <p className="text-[8px] font-black uppercase opacity-40 mb-1 flex items-center gap-1">
                      <Clock size={10} /> Desempenho
                    </p>
                    <p className="text-[10px] font-black uppercase text-green-500">
                      {stats.total > 0 ? 'Em Alta' : 'Sem Dados'}
                    </p>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}