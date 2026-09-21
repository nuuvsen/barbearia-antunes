import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, onSnapshot, query, doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { Search, X, Plus, Clock, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminPagamento from './AdminPagamento'
import Comanda from './Comanda'
import Swal from 'sweetalert2'
import { ehBloqueio, abrirModalDeBloqueio, criarBloqueios, removerBloqueio, liberarHorario } from './bloqueioUtils'
import { concluirAtendimento } from './atendimentoUtils'

const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
const IconWhatsApp = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>

export default function AdminDashboard({ totalServicos }) {
  const [agendamentos, setAgendamentos] = useState([])
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false)
  const [agendamentoEmPagamento, setAgendamentoEmPagamento] = useState(null)
  const [busca, setBusca] = useState('')
  const [abaHistorico, setAbaHistorico] = useState('agendamento') 
  const [configCores, setConfigCores] = useState(null)
  const [configAgenda, setConfigAgenda] = useState(null) 
  const [barbeiros, setBarbeiros] = useState([])
  const [mostrarComanda, setMostrarComanda] = useState(false)
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [abaFila, setAbaFila] = useState('ativos') // 'ativos' | 'cancelados'

  // 1. CARREGAR AGENDAMENTOS E COMANDAS (UNIFICADOS)
  useEffect(() => {
    const qAgendamentos = query(collection(db, "agendamentos"));
    const qComandas = query(collection(db, "comandas"));

    const unsubAgendamentos = onSnapshot(qAgendamentos, (snapAg) => {
      const listaAgendamentos = snapAg.docs.map(doc => ({ 
        id: doc.id, 
        tipo: 'agendamento', 
        ...doc.data() 
      }));

      const unsubComandas = onSnapshot(qComandas, (snapCom) => {
        const listaComandas = snapCom.docs.map(doc => ({ 
          id: doc.id, 
          tipo: 'comanda', 
          ...doc.data() 
        }));

        const tudoJunto = [...listaAgendamentos, ...listaComandas];
        
        tudoJunto.sort((a, b) => {
          const horaA = a.hora || '00:00';
          const horaB = b.hora || '00:00';
          return horaA.localeCompare(horaB);
        });
        
        setAgendamentos(tudoJunto);
      });

      return () => unsubComandas();
    });

    return () => unsubAgendamentos();
  }, []);

  // 2. BUSCA CORES
  useEffect(() => {
    const qCores = query(collection(db, "configuracoes"))
    const unsub = onSnapshot(qCores, (snapshot) => {
      snapshot.forEach(doc => {
        if (doc.id === 'personalizacao') {
          setConfigCores(doc.data().cores)
        }
      })
    })
    return () => unsub()
  }, [])

  // 3. BUSCA AGENDA
  useEffect(() => {
    const getAgenda = async () => {
      const docRef = doc(db, "configuracoes", "agenda");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setConfigAgenda(docSnap.data());
      }
    };
    getAgenda();
  }, []);

  // 4. BUSCA BARBEIROS
  useEffect(() => {
    const qB = query(collection(db, "barbeiros"));
    const unsubB = onSnapshot(qB, (snapshot) => {
      setBarbeiros(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubB();
  }, []);

  // =========================================================================
  // FUNÇÕES DE AÇÃO 
  // =========================================================================
  const concluirAtendimentoFinal = async (id, dadosPagamento = {}) => {
    if (!id) {
      toast.error("Erro: ID do atendimento não encontrado.");
      return;
    }
    try {
      const resultado = await concluirAtendimento({ id, agendamento: agendamentoEmPagamento, dadosPagamento, barbeiros });

      if (resultado.fiadoFalhou) {
        toast.error("Atendimento concluído, mas houve um erro ao registrar o fiado. Anote manualmente!");
      } else {
        toast.success("Atendimento concluído e financeiro/estoque atualizados!");
      }

      setAgendamentoEmPagamento(null);
    } catch (error) {
      console.error("Erro ao concluir:", error);
      toast.error("Erro ao concluir o atendimento no sistema.");
    }
  }

  const excluirAgendamento = async (item) => {
    // Mesmo problema do "tipo" vs "origem" acima: este botão recebia só o "id" e sempre
    // cancelava em "agendamentos". Numa comanda "Pendente" (walk-in abandonado) isso
    // também falhava silenciosamente — o doc não existe em "agendamentos" — deixando a
    // comanda sem NENHUMA forma de ser cancelada ou finalizada pela tela.
    const ehComanda = item?.tipo === 'comanda';
    Swal.fire({
      title: ehComanda ? 'Cancelar Comanda?' : 'Cancelar Agendamento?',
      text: ehComanda
        ? "Deseja marcar esta comanda como Cancelada? Nenhuma cobrança será feita."
        : "Deseja marcar este agendamento como Cancelado?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, cancelar!',
      cancelButtonText: 'Voltar',
      background: configCores?.card || '#ffffff',
      color: configCores?.texto || '#000000'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await updateDoc(doc(db, ehComanda ? "comandas" : "agendamentos", item.id), { status: "Cancelado" });

          // Libera a trava de horário (ver bloqueioUtils.js) — comandas não passam por essa
          // trava (não reservam data/hora futura), só agendamentos reais.
          if (!ehComanda) {
            await liberarHorario(item.barbeiro, item.data, item.hora);
          }

          // Bug real encontrado: quando o cliente cancela o próprio agendamento pela
          // página dele (Cliente.jsx), o crédito de plano usado na hora de agendar é
          // devolvido (cortesRestantes + 1). Cancelar o MESMO agendamento por aqui (pelo
          // admin) não fazia isso — o cliente perdia o corte do plano de vez, mesmo sem
          // nunca ter sido atendido. Corrigido para devolver o crédito também aqui.
          if (!ehComanda && (item.preco === 'PLANO' || item.preco === 'PLANO ATIVO') && item.clienteTelefone) {
            await updateDoc(doc(db, "clientes", item.clienteTelefone), { cortesRestantes: increment(1) });
          }

          toast.success(ehComanda ? "Comanda marcada como cancelada!" : "Agendamento marcado como cancelado!");
        } catch (error) {
          console.error("Erro ao cancelar:", error);
          toast.error(ehComanda ? "Falha ao cancelar a comanda." : "Falha ao cancelar o agendamento.");
        }
      }
    });
  }

  const bloquearHorarioDaGrade = async (hora, nomeBarbeiro, horariosLivres) => {
    const resultado = await abrirModalDeBloqueio({ cores: configCores, horariosDisponiveis: horariosLivres, horaInicial: hora });
    if (!resultado) return;

    const horariosParaBloquear = horariosLivres.filter(h => h >= resultado.horaInicio && h <= resultado.horaFim);
    if (horariosParaBloquear.length === 0) {
      toast.error("Nenhum horário livre no intervalo selecionado.");
      return;
    }

    try {
      await criarBloqueios({
        barbeiro: nomeBarbeiro,
        dataISO: formatosSel.iso,
        horarios: horariosParaBloquear,
        motivo: resultado.motivo
      });
      toast.success(horariosParaBloquear.length > 1 ? `${horariosParaBloquear.length} horários bloqueados!` : "Horário bloqueado com sucesso!");
    } catch (error) {
      console.error("Erro ao bloquear:", error);
      // Agora que o bloqueio verifica cada horário atomicamente (ver bloqueioUtils.js), um
      // horário já ocupado nesse meio-tempo gera um erro específico (code 'HORARIOS_OCUPADOS')
      // — mostramos a mensagem exata em vez de um genérico "falha ao bloquear".
      toast.error(error.code === 'HORARIOS_OCUPADOS' ? error.message : "Falha ao bloquear horário.");
    }
  }

  const desbloquearDaGrade = async (bloqueio) => {
    try {
      await removerBloqueio(bloqueio);
      toast.success("Horário desbloqueado!");
    } catch (error) {
      console.error("Erro ao desbloquear:", error);
      toast.error("Falha ao desbloquear horário.");
    }
  }

  const formatarWhatsApp = (numero) => {
  if (!numero) return '#';
  return `https://wa.me/55${String(numero).replace(/\D/g, '')}`;
}

  const getFormatosData = (dataBase) => {
    const ano = dataBase.getFullYear();
    const mes = String(dataBase.getMonth() + 1).padStart(2, '0');
    const dia = String(dataBase.getDate()).padStart(2, '0');
    return { iso: `${ano}-${mes}-${dia}`, br: `${dia}/${mes}/${ano}` }
  }

  const gerarProximosDias = () => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  const diasSemana = gerarProximosDias();
  const nomesDiasCurto = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const chavesDiasTrabalho = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  const gerarGradeDaData = (dataAlvo) => {
    if (!configAgenda || !configAgenda.horariosPorDia) return []; 

    const diaNum = dataAlvo.getDay(); 
    const formatoISO = getFormatosData(dataAlvo).iso;
    const ocorrenciaSemana = Math.ceil(dataAlvo.getDate() / 7);

    const regraSemanaDinamica = (configAgenda.regrasSemanas || []).find(r => 
        r.diaSemana === diaNum && r.semanas.includes(ocorrenciaSemana)
    );

    const regraDoDia = configAgenda.excecoes?.[formatoISO] || regraSemanaDinamica || configAgenda.horariosPorDia[diaNum];

    if (!regraDoDia || !regraDoDia.ativo) return []; 

    const intervaloMinutos = parseInt(configAgenda.intervalo) || 30; 
    let grade = [];

    const calcularTurno = (horaInicio, horaFim) => {
      if (!horaInicio || !horaFim) return;
      let [hAtual, mAtual] = horaInicio.split(':').map(Number);
      let [hFinal, mFinal] = horaFim.split(':').map(Number);
      let atual = (hAtual * 60) + mAtual;
      const totalFim = (hFinal * 60) + mFinal;

      while (atual + intervaloMinutos <= totalFim) {
        const horaFormatada = String(Math.floor(atual / 60)).padStart(2, '0');
        const minutoFormatado = String(atual % 60).padStart(2, '0');
        grade.push(`${horaFormatada}:${minutoFormatado}`);
        atual += intervaloMinutos;
      }
    };

    calcularTurno(regraDoDia.t1Ini, regraDoDia.t1Fim);
    calcularTurno(regraDoDia.t2Ini, regraDoDia.t2Fim);

    return [...new Set(grade)];
  }

  const formatosSel = getFormatosData(dataSelecionada);
  const formatosHoje = getFormatosData(new Date());
  const isHoje = formatosSel.iso === formatosHoje.iso;
  const horariosDaData = gerarGradeDaData(dataSelecionada);

  const proximosClientes = agendamentos
    .filter(ag => ag.status !== 'Concluído')
    .sort((a, b) => (a.data || "").localeCompare(b.data || "") || (a.hora || "").localeCompare(b.hora || ""))

  const atendimentosFinalizados = agendamentos
    .filter(ag => ag.status === 'Concluído')
    .filter(ag => ag.tipo === abaHistorico)
    .filter(ag => 
      ag.clienteNome?.toLowerCase().includes(busca.toLowerCase()) || 
      ag.servico?.toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.hora || "").localeCompare(a.hora || ""))

  const dataHojeObj = new Date();
  const horaSpString = dataHojeObj.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const [hAtual, mAtual] = horaSpString.split(':').map(Number);
  const minutosAtuais = hAtual * 60 + mAtual;

  // Fila (visão geral, abaixo da grade por barbeiro): antes misturava agendamentos ativos e
  // cancelados na mesma lista (só com um estilo apagado pro cancelado) — pedido do usuário
  // pra separar em duas abas, já que um cancelado no meio da fila real atrapalhava a
  // varredura visual de quem realmente falta atender.
  const filaGeral = proximosClientes.filter(ag => !ehBloqueio(ag));
  const filaAtivos = filaGeral.filter(ag => ag.status !== 'Cancelado');
  const filaCancelados = filaGeral.filter(ag => ag.status === 'Cancelado');
  const filaExibida = abaFila === 'ativos' ? filaAtivos : filaCancelados;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      {agendamentoEmPagamento && (
        <AdminPagamento 
          agendamento={agendamentoEmPagamento} 
          onClose={() => setAgendamentoEmPagamento(null)}
          onConfirm={concluirAtendimentoFinal}
        />
      )}

      {mostrarComanda && (
        <Comanda 
          configCores={configCores}
          barbeiros={barbeiros} 
          onClose={() => setMostrarComanda(false)}
          onAbrirPagamento={(dados) => {
            setAgendamentoEmPagamento(dados)
            setMostrarComanda(false)
          }}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter" 
            style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
          Minha <span style={{ color: configCores?.primaria || 'var(--cor-primaria)' }}>Agenda</span>
        </h1>
        
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <button 
            onClick={() => setMostrarFinalizados(true)}
            className="text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg hover:brightness-125 border"
            style={{ 
              backgroundColor: configCores?.card || 'var(--cor-card)', 
              borderColor: configCores?.borda || 'var(--cor-borda)', 
              color: configCores?.texto || 'var(--cor-texto-principal)' 
            }}
          >
            Atendimentos Finalizados
          </button>
          
          <button 
            onClick={() => setMostrarComanda(true)}
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-green-500/20 hover:brightness-110"
            style={{ 
              backgroundColor: configCores?.primaria || '#16a34a', 
              color: '#ffffff' 
            }}
          >
            <Plus size={14} /> Nova Comanda
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-12 mb-4">
        <h2 className="text-xl font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
          <CalendarDays size={20} /> Fila por Barbeiro
        </h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar mb-4">
        {diasSemana.map((dia, idx) => {
          const dadosDia = getFormatosData(dia);
          const isSelected = dadosDia.iso === formatosSel.iso;
          
          return (
            <button
              key={idx}
              onClick={() => setDataSelecionada(dia)}
              className={`min-w-[85px] p-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${isSelected ? 'shadow-md scale-105' : 'opacity-60 hover:opacity-100'}`}
              style={{
                backgroundColor: isSelected ? (configCores?.primaria || 'var(--cor-primaria)') : (configCores?.card || 'var(--cor-card)'),
                borderColor: isSelected ? (configCores?.primaria || 'var(--cor-primaria)') : (configCores?.borda || 'var(--cor-borda)'),
                color: isSelected ? '#ffffff' : (configCores?.texto || 'var(--cor-texto-principal)')
              }}
            >
              <span className="text-[10px] uppercase font-black tracking-widest mb-1">
                {idx === 0 ? 'Hoje' : nomesDiasCurto[dia.getDay()]}
              </span>
              <span className="text-lg font-bold">
                {dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            </button>
          )
        })}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {barbeiros.map(b => {
          const diaSemanaSelecionado = dataSelecionada.getDay();
          const chaveDia = chavesDiasTrabalho[diaSemanaSelecionado];
          
          // Verifica se o barbeiro trabalha neste dia (padrão é true caso o doc não tenha isso configurado ainda)
          const barbeiroTrabalhaHj = b.diasTrabalho ? b.diasTrabalho[chaveDia] !== false : true;

          const agendamentosBarbeiro = proximosClientes.filter(ag => 
            ag.barbeiro === b.nome && 
            ag.status !== 'Cancelado' &&
            (ag.data === formatosSel.br || ag.data === formatosSel.iso)
          );

          const horariosFiltrados = horariosDaData.filter(hora => {
            const ocupado = agendamentosBarbeiro.find(ag => ag.hora === hora);

            // Sempre mostra se já tem um agendamento gravado (mesmo se for dia de folga do barbeiro)
            if (ocupado) return true;

            // Se o horário estiver livre, mas o barbeiro não trabalha hoje, remove da grade
            if (!barbeiroTrabalhaHj) return false;

            if (isHoje) {
              const [hSlot, mSlot] = hora.split(':').map(Number);
              const minutosSlot = (hSlot * 60) + mSlot;
              return minutosSlot >= minutosAtuais;
            }

            return true;
          });

          // Horários realmente livres deste barbeiro neste dia — usado para popular o
          // seletor de intervalo do modal de bloqueio (nunca oferece um horário já ocupado).
          const horariosLivresBarbeiro = horariosFiltrados.filter(hora => !agendamentosBarbeiro.find(ag => ag.hora === hora));

          return (
            <div key={b.id} className="p-5 rounded-[2rem] border" 
                 style={{ backgroundColor: configCores?.card || 'var(--cor-card)', borderColor: configCores?.borda || 'var(--cor-borda)' }}>
              
              <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{ borderColor: configCores?.borda || 'var(--cor-borda)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xs bg-black/20"
                     style={{ backgroundColor: configCores?.primaria || 'var(--cor-primaria)' }}>
                   {b.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-black uppercase text-sm tracking-tighter" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{b.nome}</p>
                  <p className="text-[9px] font-black uppercase opacity-50">{formatosSel.br}</p>
                </div>
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {horariosDaData.length === 0 ? (
                  <p className="text-center text-xs font-bold opacity-50 py-4">Barbearia fechada ou sem horários configurados para este dia.</p>
                ) : !barbeiroTrabalhaHj && horariosFiltrados.length === 0 ? (
                  <p className="text-center text-xs font-bold opacity-50 py-4">Barbeiro não trabalha neste dia.</p>
                ) : horariosFiltrados.length === 0 ? (
                  <p className="text-center text-xs font-bold opacity-50 py-4">Sem mais horários pendentes hoje.</p>
                ) : (
                  horariosFiltrados.map(hora => {
                    const ocupado = agendamentosBarbeiro.find(ag => ag.hora === hora);
                    const bloqueado = ocupado && ehBloqueio(ocupado);

                    return (
                      <div key={hora} className="flex justify-between items-center p-3 rounded-2xl text-xs transition-all border"
                            style={{
                              backgroundColor: bloqueado ? 'rgba(120,120,128,0.15)' : ocupado ? 'rgba(0,0,0,0.1)' : configCores?.fundo || 'var(--cor-input-bg)',
                              borderColor: configCores?.borda || 'var(--cor-borda)',
                              borderLeftWidth: ocupado ? '4px' : '1px',
                              borderLeftColor: bloqueado ? '#71717a' : ocupado ? (configCores?.primaria || 'var(--cor-primaria)') : configCores?.borda || 'var(--cor-borda)'
                            }}>
                        <span className="font-black" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>{hora}</span>

                        {bloqueado ? (
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="font-black truncate max-w-[110px] flex items-center gap-1 justify-end" style={{ color: '#71717a' }}>
                                🔒 Bloqueado
                              </p>
                              {ocupado.motivo && (
                                <p className="text-[8px] font-bold uppercase opacity-50 truncate max-w-[110px]">{ocupado.motivo}</p>
                              )}
                            </div>
                            <button
                              title="Desbloquear horário"
                              className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors"
                              onClick={() => desbloquearDaGrade(ocupado)}
                            >
                              🔓
                            </button>
                          </div>
                        ) : ocupado ? (
                          <div className="text-right">
                             <p className="font-black truncate max-w-[120px]" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                               {ocupado.clienteNome}
                             </p>
                             <p className="text-[8px] font-bold uppercase opacity-50">{ocupado.servico}</p>
                          </div>
                        ) : (
                          <button
                            className="text-[10px] font-black uppercase tracking-widest text-green-500 hover:text-green-600 transition-colors"
                            onClick={() => bloquearHorarioDaGrade(hora, b.nome, horariosLivresBarbeiro)}
                          >
                            Livre
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-12 mb-4">
        <h2 className="text-xl font-bold uppercase tracking-widest" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
          {abaFila === 'ativos' ? 'Fila de Atendimentos' : 'Agendamentos Cancelados'}
        </h2>

        <div className="flex gap-2 p-1.5 rounded-2xl border w-fit" style={{ backgroundColor: configCores?.card || 'var(--cor-card)', borderColor: configCores?.borda || 'var(--cor-borda)' }}>
          <button
            onClick={() => setAbaFila('ativos')}
            className="px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
            style={{
              backgroundColor: abaFila === 'ativos' ? (configCores?.primaria || 'var(--cor-primaria)') : 'transparent',
              color: abaFila === 'ativos' ? '#ffffff' : (configCores?.textoSecundario || 'var(--cor-texto-secundario)')
            }}
          >
            Fila ({filaAtivos.length})
          </button>
          <button
            onClick={() => setAbaFila('cancelados')}
            className="px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
            style={{
              backgroundColor: abaFila === 'cancelados' ? '#6b7280' : 'transparent',
              color: abaFila === 'cancelados' ? '#ffffff' : (configCores?.textoSecundario || 'var(--cor-texto-secundario)')
            }}
          >
            Cancelados ({filaCancelados.length})
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {filaExibida.length === 0 && (
          <p className="text-center font-bold text-sm py-10" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
            {abaFila === 'ativos' ? 'Nenhum atendimento na fila no momento.' : 'Nenhum agendamento cancelado.'}
          </p>
        )}
        {filaExibida.map(ag => {
          const isCancelado = ag.status === 'Cancelado';
          return (
            <div 
              key={ag.id} 
              className={`p-6 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-center gap-4 ${isCancelado ? 'opacity-60' : ''}`}
              style={{
                backgroundColor: isCancelado ? 'rgba(0,0,0,0.05)' : (configCores?.card || 'var(--cor-card)'),
                borderColor: isCancelado ? 'rgba(0,0,0,0.1)' : (configCores?.borda || 'var(--cor-borda)'),
                borderLeftWidth: isCancelado ? '1px' : '4px',
                borderLeftColor: isCancelado ? 'gray' : (configCores?.primaria || 'var(--cor-primaria)')
              }}
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                    <p className={`text-xl font-black uppercase ${isCancelado ? 'line-through' : ''}`} 
                       style={{ color: isCancelado ? 'gray' : (configCores?.texto || 'var(--cor-texto-principal)') }}>
                      {ag.clienteNome}
                    </p>
                    {isCancelado && (
                      <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase" 
                            style={{ backgroundColor: 'gray', color: '#ffffff' }}>
                        Cancelado
                      </span>
                    )}
                </div>
                <p className="text-sm mt-1" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  {ag.servico} com <span className="font-bold" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{ag.barbeiro}</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center px-4">
                  {ag.data && (
                    <p className="text-[11px] font-black uppercase tracking-widest mb-1" 
                       style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                      {ag.data}
                    </p>
                  )}
                  <p className="text-[10px] uppercase font-bold" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>Horário</p>
                  <p className="text-2xl font-black" 
                     style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                    {ag.hora}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={formatarWhatsApp(ag.clienteTelefone)} target="_blank" rel="noreferrer" 
                     className="p-3 rounded-xl hover:brightness-125 transition-all border"
                     style={{ backgroundColor: configCores?.card || 'var(--cor-bg-botao)', borderColor: configCores?.borda || 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                    <IconWhatsApp />
                  </a>
                  
                  {!isCancelado && (
                    <button 
                      onClick={() => setAgendamentoEmPagamento(ag)} 
                      className="p-3 rounded-xl hover:brightness-110 transition-all shadow-md"
                      style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
                    >
                      <IconCheck />
                    </button>
                  )}
                  
                  <button 
                    onClick={() => excluirAgendamento(ag)}
                    className={`p-3 rounded-xl transition-all border ${isCancelado ? 'opacity-20 cursor-not-allowed' : 'hover:brightness-125'}`} 
                    disabled={isCancelado}
                    style={{ backgroundColor: configCores?.card || 'var(--cor-bg-botao)', borderColor: configCores?.borda || 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {mostrarFinalizados && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border"
                style={{ 
                  backgroundColor: configCores?.fundo || 'var(--cor-fundo)', 
                  borderColor: configCores?.borda || 'var(--cor-borda)' 
                }}>
            
            <div className="p-6 border-b flex justify-between items-center" 
                 style={{ borderColor: configCores?.borda || 'var(--cor-borda)' }}>
              <div>
                <h2 className="text-2xl font-black uppercase italic" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                  Histórico <span style={{ color: configCores?.primaria || '#16a34a' }}>Finalizados</span>
                </h2>
              </div>
              <button onClick={() => setMostrarFinalizados(false)} className="p-2 rounded-full transition-all hover:scale-110"
                      style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6" style={{ backgroundColor: configCores?.card || 'var(--cor-card)' }}>
                <input 
                  type="text" 
                  placeholder="Pesquisar cliente ou serviço..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full rounded-2xl py-4 px-6 outline-none transition-all font-bold border focus:brightness-110 mb-4"
                  style={{ 
                    backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', 
                    borderColor: configCores?.borda || 'var(--cor-borda)', 
                    color: configCores?.texto || 'var(--cor-texto-principal)' 
                  }}
                />

                {/* ========================================== */}
                {/* BOTÕES DE ABAS ADICIONADOS AQUI */}
                {/* ========================================== */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                  <button 
                    onClick={() => setAbaHistorico('agendamento')}
                    className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border"
                    style={{
                      backgroundColor: abaHistorico === 'agendamento' ? (configCores?.primaria || '#16a34a') : 'transparent',
                      color: abaHistorico === 'agendamento' ? '#ffffff' : (configCores?.textoSecundario || 'var(--cor-texto-secundario)'),
                      borderColor: abaHistorico === 'agendamento' ? (configCores?.primaria || '#16a34a') : (configCores?.borda || 'var(--cor-borda)')
                    }}
                  >
                    Agendamentos do Site
                  </button>
                  <button 
                    onClick={() => setAbaHistorico('comanda')}
                    className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border"
                    style={{
                      backgroundColor: abaHistorico === 'comanda' ? (configCores?.primaria || '#16a34a') : 'transparent',
                      color: abaHistorico === 'comanda' ? '#ffffff' : (configCores?.textoSecundario || 'var(--cor-texto-secundario)'),
                      borderColor: abaHistorico === 'comanda' ? (configCores?.primaria || '#16a34a') : (configCores?.borda || 'var(--cor-borda)')
                    }}
                  >
                    Comandas Avulsas
                  </button>
                </div>
                {/* ========================================== */}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {atendimentosFinalizados.map(ag => (
                <div key={ag.id} className="p-4 rounded-2xl border flex justify-between items-center opacity-80"
                     style={{ 
                       backgroundColor: configCores?.card || 'var(--cor-card)', 
                       borderColor: configCores?.borda || 'var(--cor-borda)' 
                     }}>
                  <div className="text-left">
                    <p className="text-lg font-black uppercase" 
                       style={{ color: configCores?.primaria || '#16a34a' }}>
                      {ag.clienteNome}
                    </p>
                    <p className="text-[10px] font-bold uppercase" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                      {ag.servico} com <span style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{ag.barbeiro}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{ag.data}</p>
                    <p className="text-xl font-black" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>{ag.hora}</p>
                  </div>
                </div>
              ))}
              
              {atendimentosFinalizados.length === 0 && (
                <p className="text-center font-bold text-sm" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  Nenhum atendimento finalizado encontrado.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}