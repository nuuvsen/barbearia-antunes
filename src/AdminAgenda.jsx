import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { CalendarDays, Clock, UserCheck, Trash2, User, ChevronLeft, ChevronRight } from 'lucide-react'
import Swal from 'sweetalert2'

const MAPA_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Configurações do Scheduler
const HORA_INICIO = 8; // 08:00
const HORA_FIM = 20; // 20:00
const PIXELS_POR_MINUTO = 3; // Escala vertical: 1 min = 3px (30 min = 90px)

// Utilitários de Data para evitar problemas de fuso horário
const parseDataLocal = (dataISO) => new Date(dataISO + 'T12:00:00');
const formatarDataISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const gerarHorarios = () => {
  const horarios = [];
  for (let h = HORA_INICIO; h <= HORA_FIM; h++) {
    horarios.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== HORA_FIM) horarios.push(`${String(h).padStart(2, '0')}:30`);
  }
  return horarios;
}

export default function AdminAgenda() {
  const pegarDiaDeHoje = () => formatarDataISO(new Date());

  // ESTADOS PRINCIPAIS
  const [dataSelecionada, setDataSelecionada] = useState(pegarDiaDeHoje())
  const [barbeiroFiltro, setBarbeiroFiltro] = useState('Todos')
  const [visualizacao, setVisualizacao] = useState('Dia') // Dia, Semana, Mês
  const [agendamentos, setAgendamentos] = useState([])
  const [barbeiros, setBarbeiros] = useState([])
  const [carregando, setCarregando] = useState(false)

  const [mostrarCalendario, setMostrarCalendario] = useState(false)
  const [mesVisivel, setMesVisivel] = useState(new Date())

  const horariosGrid = gerarHorarios();

  useEffect(() => {
    const obterBarbeiros = async () => {
      const snap = await getDocs(collection(db, "barbeiros"))
      setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }
    obterBarbeiros()
  }, [])

  // Calcula o intervalo de datas que precisa ser buscado no Firebase
  const obterLimitesDaVisualizacao = () => {
    const dataObj = parseDataLocal(dataSelecionada);
    
    if (visualizacao === 'Dia') {
      return { start: dataSelecionada, end: dataSelecionada };
    } 
    else if (visualizacao === 'Semana') {
      const diaSemana = dataObj.getDay();
      const start = new Date(dataObj);
      start.setDate(dataObj.getDate() - diaSemana);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: formatarDataISO(start), end: formatarDataISO(end) };
    } 
    else if (visualizacao === 'Mês') {
      const start = new Date(dataObj.getFullYear(), dataObj.getMonth(), 1);
      const end = new Date(dataObj.getFullYear(), dataObj.getMonth() + 1, 0);
      return { start: formatarDataISO(start), end: formatarDataISO(end) };
    }
  };

  const buscarAgendamentos = async () => {
    setCarregando(true)
    try {
      const limites = obterLimitesDaVisualizacao();
      
      const q = query(
        collection(db, "agendamentos"),
        where("data", ">=", limites.start),
        where("data", "<=", limites.end)
      )

      const snap = await getDocs(q)
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      // Filtra por barbeiro em memória (evita necessidade de índices compostos no Firebase)
      if (barbeiroFiltro !== 'Todos') {
        lista = lista.filter(item => item.barbeiro === barbeiroFiltro);
      }

      // Ordena por hora
      const ordenados = lista.sort((a, b) => a.hora.localeCompare(b.hora))
      setAgendamentos(ordenados)
    } catch (error) {
      console.error("Erro ao buscar:", error)
    }
    setCarregando(false)
  }

  useEffect(() => {
    buscarAgendamentos()
  }, [dataSelecionada, barbeiroFiltro, visualizacao])

  const cancelarCorte = async (id) => {
    if (!navigator.onLine) {
      Swal.fire({
        icon: 'error',
        title: 'Sem Conexão!',
        text: 'Você está offline. Conecte-se à internet.',
        confirmButtonColor: 'var(--cor-primaria)'
      });
      return; 
    }

    // NOVA LÓGICA DE EXCLUSÃO COM SWEETALERT2
    const confirmacao = await Swal.fire({
      title: 'Tem certeza?',
      text: "Deseja realmente cancelar este agendamento? Esta ação não pode ser desfeita.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33', // Vermelho para a ação destrutiva
      cancelButtonColor: 'var(--cor-texto-secundario)', // Cinza para cancelar
      confirmButtonText: 'Sim, cancelar!',
      cancelButtonText: 'Não, manter'
    });

    if (confirmacao.isConfirmed) {
      try {
        await deleteDoc(doc(db, "agendamentos", id));
        
        Swal.fire({
          title: 'Cancelado!',
          text: 'O agendamento foi removido com sucesso.',
          icon: 'success',
          confirmButtonColor: 'var(--cor-primaria)'
        });

        buscarAgendamentos(); 
      } catch (error) {
        console.error("Erro ao cancelar:", error);
        Swal.fire({
          title: 'Erro!',
          text: 'Não foi possível cancelar o agendamento.',
          icon: 'error',
          confirmButtonColor: 'var(--cor-primaria)'
        });
      }
    }
  }

  // LÓGICA DE POSICIONAMENTO NO GRID (Dia e Semana)
  const calcularTop = (horaString) => {
    if (!horaString) return 0;
    const [h, m] = horaString.split(':').map(Number);
    const minutosDesdeInicio = (h - HORA_INICIO) * 60 + m;
    return minutosDesdeInicio * PIXELS_POR_MINUTO;
  };

  const calcularHeight = (duracaoMinutos = 30) => {
    return duracaoMinutos * PIXELS_POR_MINUTO;
  };

  // NAVEGAÇÃO DE DATAS
  const mudarData = (dias) => {
    const nova = parseDataLocal(dataSelecionada);
    nova.setDate(nova.getDate() + dias);
    setDataSelecionada(formatarDataISO(nova));
  }

  const formatarDataNome = (dataISO) => {
    const hojeISO = pegarDiaDeHoje()
    const [ano, mes, dia] = dataISO.split('-')
    const formatoBR = `${dia}/${mes}/${ano}`

    if (dataISO === hojeISO) return <><span className="font-black" style={{ color: 'var(--cor-primaria)' }}>HOJE</span></>
    return <span className="font-black" style={{ color: 'var(--cor-texto-principal)' }}>{formatoBR}</span>
  }

  // ====== RENDERIZAÇÃO: VISUALIZAÇÃO POR DIA ======
  const renderVisaoDia = () => {
    const barbeirosExibidos = barbeiroFiltro === 'Todos' ? barbeiros : barbeiros.filter(b => b.nome === barbeiroFiltro);
    
    return (
      <div className="overflow-x-auto bg-opacity-50" style={{ backgroundColor: 'var(--cor-card)' }}>
        <div className="min-w-[800px] flex relative pb-4">
          {/* Eixo Y - Horários */}
          <div className="w-20 flex-shrink-0 border-r" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)', zIndex: 30 }}>
            <div className="h-14 border-b flex items-center justify-center sticky top-0" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)' }}>
              <Clock size={16} style={{ color: 'var(--cor-texto-secundario)' }} />
            </div>
            <div className="relative">
              {horariosGrid.map((hora, idx) => (
                <div key={idx} className="border-b flex items-start justify-center text-xs font-bold pt-2" style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}>{hora}</div>
              ))}
            </div>
          </div>

          {/* Eixo X - Barbeiros */}
          {barbeirosExibidos.map((barbeiro) => {
            const ags = agendamentos.filter(ag => ag.barbeiro === barbeiro.nome);
            return (
              <div key={barbeiro.id} className="flex-1 min-w-[250px] border-r relative" style={{ borderColor: 'var(--cor-borda)' }}>
                <div className="h-14 border-b flex items-center justify-center gap-2 font-black uppercase tracking-widest sticky top-0 z-20 shadow-sm" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
                  <User size={16} style={{ color: 'var(--cor-primaria)' }} /> {barbeiro.nome}
                </div>
                <div className="relative w-full">
                  {horariosGrid.map((_, i) => (
                    <div key={i} className="border-b border-opacity-30 w-full" style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'var(--cor-borda)' }}></div>
                  ))}
                  {ags.map(item => renderBlocoAgendamento(item))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ====== RENDERIZAÇÃO: VISUALIZAÇÃO POR SEMANA ======
  const renderVisaoSemana = () => {
    const limites = obterLimitesDaVisualizacao();
    const startObj = parseDataLocal(limites.start);
    const diasSemanaISO = [];
    for(let i=0; i<7; i++) {
      const temp = new Date(startObj);
      temp.setDate(startObj.getDate() + i);
      diasSemanaISO.push(formatarDataISO(temp));
    }

    return (
      <div className="overflow-x-auto bg-opacity-50" style={{ backgroundColor: 'var(--cor-card)' }}>
        <div className="min-w-[1000px] flex relative pb-4">
          {/* Eixo Y - Horários */}
          <div className="w-20 flex-shrink-0 border-r" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)', zIndex: 30 }}>
            <div className="h-14 border-b flex items-center justify-center sticky top-0" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)' }}>
              <Clock size={16} style={{ color: 'var(--cor-texto-secundario)' }} />
            </div>
            <div className="relative">
              {horariosGrid.map((hora, idx) => (
                <div key={idx} className="border-b flex items-start justify-center text-xs font-bold pt-2" style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}>{hora}</div>
              ))}
            </div>
          </div>

          {/* Eixo X - Dias da Semana */}
          {diasSemanaISO.map((diaISO, index) => {
            const ags = agendamentos.filter(ag => ag.data === diaISO);
            const [ano, mes, dia] = diaISO.split('-');
            const isHoje = diaISO === pegarDiaDeHoje();

            return (
              <div key={diaISO} className="flex-1 min-w-[150px] border-r relative" style={{ borderColor: 'var(--cor-borda)', backgroundColor: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.02)' : 'transparent' }}>
                <div className={`h-14 border-b flex flex-col items-center justify-center sticky top-0 z-20 shadow-sm ${isHoje ? 'border-b-4' : ''}`} style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: isHoje ? 'var(--cor-primaria)' : 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>{MAPA_DIAS[index]}</span>
                  <span className="font-black">{dia}/{mes}</span>
                </div>
                <div className="relative w-full">
                  {horariosGrid.map((_, i) => (
                    <div key={i} className="border-b border-opacity-30 w-full" style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'var(--cor-borda)' }}></div>
                  ))}
                  {ags.map(item => renderBlocoAgendamento(item))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ====== RENDERIZAÇÃO: VISUALIZAÇÃO POR MÊS ======
  const renderVisaoMes = () => {
    const limites = obterLimitesDaVisualizacao();
    const dataObj = parseDataLocal(dataSelecionada);
    const startOfMonth = new Date(dataObj.getFullYear(), dataObj.getMonth(), 1);
    const endOfMonth = new Date(dataObj.getFullYear(), dataObj.getMonth() + 1, 0);
    
    const diasGrid = [];
    for(let i=0; i<startOfMonth.getDay(); i++) diasGrid.push(null); // Padding inicial
    for(let i=1; i<=endOfMonth.getDate(); i++) {
      diasGrid.push(formatarDataISO(new Date(dataObj.getFullYear(), dataObj.getMonth(), i)));
    }
    const diasFaltantes = 42 - diasGrid.length; // Garante 6 linhas no grid (6 * 7 = 42)
    for(let i=0; i<diasFaltantes; i++) diasGrid.push(null); // Padding final

    return (
      <div className="w-full bg-opacity-50" style={{ backgroundColor: 'var(--cor-card)' }}>
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--cor-borda)' }}>
          {MAPA_DIAS.map(d => (
            <div key={d} className="p-3 text-center text-[10px] font-black uppercase tracking-widest border-r" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {diasGrid.map((diaISO, idx) => {
            if (!diaISO) return <div key={idx} className="min-h-[120px] p-2 border-r border-b opacity-20" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-bg-geral)' }}></div>;
            
            const ags = agendamentos.filter(ag => ag.data === diaISO);
            const isHoje = diaISO === pegarDiaDeHoje();
            const [ano, mes, dia] = diaISO.split('-');

            return (
              <div key={diaISO} onClick={() => { setDataSelecionada(diaISO); setVisualizacao('Dia'); }} className="min-h-[120px] p-2 border-r border-b cursor-pointer transition-all hover:bg-black/5" style={{ borderColor: 'var(--cor-borda)', backgroundColor: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.05)' : 'transparent' }}>
                <div className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-full mb-2 ${isHoje ? 'text-white' : ''}`} style={{ backgroundColor: isHoje ? 'var(--cor-primaria)' : 'transparent', color: isHoje ? '#fff' : 'var(--cor-texto-principal)' }}>
                  {dia}
                </div>
                <div className="space-y-1">
                  {ags.slice(0, 4).map(item => (
                    <div key={item.id} className="text-[9px] font-bold p-1 rounded overflow-hidden truncate border-l-2" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-primaria)', color: 'var(--cor-texto-principal)' }}>
                      {item.hora} - {item.clienteNome}
                    </div>
                  ))}
                  {ags.length > 4 && (
                    <div className="text-[10px] font-black text-center mt-1" style={{ color: 'var(--cor-primaria)' }}>+{ags.length - 4} mais</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Componente reutilizável para o card de agendamento (usado em Dia e Semana)
  const renderBlocoAgendamento = (item) => {
    const topPx = calcularTop(item.hora);
    const heightPx = calcularHeight(item.duracao || 30);
    return (
      <div key={item.id} className="absolute left-1 right-1 rounded-xl p-2 shadow-lg border overflow-hidden group transition-all hover:scale-[1.02] hover:z-50 flex flex-col justify-start"
           style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-primaria)', borderLeftWidth: '4px' }}>
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-black leading-none" style={{ color: 'var(--cor-texto-principal)' }}>{item.hora}</span>
          <button onClick={() => cancelarCorte(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:scale-110">
            <Trash2 size={12} />
          </button>
        </div>
        <h3 className="text-xs font-black uppercase italic truncate leading-tight mt-1" style={{ color: 'var(--cor-texto-principal)' }}>{item.clienteNome}</h3>
        <p className="text-[9px] font-bold uppercase truncate leading-none mt-0.5" style={{ color: 'var(--cor-primaria)' }}>{item.servico}</p>
        {visualizacao === 'Semana' && barbeiroFiltro === 'Todos' && (
           <p className="text-[8px] font-bold uppercase truncate mt-auto opacity-70" style={{ color: 'var(--cor-texto-secundario)' }}><User size={8} className="inline mr-1"/>{item.barbeiro}</p>
        )}
      </div>
    )
  }

  // Pop-up do mini calendário (Mantido do original para não quebrar seu design)
  const primeiroDiaSemanaCalendario = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1).getDay();
  const totalDiasMesCalendario = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).getDate();
  const gridDiasCalendario = Array.from({ length: primeiroDiaSemanaCalendario }).map(() => null).concat(
    Array.from({ length: totalDiasMesCalendario }).map((_, i) => new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), i + 1))
  );

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
            Gestão de <span style={{ color: 'var(--cor-primaria)' }}>Agenda</span>
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--cor-texto-secundario)' }}>
            Visualize e gerencie os atendimentos
          </p>
        </div>

        <div className="flex border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)' }}>
          {['Dia', 'Semana', 'Mês'].map(vis => (
            <button key={vis} onClick={() => setVisualizacao(vis)} className="px-6 py-2 text-xs font-black uppercase transition-all"
              style={{ backgroundColor: visualizacao === vis ? 'var(--cor-primaria)' : 'transparent', color: visualizacao === vis ? '#ffffff' : 'var(--cor-texto-secundario)' }}>
              {vis}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col md:flex-row gap-4 mb-8 p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
          
          <div className="flex-[2] relative">
            <label className="text-[10px] font-black uppercase mb-2 block tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Data Base / Navegação</label>
            <div className="flex gap-2 items-center">
              <button onClick={() => mudarData(visualizacao === 'Mês' ? -30 : visualizacao === 'Semana' ? -7 : -1)} className="p-4 border rounded-2xl hover:brightness-125 transition-all" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}><ChevronLeft size={20}/></button>
              
              <div onClick={() => setMostrarCalendario(!mostrarCalendario)} className="flex-1 border p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:brightness-125 transition-all" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                <div className="flex items-center gap-3">
                  <CalendarDays size={20} style={{ color: 'var(--cor-primaria)' }} />
                  <div className="text-lg">{formatarDataNome(dataSelecionada)}</div>
                </div>
              </div>

              <button onClick={() => mudarData(visualizacao === 'Mês' ? 30 : visualizacao === 'Semana' ? 7 : 1)} className="p-4 border rounded-2xl hover:brightness-125 transition-all" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}><ChevronRight size={20}/></button>
            </div>

            {/* POP-UP DO CALENDÁRIO */}
            {mostrarCalendario && (
              <div className="absolute top-full left-14 mt-2 w-[320px] border p-5 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                <div className="flex justify-between items-center mb-4">
                  <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1))} className="p-2 rounded-xl transition-all hover:opacity-70" style={{ color: 'var(--cor-primaria)', backgroundColor: 'var(--cor-bg-geral)' }}><ChevronLeft size={20}/></button>
                  <span className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--cor-texto-principal)' }}>{NOMES_MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}</span>
                  <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1))} className="p-2 rounded-xl transition-all hover:opacity-70" style={{ color: 'var(--cor-primaria)', backgroundColor: 'var(--cor-bg-geral)' }}><ChevronRight size={20}/></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {MAPA_DIAS.map(d => <span key={d} className="text-[10px] font-black uppercase" style={{ color: 'var(--cor-texto-secundario)' }}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {gridDiasCalendario.map((dia, idx) => {
                    if (!dia) return <div key={`empty-${idx}`} />
                    const iso = formatarDataISO(dia);
                    const isSelecionado = iso === dataSelecionada;
                    const isHoje = iso === pegarDiaDeHoje();
                    let estiloBotao = { color: 'var(--cor-texto-secundario)' };
                    if (isSelecionado) estiloBotao = { backgroundColor: 'var(--cor-primaria)', color: '#ffffff' };
                    else if (isHoje) estiloBotao = { backgroundColor: 'transparent', color: 'var(--cor-primaria)', border: '1px solid var(--cor-primaria)' };

                    return (
                      <button key={idx} onClick={() => { setDataSelecionada(iso); setMostrarCalendario(false); }} className="aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all hover:brightness-125 hover:opacity-80" style={estiloBotao}>
                        {dia.getDate()}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-[1.5]">
            <label className="text-[10px] font-black uppercase mb-2 block tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Filtrar por Barbeiro</label>
            <select value={barbeiroFiltro} onChange={e => setBarbeiroFiltro(e.target.value)} className="w-full border p-4 h-[58px] rounded-2xl outline-none font-bold appearance-none transition-all focus:brightness-125" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
              <option value="Todos">Todos os Barbeiros</option>
              {barbeiros.map(b => (
                <option key={b.id} value={b.nome}>{b.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CONTÊINER DO SCHEDULER */}
        <div className="rounded-3xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--cor-borda)' }}>
          {carregando ? (
            <div className="text-center py-32 font-black animate-pulse uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)', backgroundColor: 'var(--cor-card)' }}>
              Buscando dados no servidor...
            </div>
          ) : (
            <>
              {visualizacao === 'Dia' && renderVisaoDia()}
              {visualizacao === 'Semana' && renderVisaoSemana()}
              {visualizacao === 'Mês' && renderVisaoMes()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}