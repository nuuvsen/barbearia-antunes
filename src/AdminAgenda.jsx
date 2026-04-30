import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { CalendarDays, Clock, UserCheck, Trash2, User } from 'lucide-react'

const MAPA_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function AdminAgenda() {
  // FUNÇÃO PARA PEGAR O DIA EXATO DE HOJE NO FUSO LOCAL
  const pegarDiaDeHoje = () => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const dia = String(hoje.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  // ESTADOS DA AGENDA
  const [dataSelecionada, setDataSelecionada] = useState(pegarDiaDeHoje())
  const [barbeiroFiltro, setBarbeiroFiltro] = useState('Todos')
  const [agendamentos, setAgendamentos] = useState([])
  const [barbeiros, setBarbeiros] = useState([])
  const [carregando, setCarregando] = useState(false)

  // ESTADOS DO NOVO CALENDÁRIO POP-UP
  const [mostrarCalendario, setMostrarCalendario] = useState(false)
  const [mesVisivel, setMesVisivel] = useState(new Date())

  useEffect(() => {
    const obterBarbeiros = async () => {
      const snap = await getDocs(collection(db, "barbeiros"))
      setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }
    obterBarbeiros()
  }, [])

  const buscarAgendamentos = async () => {
    setCarregando(true)
    try {
      let q = query(
        collection(db, "agendamentos"),
        where("data", "==", dataSelecionada)
      )

      if (barbeiroFiltro !== 'Todos') {
        q = query(q, where("barbeiro", "==", barbeiroFiltro))
      }

      const snap = await getDocs(q)
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      const ordenados = lista.sort((a, b) => a.hora.localeCompare(b.hora))
      setAgendamentos(ordenados)
    } catch (error) {
      console.error("Erro ao buscar:", error)
    }
    setCarregando(false)
  }

  useEffect(() => {
    buscarAgendamentos()
  }, [dataSelecionada, barbeiroFiltro])

  const cancelarCorte = async (id) => {
    if (confirm("Deseja realmente cancelar este agendamento?")) {
      await deleteDoc(doc(db, "agendamentos", id))
      buscarAgendamentos() 
    }
  }

  // FORMATADOR PARA DEIXAR A DATA MAIS AMIGÁVEL NA TELA
  const formatarDataNome = (dataISO) => {
    const hojeISO = pegarDiaDeHoje()
    
    const dataAmanha = new Date()
    dataAmanha.setDate(dataAmanha.getDate() + 1)
    const amanhaISO = `${dataAmanha.getFullYear()}-${String(dataAmanha.getMonth() + 1).padStart(2, '0')}-${String(dataAmanha.getDate()).padStart(2, '0')}`

    const [ano, mes, dia] = dataISO.split('-')
    const formatoBR = `${dia}/${mes}/${ano}`

    if (dataISO === hojeISO) return <><span className="font-black" style={{ color: 'var(--cor-primaria)' }}>HOJE</span> <span className="text-xs ml-1" style={{ color: 'var(--cor-texto-secundario)' }}>({formatoBR})</span></>
    if (dataISO === amanhaISO) return <><span className="font-black" style={{ color: 'var(--cor-texto-principal)' }}>AMANHÃ</span> <span className="text-xs ml-1" style={{ color: 'var(--cor-texto-secundario)' }}>({formatoBR})</span></>
    return <span className="font-black" style={{ color: 'var(--cor-texto-principal)' }}>{formatoBR}</span>
  }

  // LÓGICA DO GRID DO CALENDÁRIO
  const primeiroDiaSemana = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1).getDay();
  const totalDiasMes = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).getDate();
  const gridDias = Array.from({ length: primeiroDiaSemana }).map(() => null).concat(
    Array.from({ length: totalDiasMes }).map((_, i) => new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), i + 1))
  );

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="mb-8">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
          Gestão de <span style={{ color: 'var(--cor-primaria)' }}>Agenda</span>
        </h1>
        <p className="text-xs font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--cor-texto-secundario)' }}>
          Visualize e gerencie os atendimentos diários
        </p>
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
        
        {/* BARRA DE FILTROS */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 p-6 rounded-3xl border" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
          
          {/* SELETOR COM CALENDÁRIO CUSTOMIZADO */}
          <div className="flex-1 relative">
            <label className="text-[10px] font-black uppercase mb-2 block tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Data da Agenda</label>
            <div 
              onClick={() => setMostrarCalendario(!mostrarCalendario)}
              className="w-full border p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:brightness-125 transition-all"
              style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}
            >
              <div className="flex items-center gap-3">
                <CalendarDays size={20} style={{ color: 'var(--cor-primaria)' }} />
                <div className="text-lg" style={{ color: 'var(--cor-texto-principal)' }}>{formatarDataNome(dataSelecionada)}</div>
              </div>
              <div className="font-bold text-xs uppercase" style={{ color: 'var(--cor-texto-secundario)' }}>
                {mostrarCalendario ? 'Fechar ▲' : 'Mudar ▼'}
              </div>
            </div>

            {/* POP-UP DO CALENDÁRIO (MODAL) */}
            {mostrarCalendario && (
              <div className="absolute top-full left-0 mt-2 w-full md:w-[320px] border p-5 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95"
                   style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                
                <div className="flex justify-between items-center mb-4">
                  <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1))} 
                          className="p-2 rounded-xl transition-all hover:opacity-70"
                          style={{ color: 'var(--cor-primaria)', backgroundColor: 'var(--cor-bg-geral)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--cor-texto-principal)' }}>
                    {NOMES_MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}
                  </span>
                  <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1))} 
                          className="p-2 rounded-xl transition-all hover:opacity-70"
                          style={{ color: 'var(--cor-primaria)', backgroundColor: 'var(--cor-bg-geral)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {MAPA_DIAS.map(d => <span key={d} className="text-[10px] font-black uppercase" style={{ color: 'var(--cor-texto-secundario)' }}>{d}</span>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {gridDias.map((dia, idx) => {
                    if (!dia) return <div key={`empty-${idx}`} />
                    const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
                    const isSelecionado = iso === dataSelecionada
                    const isHoje = iso === pegarDiaDeHoje()

                    let estiloBotao = { color: 'var(--cor-texto-secundario)' }
                    if (isSelecionado) {
                      estiloBotao = { backgroundColor: 'var(--cor-primaria)', color: '#ffffff' }
                    } else if (isHoje) {
                      estiloBotao = { backgroundColor: 'transparent', color: 'var(--cor-primaria)', border: '1px solid var(--cor-primaria)' }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setDataSelecionada(iso)
                          setMostrarCalendario(false)
                        }}
                        className="aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all hover:brightness-125 hover:opacity-80"
                        style={estiloBotao}
                      >
                        {dia.getDate()}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase mb-2 block tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Filtrar por Barbeiro</label>
            <select 
              value={barbeiroFiltro}
              onChange={e => setBarbeiroFiltro(e.target.value)}
              className="w-full border p-4 rounded-2xl outline-none font-bold appearance-none transition-all focus:brightness-125"
              style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
            >
              <option value="Todos">Todos os Barbeiros</option>
              {barbeiros.map(b => (
                <option key={b.id} value={b.nome}>{b.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* LISTA DE AGENDAMENTOS */}
        <div className="space-y-4">
          {carregando ? (
            <div className="text-center py-20 font-black animate-pulse uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>
              Carregando Agenda...
            </div>
          ) : agendamentos.length > 0 ? (
            agendamentos.map(item => (
              <div key={item.id} className="p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-center gap-6 group hover:brightness-110 transition-all"
                   style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                <div className="flex items-center gap-6 w-full">
                  <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg"
                       style={{ backgroundColor: 'var(--cor-primaria)', color: '#ffffff' }}>
                    <span className="text-2xl font-black">{item.hora}</span>
                    <Clock size={14} className="opacity-70" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--cor-primaria)' }}>{item.servico}</p>
                    <h3 className="text-xl font-black uppercase italic truncate" style={{ color: 'var(--cor-texto-principal)' }}>{item.clienteNome}</h3>
                    <div className="flex gap-4 mt-2">
                      <span className="text-[10px] flex items-center gap-1 font-bold uppercase" style={{ color: 'var(--cor-texto-secundario)' }}>
                        <User size={12} style={{ color: 'var(--cor-primaria)' }} /> {item.barbeiro}
                      </span>
                      <span className="text-[10px] flex items-center gap-1 font-bold uppercase" style={{ color: 'var(--cor-texto-secundario)' }}>
                         📱 {item.clienteTelefone}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => cancelarCorte(item.id)}
                  className="p-4 rounded-2xl transition-all hover:scale-105 hover:bg-red-500/10"
                  style={{ backgroundColor: 'var(--cor-bg-geral)', color: 'var(--cor-texto-secundario)', border: '1px solid var(--cor-borda)' }}
                  title="Cancelar Agendamento"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))
          ) : (
            <div className="border rounded-3xl p-20 flex flex-col items-center justify-center text-center"
                 style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
              <UserCheck size={48} className="opacity-30 mb-4" style={{ color: 'var(--cor-texto-secundario)' }} />
              <h3 className="text-lg font-black uppercase" style={{ color: 'var(--cor-texto-secundario)' }}>Nenhum corte marcado</h3>
              <p className="opacity-60 text-xs mt-1" style={{ color: 'var(--cor-texto-secundario)' }}>Nenhum agendamento encontrado para o dia selecionado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}