import { useState, useEffect, useMemo } from 'react'
import { db } from './firebase'
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Star, MessageSquareText, Search, CheckCircle2, AlertTriangle } from 'lucide-react'
import Carregando from './Carregando'

export default function AdminAvaliacoes({ barbeiros = [] }) {
  const [avaliacoes, setAvaliacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos')
  const [filtroNota, setFiltroNota] = useState('todas') // todas | negativas | neutras | positivas

  useEffect(() => {
    setCarregando(true)
    const q = query(collection(db, "avaliacoes"))
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      setAvaliacoes(lista)
      setCarregando(false)
    }, (erro) => {
      console.error("Erro ao carregar avaliações:", erro)
      toast.error("Erro ao carregar avaliações.")
      setCarregando(false)
    })
    return () => unsub()
  }, [])

  const marcarComoResolvida = async (item) => {
    try {
      await updateDoc(doc(db, "avaliacoes", item.id), { lida: true })
      toast.success("Avaliação marcada como resolvida.")
    } catch (erro) {
      console.error("Erro ao marcar avaliação:", erro)
      toast.error("Erro ao marcar avaliação como resolvida.")
    }
  }

  const formatarDataHora = (iso) => {
    if (!iso) return '--'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '--'
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }

  const renderizarEstrelas = (nota) => {
    const notaArredondada = Math.round(Number(nota) || 0)
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={14} fill={i < notaArredondada ? 'currentColor' : 'none'}
            className={i < notaArredondada ? 'text-yellow-500' : 'text-gray-500 opacity-30'} />
    ))
  }

  const mediaGeral = useMemo(() => {
    if (avaliacoes.length === 0) return 0
    return (avaliacoes.reduce((acc, a) => acc + Number(a.nota || 0), 0) / avaliacoes.length).toFixed(1)
  }, [avaliacoes])

  // "Pendente" = nota ruim (1 ou 2) que ainda não foi marcada como resolvida pelo admin —
  // é o mesmo critério usado pro alerta/badge global em Admin.jsx, então os dois batem.
  const negativasPendentes = useMemo(() =>
    avaliacoes.filter(a => Number(a.nota) <= 2 && !a.lida).length
  , [avaliacoes])

  const avaliacoesFiltradas = avaliacoes
    .filter(a => filtroBarbeiro === 'todos' ? true : a.barbeiro === filtroBarbeiro)
    .filter(a => {
      if (filtroNota === 'negativas') return Number(a.nota) <= 2
      if (filtroNota === 'neutras') return Number(a.nota) === 3
      if (filtroNota === 'positivas') return Number(a.nota) >= 4
      return true
    })
    .filter(a => (a.clienteNome || '').toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-8">

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl border shadow-sm bg-[var(--cor-card)] border-[var(--cor-borda)] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Star size={100} />
          </div>
          <p className="text-xs uppercase font-black opacity-50 mb-2 text-[var(--cor-texto-secundario)]">Nota Média Geral</p>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-black text-[var(--cor-texto-principal)]">{avaliacoes.length > 0 ? mediaGeral : '--'}</h2>
            {avaliacoes.length > 0 && <div className="flex text-yellow-500">{renderizarEstrelas(mediaGeral)}</div>}
          </div>
        </div>

        <div className="p-6 rounded-3xl border shadow-sm bg-[var(--cor-card)] border-[var(--cor-borda)]">
          <p className="text-xs uppercase font-black opacity-50 mb-2 text-[var(--cor-texto-secundario)]">Total de Avaliações</p>
          <h2 className="text-4xl font-black text-[var(--cor-texto-principal)]">{avaliacoes.length}</h2>
        </div>

        <div className="p-6 rounded-3xl border shadow-sm bg-[var(--cor-card)]"
             style={{ borderColor: negativasPendentes > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--cor-borda)' }}>
          <p className="text-xs uppercase font-black opacity-50 mb-2 text-[var(--cor-texto-secundario)]">Negativas Pendentes</p>
          <h2 className={`text-4xl font-black ${negativasPendentes > 0 ? 'text-red-500' : 'text-[var(--cor-texto-principal)]'}`}>
            {negativasPendentes}
          </h2>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-[var(--cor-texto-secundario)]" />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-[var(--cor-card)] border border-[var(--cor-borda)] pl-11 pr-4 py-3 rounded-xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] font-bold transition-all shadow-lg"
          />
        </div>

        <select value={filtroBarbeiro} onChange={(e) => setFiltroBarbeiro(e.target.value)}
                className="bg-[var(--cor-card)] border border-[var(--cor-borda)] px-4 py-3 rounded-xl text-[var(--cor-texto-principal)] outline-none font-bold text-sm">
          <option value="todos">Todos os barbeiros</option>
          {barbeiros.map(b => <option key={b.id} value={b.nome}>{b.nome}</option>)}
        </select>

        <select value={filtroNota} onChange={(e) => setFiltroNota(e.target.value)}
                className="bg-[var(--cor-card)] border border-[var(--cor-borda)] px-4 py-3 rounded-xl text-[var(--cor-texto-principal)] outline-none font-bold text-sm">
          <option value="todas">Todas as notas</option>
          <option value="positivas">Positivas (4-5)</option>
          <option value="neutras">Neutras (3)</option>
          <option value="negativas">Negativas (1-2)</option>
        </select>
      </div>

      {/* LISTA */}
      <div className="bg-[var(--cor-card)] rounded-3xl border border-[var(--cor-borda)] overflow-hidden shadow-2xl">
        {carregando ? (
          <Carregando tela={false} label="Carregando avaliações..." />
        ) : avaliacoesFiltradas.length === 0 ? (
          <div className="p-10 text-center text-[var(--cor-texto-secundario)] font-bold uppercase italic">
            {busca ? `Nenhum resultado para "${busca}".` : 'Nenhuma avaliação registrada ainda.'}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--cor-borda)' }}>
            {avaliacoesFiltradas.map(item => {
              const negativa = Number(item.nota) <= 2
              const pendente = negativa && !item.lida
              return (
                <div key={item.id}
                     className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
                     style={pendente ? { backgroundColor: 'rgba(239, 68, 68, 0.06)' } : {}}>
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                         style={{ backgroundColor: negativa ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)' }}>
                      {negativa
                        ? <AlertTriangle className="text-red-500" size={20} />
                        : <Star className="text-yellow-500" size={20} fill="currentColor" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-black uppercase text-sm tracking-tighter text-[var(--cor-texto-principal)]">{item.clienteNome || 'Cliente'}</p>
                        <div className="flex">{renderizarEstrelas(item.nota)}</div>
                        {pendente && (
                          <span className="bg-red-500/20 text-red-500 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-red-500/30">
                            Pendente
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold uppercase opacity-50 mt-1 text-[var(--cor-texto-secundario)]">
                        {item.barbeiro || 'Equipe'} • {formatarDataHora(item.data)}
                      </p>
                      {item.comentario ? (
                        <p className="text-xs mt-2 flex items-start gap-1.5 text-[var(--cor-texto-principal)]">
                          <MessageSquareText size={13} className="flex-shrink-0 mt-0.5 opacity-50" />
                          <span className="italic">"{item.comentario}"</span>
                        </p>
                      ) : (
                        <p className="text-[10px] mt-2 italic opacity-30 text-[var(--cor-texto-secundario)]">Sem comentário</p>
                      )}
                    </div>
                  </div>

                  {pendente && (
                    <button
                      onClick={() => marcarComoResolvida(item)}
                      className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all hover:opacity-90 shadow-lg whitespace-nowrap flex items-center gap-2 flex-shrink-0 bg-red-500"
                    >
                      <CheckCircle2 size={14} /> Marcar Resolvida
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
