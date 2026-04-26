import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'
import AdminHorarios from './AdminHorarios'
import { CalendarDays, Clock, UserCheck, Trash2, User } from 'lucide-react'

const MAPA_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function AdminAgenda() {
  const [abaAtiva, setAbaAtiva] = useState('diaria')
  
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

    if (dataISO === hojeISO) return <><span className="text-red-500 font-black">HOJE</span> <span className="text-gray-500 text-xs ml-1">({formatoBR})</span></>
    if (dataISO === amanhaISO) return <><span className="text-white font-black">AMANHÃ</span> <span className="text-gray-500 text-xs ml-1">({formatoBR})</span></>
    return <span className="text-white font-black">{formatoBR}</span>
  }

  // LÓGICA DO GRID DO CALENDÁRIO
  const primeiroDiaSemana = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1).getDay();
  const totalDiasMes = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).getDate();
  const gridDias = Array.from({ length: primeiroDiaSemana }).map(() => null).concat(
    Array.from({ length: totalDiasMes }).map((_, i) => new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), i + 1))
  );

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-8 text-white">
        Gestão de <span className="text-red-600">Agenda</span>
      </h1>

      {/* MENU DE ABAS */}
      <div className="flex flex-wrap gap-4 mb-10 border-b border-[#1f1f1f] pb-6">
        <button
          onClick={() => setAbaAtiva('diaria')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${
            abaAtiva === 'diaria' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-[#111] text-gray-500 border border-[#1f1f1f] hover:bg-[#1a1a1a] hover:text-white'
          }`}
        >
          <CalendarDays size={18} /> Agenda do Dia
        </button>

        <button
          onClick={() => setAbaAtiva('horarios')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${
            abaAtiva === 'horarios' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-[#111] text-gray-500 border border-[#1f1f1f] hover:bg-[#1a1a1a] hover:text-white'
          }`}
        >
          <Clock size={18} /> Horários Flexíveis
        </button>
      </div>

      {/* CONTEÚDO */}
      {abaAtiva === 'diaria' && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          
          {/* BARRA DE FILTROS */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 bg-[#111] p-6 rounded-3xl border border-[#1f1f1f]">
            
            {/* NOVO SELETOR COM CALENDÁRIO CUSTOMIZADO */}
            <div className="flex-1 relative">
              <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block tracking-widest">Data da Agenda</label>
              <div 
                onClick={() => setMostrarCalendario(!mostrarCalendario)}
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-red-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CalendarDays size={20} className="text-red-500" />
                  <div className="text-lg">{formatarDataNome(dataSelecionada)}</div>
                </div>
                <div className="text-gray-600 font-bold text-xs uppercase">{mostrarCalendario ? 'Fechar ▲' : 'Mudar ▼'}</div>
              </div>

              {/* O POP-UP DO CALENDÁRIO */}
              {mostrarCalendario && (
                <div className="absolute top-full left-0 mt-2 w-full md:w-[320px] bg-[#242424] border border-[#333] p-5 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                  
                  {/* Navegação de Meses */}
                  <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1))} className="text-red-500 hover:bg-[#111] p-2 rounded-xl transition-all">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <span className="font-black uppercase tracking-widest text-sm text-white">
                      {NOMES_MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}
                    </span>
                    <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1))} className="text-red-500 hover:bg-[#111] p-2 rounded-xl transition-all">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>

                  {/* Dias da semana */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {MAPA_DIAS.map(d => <span key={d} className="text-[10px] text-gray-500 font-black uppercase">{d}</span>)}
                  </div>

                  {/* Grade de dias */}
                  <div className="grid grid-cols-7 gap-1">
                    {gridDias.map((dia, idx) => {
                      if (!dia) return <div key={`empty-${idx}`} />
                      
                      const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
                      const isSelecionado = iso === dataSelecionada
                      const isHoje = iso === pegarDiaDeHoje()

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setDataSelecionada(iso)
                            setMostrarCalendario(false) // Fecha o pop-up ao escolher a data
                          }}
                          className={`aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all 
                            ${isSelecionado ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 
                              isHoje ? 'bg-[#111] text-red-500 border border-red-600/30 hover:bg-red-600 hover:text-white' : 
                              'text-gray-300 hover:bg-[#111] hover:text-white'}`}
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
              <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block tracking-widest">Filtrar por Barbeiro</label>
              <select 
                value={barbeiroFiltro}
                onChange={e => setBarbeiroFiltro(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold appearance-none"
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
              <div className="text-center py-20 text-gray-500 font-black animate-pulse uppercase tracking-widest">Carregando Agenda...</div>
            ) : agendamentos.length > 0 ? (
              agendamentos.map(item => (
                <div key={item.id} className="bg-[#111] p-6 rounded-3xl border border-[#1f1f1f] flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-red-600/50 transition-all">
                  <div className="flex items-center gap-6 w-full">
                    <div className="bg-red-600 text-white w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-red-600/20">
                      <span className="text-2xl font-black">{item.hora}</span>
                      <Clock size={14} className="opacity-50" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-1">{item.servico}</p>
                      <h3 className="text-xl font-black text-white uppercase italic truncate">{item.clienteNome}</h3>
                      <div className="flex gap-4 mt-2">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1 font-bold uppercase">
                          <User size={12} className="text-red-600" /> {item.barbeiro}
                        </span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1 font-bold uppercase">
                           📱 {item.clienteTelefone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => cancelarCorte(item.id)}
                    className="bg-[#1c1c1c] p-4 rounded-2xl text-gray-500 hover:bg-red-600 hover:text-white transition-all group"
                    title="Cancelar Agendamento"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-[#111] border border-[#1f1f1f] rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                <UserCheck size={48} className="text-[#222] mb-4" />
                <h3 className="text-lg font-black uppercase text-gray-700">Nenhum corte marcado</h3>
                <p className="text-gray-500 text-xs mt-1">Nenhum agendamento encontrado para o dia selecionado.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {abaAtiva === 'horarios' && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <AdminHorarios />
        </div>
      )}
    </div>
  )
}