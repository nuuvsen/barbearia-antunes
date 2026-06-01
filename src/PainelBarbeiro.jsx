import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { CalendarDays } from 'lucide-react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';

const IconWhatsApp = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>

export default function PainelBarbeiro() {
  // Estados para o Login e Autenticação
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [logado, setLogado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  
  // Estados de Dados (Perfil, Agenda, Configurações)
  const [barbeiroPerfil, setBarbeiroPerfil] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [configCores, setConfigCores] = useState(null);
  const [configAgenda, setConfigAgenda] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState(new Date());

  // 1. CARREGAR CORES E CONFIGURAÇÃO DA AGENDA (Global)
  useEffect(() => {
    const qCores = query(collection(db, "configuracoes"));
    const unsubCores = onSnapshot(qCores, (snapshot) => {
      snapshot.forEach(docSnap => {
        if (docSnap.id === 'personalizacao') {
          setConfigCores(docSnap.data().cores);
        }
      });
    });

    const getAgenda = async () => {
      const docRef = doc(db, "configuracoes", "agenda");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setConfigAgenda(docSnap.data());
      }
    };
    getAgenda();

    return () => unsubCores();
  }, []);

  // 2. MONITORAR AUTENTICAÇÃO E PERFIL
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLogado(true);
        // Buscar o documento real do barbeiro com base no UID
        const qPerfil = query(collection(db, "barbeiros"), where("uid", "==", user.uid));
        const snapPerfil = await getDocs(qPerfil);
        
        if (!snapPerfil.empty) {
          setBarbeiroPerfil({ id: snapPerfil.docs[0].id, ...snapPerfil.docs[0].data() });
        } else {
          setErro("Perfil não encontrado. Verifique com o administrador.");
        }
      } else {
        setLogado(false);
        setBarbeiroPerfil(null);
      }
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. MONITORAR AGENDAMENTOS EM TEMPO REAL
  useEffect(() => {
    if (!barbeiroPerfil) return;

    // Traz apenas os agendamentos deste barbeiro para otimizar leitura
    const qAgendamentos = query(
      collection(db, "agendamentos"), 
      where("barbeiro", "==", barbeiroPerfil.nome)
    );

    const unsubAgendamentos = onSnapshot(qAgendamentos, (snapshot) => {
      const lista = snapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      }));
      setAgendamentos(lista);
    });

    return () => unsubAgendamentos();
  }, [barbeiroPerfil]);

  // =========================================================================
  // FUNÇÕES DE AÇÃO 
  // =========================================================================
  const gerirLogin = async (e) => {
    e.preventDefault();
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 dígitos.");
      return;
    }
    try {
      const emailFicticio = `${nome.toLowerCase().replace(/\s/g, '')}@antunes.com`;
      await signInWithEmailAndPassword(auth, emailFicticio, senha);
      setErro('');
    } catch (err) {
      setErro("Nome ou senha incorretos.");
    }
  };

  const fazerLogout = () => {
    signOut(auth);
  };

  const excluirAgendamento = async (id) => {
    Swal.fire({
      title: 'Cancelar Agendamento?',
      text: "Deseja marcar este agendamento como Cancelado?",
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
          await updateDoc(doc(db, "agendamentos", id), { status: "Cancelado" });
          toast.success("Agendamento marcado como cancelado!");
        } catch (error) {
          console.error("Erro ao cancelar:", error);
          toast.error("Falha ao cancelar o agendamento.");
        }
      }
    });
  };

  const bloquearHorarioDaGrade = async (hora) => {
    if (!barbeiroPerfil) return;

    Swal.fire({
      title: 'Bloquear Horário?',
      text: `Deseja fechar a sua agenda às ${hora}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, bloquear!',
      cancelButtonText: 'Cancelar',
      background: configCores?.card || '#ffffff',
      color: configCores?.texto || '#000000'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await addDoc(collection(db, "agendamentos"), {
            clienteNome: "🔒 HORÁRIO BLOQUEADO",
            clienteTelefone: "00000000000",
            servico: "Bloqueio Manual",
            barbeiro: barbeiroPerfil.nome,
            data: getFormatosData(dataSelecionada).br,
            hora: hora,
            status: "Pendente",
            tipo: "agendamento"
          });
          toast.success("Horário bloqueado com sucesso!");
        } catch (error) {
          console.error("Erro ao bloquear:", error);
          toast.error("Falha ao bloquear horário.");
        }
      }
    });
  };

  const formatarWhatsApp = (numero) => {
    if (!numero) return '#';
    return `https://wa.me/55${String(numero).replace(/\D/g, '')}`;
  };

  // =========================================================================
  // LÓGICA DE DATAS E GRADE
  // =========================================================================
  const getFormatosData = (dataBase) => {
    const ano = dataBase.getFullYear();
    const mes = String(dataBase.getMonth() + 1).padStart(2, '0');
    const dia = String(dataBase.getDate()).padStart(2, '0');
    return { iso: `${ano}-${mes}-${dia}`, br: `${dia}/${mes}/${ano}` };
  };

  const gerarProximosDias = () => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  };

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
  };

  const diasSemana = gerarProximosDias();
  const nomesDiasCurto = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const chavesDiasTrabalho = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  const formatosSel = getFormatosData(dataSelecionada);
  const formatosHoje = getFormatosData(new Date());
  const isHoje = formatosSel.iso === formatosHoje.iso;
  const horariosDaData = gerarGradeDaData(dataSelecionada);

  // Variáveis para controle de tempo atual (esconder horários passados)
  const dataHojeObj = new Date();
  const horaSpString = dataHojeObj.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const [hAtual, mAtual] = horaSpString.split(':').map(Number);
  const minutosAtuais = hAtual * 60 + mAtual;

  // Filtragem principal da grade do barbeiro
  const diaSemanaSelecionado = dataSelecionada.getDay();
  const chaveDia = chavesDiasTrabalho[diaSemanaSelecionado];
  const barbeiroTrabalhaHj = barbeiroPerfil?.diasTrabalho ? barbeiroPerfil.diasTrabalho[chaveDia] !== false : true;

  const agendamentosAtivos = agendamentos.filter(ag => 
    ag.status !== 'Concluído' && 
    ag.status !== 'Cancelado' &&
    (ag.data === formatosSel.br || ag.data === formatosSel.iso)
  );

  const horariosFiltrados = horariosDaData.filter(hora => {
    const ocupado = agendamentosAtivos.find(ag => ag.hora === hora);
    if (ocupado) return true; 
    if (!barbeiroTrabalhaHj) return false;
    if (isHoje) {
      const [hSlot, mSlot] = hora.split(':').map(Number);
      const minutosSlot = (hSlot * 60) + mSlot;
      return minutosSlot >= minutosAtuais; 
    }
    return true; 
  });

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center font-black text-2xl animate-pulse italic"
           style={{ backgroundColor: configCores?.fundo || '#000000', color: configCores?.primaria || '#dc2626' }}>
        Carregando painel...
      </div>
    );
  }

  // --- TELA 1: LOGIN ---
  if (!logado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ backgroundColor: configCores?.fundo || '#000000', color: configCores?.texto || '#ffffff' }}>
        <form onSubmit={gerirLogin} className="p-8 rounded-lg shadow-lg w-96 border" style={{ backgroundColor: configCores?.card || '#18181b', borderColor: configCores?.borda || '#27272a' }}>
          <h2 className="text-2xl font-black mb-6 text-center italic tracking-tighter" style={{ color: configCores?.primaria || '#dc2626' }}>
            ACESSO BARBEIRO
          </h2>
          
          <div className="mb-4">
            <label className="block mb-2 font-bold text-sm" style={{ color: configCores?.textoSecundario || '#d4d4d8' }}>Seu Nome:</label>
            <input 
              type="text" 
              className="w-full p-3 rounded border focus:outline-none font-bold uppercase transition-colors"
              style={{ backgroundColor: configCores?.fundo || '#27272a', borderColor: configCores?.borda || '#3f3f46', color: configCores?.texto || '#ffffff' }}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Joao"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-bold text-sm" style={{ color: configCores?.textoSecundario || '#d4d4d8' }}>Senha:</label>
            <input 
              type="password" 
              className="w-full p-3 rounded border focus:outline-none font-bold transition-colors"
              style={{ backgroundColor: configCores?.fundo || '#27272a', borderColor: configCores?.borda || '#3f3f46', color: configCores?.texto || '#ffffff' }}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 dígitos"
              required
            />
          </div>

          {erro && <p className="mb-4 text-sm text-center font-bold uppercase tracking-widest" style={{ color: configCores?.primaria || '#ef4444' }}>{erro}</p>}

          <button type="submit" className="w-full p-3 rounded font-black transition uppercase tracking-wider shadow-lg hover:brightness-110"
                  style={{ backgroundColor: configCores?.primaria || '#dc2626', color: '#ffffff' }}>
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // --- TELA 2: AGENDA DO BARBEIRO ---
  return (
    <div className="min-h-screen p-4 md:p-6" style={{ backgroundColor: configCores?.fundo || '#f4f4f5' }}>
      
      <header className="flex justify-between items-center p-4 rounded-xl shadow mb-6 border-b-4"
              style={{ backgroundColor: configCores?.card || '#ffffff', borderColor: configCores?.primaria || '#dc2626' }}>
        <h1 className="text-lg md:text-2xl font-black italic tracking-tighter" style={{ color: configCores?.texto || '#000000' }}>
          ANTUNES.OS | <span style={{ color: configCores?.primaria || '#dc2626' }}>Minha Agenda</span>
        </h1>
        <button 
          onClick={fazerLogout}
          className="font-bold py-2 px-6 rounded-lg transition uppercase tracking-widest text-xs hover:brightness-125 border shadow-sm"
          style={{ backgroundColor: configCores?.fundo || '#000000', color: configCores?.texto || '#ffffff', borderColor: configCores?.borda || 'transparent' }}
        >
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-4xl space-y-6">
        
        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-xl font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
            <CalendarDays size={20} /> Controle de Fila
          </h2>
        </div>

        {/* CARROSSEL DE DATAS */}
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
            );
          })}
        </div>

        {/* GRADE DE HORÁRIOS */}
        <div className="p-5 rounded-[2rem] border shadow-sm" 
             style={{ backgroundColor: configCores?.card || 'var(--cor-card)', borderColor: configCores?.borda || 'var(--cor-borda)' }}>
          
          <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{ borderColor: configCores?.borda || 'var(--cor-borda)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xs bg-black/20"
                 style={{ backgroundColor: configCores?.primaria || 'var(--cor-primaria)' }}>
               {barbeiroPerfil?.nome?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-black uppercase text-lg tracking-tighter" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                {barbeiroPerfil?.nome}
              </p>
              <p className="text-[10px] font-black uppercase opacity-50" style={{ color: configCores?.textoSecundario }}>{formatosSel.br}</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {horariosDaData.length === 0 ? (
              <p className="text-center text-sm font-bold opacity-50 py-8" style={{ color: configCores?.textoSecundario }}>Barbearia fechada ou sem horários configurados para este dia.</p>
            ) : !barbeiroTrabalhaHj && horariosFiltrados.length === 0 ? (
              <p className="text-center text-sm font-bold opacity-50 py-8" style={{ color: configCores?.textoSecundario }}>Você não trabalha neste dia.</p>
            ) : horariosFiltrados.length === 0 ? (
              <p className="text-center text-sm font-bold opacity-50 py-8" style={{ color: configCores?.textoSecundario }}>Sem mais horários pendentes hoje.</p>
            ) : (
              horariosFiltrados.map(hora => {
                const ocupado = agendamentosAtivos.find(ag => ag.hora === hora);

                return (
                  <div key={hora} className="flex justify-between items-center p-4 rounded-2xl transition-all border"
                        style={{ 
                          backgroundColor: ocupado ? 'rgba(0,0,0,0.05)' : configCores?.fundo || 'var(--cor-input-bg)',
                          borderColor: configCores?.borda || 'var(--cor-borda)',
                          borderLeftWidth: ocupado ? '4px' : '1px',
                          borderLeftColor: ocupado ? (configCores?.primaria || 'var(--cor-primaria)') : configCores?.borda || 'var(--cor-borda)'
                        }}>
                    
                    <div className="flex items-center gap-4">
                      <span className="font-black text-lg" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>{hora}</span>
                      
                      {ocupado && (
                        <div className="text-left border-l pl-4" style={{ borderColor: configCores?.borda }}>
                          <p className="font-black uppercase tracking-tighter" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                            {ocupado.clienteNome}
                          </p>
                          <p className="text-[10px] font-bold uppercase opacity-60" style={{ color: configCores?.textoSecundario }}>{ocupado.servico}</p>
                        </div>
                      )}
                    </div>
                    
                    {ocupado ? (
                      <div className="flex items-center gap-2">
                        <a href={formatarWhatsApp(ocupado.clienteTelefone)} target="_blank" rel="noreferrer" 
                           className="p-2 rounded-lg hover:brightness-125 transition-all border shadow-sm"
                           title="Contatar Cliente"
                           style={{ backgroundColor: configCores?.fundo || 'var(--cor-bg-botao)', borderColor: configCores?.borda || 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                          <IconWhatsApp />
                        </a>
                        <button 
                          onClick={() => excluirAgendamento(ocupado.id)} 
                          title="Cancelar Agendamento"
                          className="p-2 rounded-lg transition-all border shadow-sm hover:bg-red-500 hover:text-white hover:border-red-500" 
                          style={{ backgroundColor: configCores?.fundo || 'var(--cor-bg-botao)', borderColor: configCores?.borda || 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}
                        >
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="text-xs font-black uppercase tracking-widest text-green-500 hover:text-white hover:bg-red-500 px-4 py-2 rounded-xl transition-all border border-green-500/30 hover:border-red-500 cursor-pointer shadow-sm"
                        onClick={() => bloquearHorarioDaGrade(hora)}
                        title="Clique para bloquear este horário"
                      >
                        Livre
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}