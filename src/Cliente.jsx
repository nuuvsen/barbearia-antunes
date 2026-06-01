import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, query, where, limit, setDoc } from 'firebase/firestore'
import { Info } from 'lucide-react'
import Swal from 'sweetalert2'

const MAPA_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Utilitário de Toast do SweetAlert2 (substituindo possíveis bibliotecas faltantes)
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

const FotoPadrao = () => (
  <div className="w-14 h-14 bg-[var(--cor-bg-geral)] flex items-center justify-center rounded-full border-2 border-[var(--cor-primaria)] opacity-70">
    <svg viewBox="0 0 100 100" className="w-8 h-8 fill-none stroke-[var(--cor-primaria)]" strokeWidth="3">
      <path d="M70 20 L30 60 L20 50 L60 10 Z" fill="currentColor" opacity="0.2" />
      <path d="M30 60 L75 15" strokeLinecap="round" />
      <text x="50%" y="65%" textAnchor="middle" className="fill-[var(--cor-primaria)] font-black italic tracking-tighter" fontSize="30">A</text>
    </svg>
  </div>
)

export default function Cliente({ servicos }) {
  // ESTADO DE TEMA CLARO/ESCURO
  const [isDark, setIsDark] = useState(true)

  const [modo, setModo] = useState('agendamento') 
  const [etapa, setEtapa] = useState(1)
  const [escolha, setEscolha] = useState({ servico: null, barbeiro: null, data: null, hora: null })
  
  // ESTADOS ASSINATURA E CONTATO
  const [perfil, setPerfil] = useState(null)
  const [telefoneLogin, setTelefoneLogin] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const [contato, setContato] = useState({ nome: '', telefone: '' })
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  
  // ESTADOS MEUS AGENDAMENTOS
  const [telefoneHistorico, setTelefoneHistorico] = useState('')
  const [meusAgendamentos, setMeusAgendamentos] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

  // ESTADOS CONFIGURAÇÕES
  const [barbeiros, setBarbeiros] = useState([])
  const [configAgenda, setConfigAgenda] = useState(null)
  const [feriados, setFeriados] = useState([])
  const [feriadoSelecionado, setFeriadoSelecionado] = useState(null)
  const [horariosGerados, setHorariosGerados] = useState([])
  const [horariosOcupados, setHorariosOcupados] = useState([])

  const [mesVisivel, setMesVisivel] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  useEffect(() => {
    const carregarTudo = async () => {
      const snapB = await getDocs(collection(db, "barbeiros"))
      setBarbeiros(snapB.docs.map(d => ({ id: d.id, ...d.data() })))

      const docAgenda = await getDoc(doc(db, "configuracoes", "agenda"))
      let cfg = docAgenda.exists() ? docAgenda.data() : { 
        intervalo: '30', 
        feriadosAtivos: false,
        horariosPorDia: {
          0: { ativo: false, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '18:00' },
          1: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
          2: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
          3: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
          4: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
          5: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '20:00' },
          6: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '18:00' }
        },
        excecoes: {},
        regrasSemanas: []
      }
      
      if (!cfg.excecoes) cfg.excecoes = {}
      if (!cfg.regrasSemanas) cfg.regrasSemanas = []
      
      setConfigAgenda(cfg)

      const ano = new Date().getFullYear()
      let feriadosLocal = []
      try {
        const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`)
        const dados = await res.json()
        feriadosLocal = dados.map(f => ({ date: f.date, name: f.name }))
        setFeriados(feriadosLocal)
      } catch(e) { console.error(e) }
    }
    carregarTudo()
  }, [])

  useEffect(() => {
    const buscarNomeCliente = async () => {
      const tel = contato.telefone.trim()
      if (tel.length >= 10 && modo === 'agendamento') {
        try {
          const docSnap = await getDoc(doc(db, "clientes", tel))
          if (docSnap.exists() && docSnap.data().nome) {
            setContato(prev => ({ ...prev, nome: docSnap.data().nome }))
            return;
          }
          const q = query(
            collection(db, "agendamentos"), 
            where("clienteTelefone", "==", tel), 
            limit(1)
          )
          const snap = await getDocs(q)
          if (!snap.empty) {
            const nomeAntigo = snap.docs[0].data().clienteNome;
            if (nomeAntigo) {
              setContato(prev => ({ ...prev, nome: nomeAntigo }))
            }
          }
        } catch (error) {
          console.error("Erro ao buscar nome:", error)
        }
      }
    }
    const delayId = setTimeout(buscarNomeCliente, 600)
    return () => clearTimeout(delayId)
  }, [contato.telefone, modo])

  const checarDisponibilidade = (dataObj) => {
    if (!configAgenda || !escolha.barbeiro) return false;
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    if (dataObj < hoje) return false;
    
    let limiteFuturo = new Date();
    limiteFuturo.setMonth(limiteFuturo.getMonth() + 13);
    if (dataObj > limiteFuturo) return false;
    
    const ano = dataObj.getFullYear();
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dataObj.getDate()).padStart(2, '0');
    const formatoAPI = `${ano}-${mes}-${dia}`;
    const diaNum = dataObj.getDay();
    const diaSigla = MAPA_DIAS[diaNum];
    
    const ocorrenciaSemana = Math.ceil(dataObj.getDate() / 7);
    const regraSemanaDinamica = (configAgenda.regrasSemanas || []).find(r => 
        r.diaSemana === diaNum && r.semanas.includes(ocorrenciaSemana)
    );

    const regraDoDia = configAgenda.excecoes?.[formatoAPI] || regraSemanaDinamica || configAgenda.horariosPorDia[diaNum];
    const barbeariaAberta = regraDoDia?.ativo;
    const eFeriado = configAgenda.feriadosAtivos && feriados.some(f => f.date === formatoAPI);
    
    if (!barbeariaAberta || eFeriado) return false;
    
    if (escolha.barbeiro.id === 'qualquer') {
      return barbeiros.some(b => b.diasTrabalho?.[diaSigla] !== false);
    } else {
      return escolha.barbeiro.diasTrabalho?.[diaSigla] !== false;
    }
  }

  const selecionarData = async (dia) => {
    setEscolha({...escolha, data: dia.formatoAPI})
    setEtapa(4)
    const diaSemana = dia.dataReal.getDay()
    const diaSigla = MAPA_DIAS[diaSemana] 
    
    const ocorrenciaSemana = Math.ceil(dia.dataReal.getDate() / 7);
    const regraSemanaDinamica = (configAgenda.regrasSemanas || []).find(r => 
        r.diaSemana === diaSemana && r.semanas.includes(ocorrenciaSemana)
    );
    const regraDoDia = configAgenda.excecoes?.[dia.formatoAPI] || regraSemanaDinamica || configAgenda.horariosPorDia[diaSemana];
    
    let ocupados = []

    if (escolha.barbeiro.id === 'qualquer') {
      const q = query(collection(db, "agendamentos"), where("data", "==", dia.formatoAPI))
      const snap = await getDocs(q)
      const contagemHoras = {}
      snap.docs.filter(d => d.data().status !== 'Cancelado').forEach(d => {
        const h = d.data().hora
        contagemHoras[h] = (contagemHoras[h] || 0) + 1
      })
      const barbeirosAtivosHoje = barbeiros.filter(b => b.diasTrabalho?.[diaSigla] !== false).length || 1
      for (const [hora, qtd] of Object.entries(contagemHoras)) {
        if (qtd >= barbeirosAtivosHoje) ocupados.push(hora)
      }
    } else {
      const q = query(
        collection(db, "agendamentos"), 
        where("barbeiro", "==", escolha.barbeiro.nome),
        where("data", "==", dia.formatoAPI)
      )
      const snap = await getDocs(q)
      ocupados = snap.docs
        .filter(d => d.data().status !== 'Cancelado')
        .map(d => d.data().hora)
    }

    setHorariosOcupados(ocupados)

    const gerarSlots = (inicio, fim, intervalo) => {
      if (!inicio || !fim) return [];
      let slots = []
      let [h, m] = inicio.split(':').map(Number)
      let fimMin = fim.split(':').map(Number)
      let totalFim = fimMin[0] * 60 + fimMin[1]
      let atual = h * 60 + m
      const agora = new Date()
      const eHoje = dia.dataReal.getDate() === agora.getDate() && 
                    dia.dataReal.getMonth() === agora.getMonth() && 
                    dia.dataReal.getFullYear() === agora.getFullYear()
      const minutosAtuais = agora.getHours() * 60 + agora.getMinutes()

      while(atual + parseInt(intervalo) <= totalFim) {
        if (!eHoje || atual > minutosAtuais) {
          let hh = Math.floor(atual / 60).toString().padStart(2, '0')
          let mm = (atual % 60).toString().padStart(2, '0')
          slots.push(`${hh}:${mm}`)
        }
        atual += parseInt(intervalo)
      }
      return slots
    }

    if (regraDoDia && regraDoDia.ativo) {
      const t1 = gerarSlots(regraDoDia.t1Ini, regraDoDia.t1Fim, configAgenda.intervalo)
      const t2 = gerarSlots(regraDoDia.t2Ini, regraDoDia.t2Fim, configAgenda.intervalo)
      setHorariosGerados([...t1, ...t2])
    } else {
      setHorariosGerados([]) 
    }
  }

  const fazerLogin = async (e) => {
    e.preventDefault()
    setErroLogin('')
    const docSnap = await getDoc(doc(db, "clientes", telefoneLogin))
    if (docSnap.exists() && docSnap.data().planoId) {
      const dados = docSnap.data()
      const planoSnap = await getDoc(doc(db, "planos", dados.planoId))
      const dadosPlano = planoSnap.exists() ? planoSnap.data() : { servicosInclusos: [], combos: [] }
      setPerfil({ ...dados, servicosInclusos: dadosPlano.servicosInclusos || [], combosExclusivos: dadosPlano.combos || [] })
      setContato({ nome: dados.nome, telefone: dados.telefone })
      setModo('assinante_logado')
      setEtapa(1)
    } else {
      setErroLogin("Telefone não encontrado ou sem plano ativo.")
    }
  }

  const buscarHistorico = async (e) => {
    e.preventDefault()
    setCarregandoHistorico(true)
    try {
      const q = query(collection(db, "agendamentos"), where("clienteTelefone", "==", telefoneHistorico))
      const snap = await getDocs(q)
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => new Date(b.data) - new Date(a.data) || b.hora.localeCompare(a.hora))
      setMeusAgendamentos(lista)
      setModo('historico')
    } catch(error) {
      Toast.fire({ icon: 'error', title: 'Erro ao buscar histórico.' })
    }
    setCarregandoHistorico(false)
  }

  const cancelarMeuAgendamento = async (agendamento) => {
    const result = await Swal.fire({
      title: 'Atenção!',
      text: `Deseja cancelar o agendamento de ${agendamento.servico} do dia ${formatarDataAmigavel(agendamento.data)} às ${agendamento.hora}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Voltar'
    });

    if (result.isConfirmed) {
      try {
        await updateDoc(doc(db, "agendamentos", agendamento.id), { status: 'Cancelado' })
        
        if (agendamento.preco === 'PLANO' || agendamento.preco === 'PLANO ATIVO') {
          const clienteRef = doc(db, "clientes", agendamento.clienteTelefone)
          const clienteSnap = await getDoc(clienteRef)
          if (clienteSnap.exists()) {
            const cortesAtuais = clienteSnap.data().cortesRestantes || 0
            await updateDoc(clienteRef, { cortesRestantes: cortesAtuais + 1 })
          }
        }

        setMeusAgendamentos(prev => prev.map(a => 
          a.id === agendamento.id ? { ...a, status: 'Cancelado' } : a
        ))
        
        Toast.fire({ icon: 'success', title: 'Agendamento cancelado com sucesso!' })
      } catch (error) {
        Toast.fire({ icon: 'error', title: 'Erro ao cancelar o agendamento.' })
      }
    }
  }

  const sairOuVoltar = () => {
    setModo('agendamento')
    setPerfil(null)
    setTelefoneLogin('')
    setTelefoneHistorico('')
    setEtapa(1)
    setEscolha({ servico: null, barbeiro: null, data: null, hora: null })
    setFeriadoSelecionado(null)
  }

  const finalizarAgendamento = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const estaInclusoNoPlano = modo === 'assinante_logado' && (perfil.servicosInclusos.includes(escolha.servico.nome) || escolha.servico.isCombo)
    let barbeiroFinalNome = escolha.barbeiro.nome

    if (escolha.barbeiro.id === 'qualquer') {
      const q = query(collection(db, "agendamentos"), where("data", "==", escolha.data), where("hora", "==", escolha.hora))
      const snap = await getDocs(q)
      const barbeirosOcupadosNesteHorario = snap.docs
        .filter(d => d.data().status !== 'Cancelado')
        .map(d => d.data().barbeiro)
      
      const diaObj = new Date(escolha.data + 'T00:00:00')
      const diaSigla = MAPA_DIAS[diaObj.getDay()]
      const barbeiroLivre = barbeiros.find(b => !barbeirosOcupadosNesteHorario.includes(b.nome) && b.diasTrabalho?.[diaSigla] !== false)
      barbeiroFinalNome = barbeiroLivre ? barbeiroLivre.nome : "Equipe Antunes"
    }

    try {
      const clienteRef = doc(db, "clientes", contato.telefone);
      const clienteSnap = await getDoc(clienteRef);

      if (!clienteSnap.exists()) {
        await setDoc(clienteRef, {
          nome: contato.nome,
          telefone: contato.telefone,
          cortesRestantes: 0,
          planoId: "",
          planoNome: "",
          totalVisitas: 1,
          dataCadastro: new Date().toISOString()
        });
      } else {
        const totalAtual = clienteSnap.data().totalVisitas || 0;
        await updateDoc(clienteRef, { totalVisitas: totalAtual + 1 });
      }

      await addDoc(collection(db, "agendamentos"), {
        servico: escolha.servico.nome,
        preco: (estaInclusoNoPlano && perfil.cortesRestantes > 0) ? "PLANO ATIVO" : escolha.servico.preco,
        barbeiro: barbeiroFinalNome, 
        data: escolha.data,
        hora: escolha.hora,
        clienteNome: contato.nome,
        clienteTelefone: contato.telefone,
        dataCriacao: new Date().toISOString(),
        status: "Pendente"
      })

      if (estaInclusoNoPlano && perfil.cortesRestantes > 0) {
        await updateDoc(doc(db, "clientes", perfil.telefone), { cortesRestantes: perfil.cortesRestantes - 1 })
      }

      try {
        await fetch('http://localhost:3001/api/bot/enviar-confirmacao', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telefone: contato.telefone,
            nomeCliente: contato.nome,
            servico: escolha.servico.nome,
            data: formatarDataAmigavel(escolha.data),
            horario: escolha.hora,
            barbeiro: barbeiroFinalNome
          })
        });
      } catch (errorBot) {
        console.error("Erro ao acionar o bot, mas o agendamento foi salvo:", errorBot);
      }

      setSucesso(true)
    } catch (erro) { 
      console.error(erro);
      Toast.fire({ icon: 'error', title: 'Erro ao confirmar a reserva.' })
    }
    setSalvando(false)
  }

  let listaParaMostrar = [...servicos]
  if (modo === 'assinante_logado' && perfil?.combosExclusivos) {
    perfil.combosExclusivos.forEach(combo => {
      listaParaMostrar.push({ id: 'combo-'+combo.nome, nome: combo.nome, tempo: combo.tempo, preco: 'INCLUSO NO PLANO', isCombo: true })
    })
  }

  const formatarDataAmigavel = (dataFormatoAPI) => {
    if (!dataFormatoAPI) return ''
    const [ano, mes, dia] = dataFormatoAPI.split('-')
    return `${dia}/${mes}`
  }

  // DEFINIÇÃO DAS CORES CSS BASEADO NO ESTADO TEMA (isDark)
  const themeStyles = isDark ? {
    '--cor-bg-geral': '#1a1a1a',
    '--cor-card': '#242424',
    '--cor-borda': '#333333',
    '--cor-texto-principal': '#ffffff',
    '--cor-texto-secundario': '#9ca3af', // gray-400
    '--cor-primaria': '#dc2626', // red-600
  } : {
    '--cor-bg-geral': '#f3f4f6', // gray-100
    '--cor-card': '#ffffff',
    '--cor-borda': '#d1d5db', // gray-300
    '--cor-texto-principal': '#111827', // gray-900
    '--cor-texto-secundario': '#4b5563', // gray-600
    '--cor-primaria': '#dc2626', // Mantendo o vermelho como destaque/marca
  }

  if (sucesso) {
    return (
      <div style={themeStyles} className="min-h-screen w-full bg-[var(--cor-bg-geral)] text-[var(--cor-texto-principal)] flex flex-col items-center justify-center text-center p-6 animate-in zoom-in transition-colors duration-300">
        <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-6 border-2 border-green-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h1 className="text-3xl font-black italic mb-2 text-[var(--cor-texto-principal)]">RESERVADO!</h1>
        <p className="text-[var(--cor-texto-secundario)]">Dia <strong>{formatarDataAmigavel(escolha.data)}</strong> às <strong>{escolha.hora}</strong>, te esperamos lá!</p>
        <button onClick={() => window.location.reload()} className="mt-8 bg-[var(--cor-primaria)] text-white px-8 py-3 rounded-xl font-bold hover:opacity-80 transition-all">VOLTAR AO INÍCIO</button>
      </div>
    )
  }

  const primeiroDiaSemana = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1).getDay();
  const totalDiasMes = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).getDate();
  const gridDias = Array.from({ length: primeiroDiaSemana }).map(() => null).concat(
    Array.from({ length: totalDiasMes }).map((_, i) => new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), i + 1))
  );

  const hoje = new Date();
  const isMesAtual = mesVisivel.getFullYear() === hoje.getFullYear() && mesVisivel.getMonth() === hoje.getMonth();
  const dataLimite = new Date();
  dataLimite.setMonth(hoje.getMonth() + 13);
  const isMesLimite = mesVisivel.getFullYear() === dataLimite.getFullYear() && mesVisivel.getMonth() === dataLimite.getMonth();

  return (
    <div style={themeStyles} className="min-h-screen w-full bg-[var(--cor-bg-geral)] text-[var(--cor-texto-principal)] font-sans transition-colors duration-300">
      <div className="max-w-md mx-auto p-6 min-h-screen pb-24">
        
        <header className="flex justify-between items-center mb-6 pt-4">
          <div onClick={() => window.location.reload()} className="cursor-pointer">
            <h1 className="text-2xl font-black italic text-[var(--cor-primaria)] tracking-tighter uppercase">Antunes</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* BOTÃO DE INVERTER TEMA */}
            <button 
              onClick={() => setIsDark(!isDark)} 
              className="p-2 bg-[var(--cor-card)] border border-[var(--cor-borda)] rounded-lg text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] transition-all flex items-center justify-center"
              title="Alternar Tema"
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {modo === 'agendamento' ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => setModo('login_historico')} 
                  className="text-[9px] bg-[var(--cor-card)] border border-[var(--cor-borda)] text-[var(--cor-texto-secundario)] font-black px-3 py-2 rounded-lg uppercase tracking-widest hover:text-[var(--cor-texto-principal)] hover:border-[var(--cor-texto-secundario)] transition-all"
                >
                  Agendamentos
                </button>
                <button 
                  onClick={() => setModo('login_assinante')} 
                  className="text-[9px] bg-[var(--cor-primaria)] text-white font-black px-3 py-2 rounded-lg uppercase tracking-widest hover:opacity-90 shadow-lg"
                >
                  Assinaturas
                </button>
              </div>
            ) : (
              <button onClick={sairOuVoltar} className="text-[10px] bg-[var(--cor-card)] border border-[var(--cor-borda)] text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] font-black px-3 py-2 rounded-lg uppercase tracking-widest">
                {modo === 'assinante_logado' || modo === 'historico' ? 'Sair' : 'Voltar ao Início'}
              </button>
            )}
          </div>
        </header>

        {modo === 'assinante_logado' && perfil && (
          <div className="bg-[var(--cor-card)] p-5 rounded-2xl border border-[var(--cor-primaria)] shadow-lg mb-8 animate-in fade-in slide-in-from-top-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[var(--cor-primaria)] uppercase tracking-widest font-black mb-1">Membro VIP</p>
              <h2 className="text-xl font-black text-[var(--cor-texto-principal)] italic uppercase truncate max-w-[180px]">{perfil.nome}</h2>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="bg-[var(--cor-primaria)] border border-[var(--cor-primaria)] rounded-xl px-4 py-2 flex flex-col items-center justify-center bg-opacity-10">
                <span className="text-3xl font-black text-[var(--cor-primaria)] leading-none">{perfil.cortesRestantes !== undefined ? perfil.cortesRestantes : 0}</span>
                <span className="text-[9px] text-[var(--cor-texto-secundario)] uppercase tracking-widest font-bold mt-1">Créditos</span>
              </div>
            </div>
          </div>
        )}

        {modo === 'login_assinante' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="text-center mt-8">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--cor-texto-principal)]">Área do <span className="text-[var(--cor-primaria)]">Assinante</span></h2>
            </div>
            <form onSubmit={fazerLogin} className="space-y-4">
              <input required value={telefoneLogin} onChange={e => setTelefoneLogin(e.target.value)} placeholder="Seu Telefone (WhatsApp)" className="w-full bg-[var(--cor-card)] border border-[var(--cor-borda)] p-5 rounded-2xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] text-center text-xl font-black tracking-widest transition-colors" />
              {erroLogin && <p className="text-[var(--cor-primaria)] text-xs text-center font-bold">{erroLogin}</p>}
              <button type="submit" className="w-full bg-[var(--cor-primaria)] text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:opacity-90 shadow-lg">Entrar no Plano</button>
            </form>
          </div>
        )}

        {modo === 'login_historico' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="text-center mt-8">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[var(--cor-texto-principal)]">Meus <span className="text-[var(--cor-primaria)]">Agendamentos</span></h2>
              <p className="text-xs text-[var(--cor-texto-secundario)] mt-2">Acesse seu histórico e gerencie suas reservas</p>
            </div>
            <form onSubmit={buscarHistorico} className="space-y-4">
              <input required value={telefoneHistorico} onChange={e => setTelefoneHistorico(e.target.value)} placeholder="Seu Telefone (WhatsApp)" className="w-full bg-[var(--cor-card)] border border-[var(--cor-borda)] p-5 rounded-2xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] text-center text-xl font-black tracking-widest transition-colors" />
              <button type="submit" disabled={carregandoHistorico} className="w-full bg-[var(--cor-bg-geral)] border border-[var(--cor-borda)] hover:border-[var(--cor-primaria)] text-[var(--cor-texto-principal)] font-black py-5 rounded-2xl uppercase tracking-widest transition-all">
                {carregandoHistorico ? 'Buscando...' : 'Ver Meu Histórico'}
              </button>
            </form>
          </div>
        )}

        {modo === 'historico' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-[var(--cor-texto-principal)] mb-6">Seu <span className="text-[var(--cor-primaria)]">Histórico</span></h2>
            
            {meusAgendamentos.length === 0 ? (
               <div className="text-center p-10 bg-[var(--cor-card)] rounded-3xl border border-[var(--cor-borda)]">
                 <p className="text-[var(--cor-texto-secundario)] font-bold text-sm">Nenhum agendamento encontrado.</p>
               </div>
            ) : (
               meusAgendamentos.map(ag => {
                 const isPendente = ag.status !== 'Concluído' && ag.status !== 'Cancelado'
                 return (
                   <div key={ag.id} className={`p-5 rounded-3xl border transition-all ${!isPendente ? 'bg-[var(--cor-bg-geral)] border-[var(--cor-borda)] opacity-70' : 'bg-[var(--cor-card)] border-[var(--cor-borda)] border-l-4 border-l-[var(--cor-primaria)]'}`}>
                      <div className="flex justify-between items-start mb-2">
                         <div>
                           <p className="text-[var(--cor-texto-principal)] font-black uppercase text-lg italic">{ag.servico}</p>
                           <p className="text-xs text-[var(--cor-texto-secundario)] mt-1 font-bold">
                             {formatarDataAmigavel(ag.data)} às {ag.hora} <br/> 
                             <span className="font-normal">com {ag.barbeiro}</span>
                           </p>
                         </div>
                         <div className="text-right">
                           <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${isPendente ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' : ag.status === 'Cancelado' ? 'bg-red-500/20 text-red-600' : 'bg-green-500/10 text-green-600 border-green-500/20'}`}>
                             {ag.status || 'Pendente'}
                           </span>
                         </div>
                      </div>
                      
                      {isPendente && (
                         <button 
                           onClick={() => cancelarMeuAgendamento(ag)} 
                           className="w-full mt-4 bg-[var(--cor-primaria)] bg-opacity-10 border border-[var(--cor-primaria)] text-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] hover:text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all"
                         >
                           Cancelar Agendamento
                         </button>
                      )}
                   </div>
                 )
               })
            )}
          </div>
        )}

        {(modo === 'agendamento' || modo === 'assinante_logado') && (
          <div className="space-y-6">
            
            {etapa === 1 && (
              <div className="space-y-3 animate-in fade-in">
                <h2 className="text-xs font-black text-[var(--cor-texto-secundario)] uppercase tracking-widest mb-4">Selecione o Corte</h2>
                {listaParaMostrar.map(s => {
                  const estaIncluso = modo === 'assinante_logado' && (perfil.servicosInclusos.includes(s.nome) || s.isCombo)
                  const temSaldo = modo === 'assinante_logado' && perfil.cortesRestantes > 0
                  return (
                    <div key={s.id} onClick={() => { setEscolha({...escolha, servico: s}); setEtapa(2); }} className={`bg-[var(--cor-card)] p-5 rounded-2xl border ${s.isCombo ? 'border-[var(--cor-primaria)] border-opacity-50' : 'border-[var(--cor-borda)]'} flex justify-between items-center hover:border-[var(--cor-primaria)] cursor-pointer group transition-colors`}>
                      <div>
                        <p className="font-bold text-lg text-[var(--cor-texto-principal)] uppercase">{s.isCombo && <span className="text-[var(--cor-primaria)] mr-2">★</span>} {s.nome}</p>
                        <p className="text-xs text-[var(--cor-texto-secundario)] mt-1">{s.tempo} • <span className={`${estaIncluso && temSaldo ? 'text-green-500 font-black' : 'text-[var(--cor-primaria)] font-bold'}`}>{estaIncluso && temSaldo ? 'INCLUSO NO PLANO' : s.preco}</span></p>
                      </div>
                      <span className="text-[var(--cor-primaria)] font-bold text-xl">→</span>
                    </div>
                  )
                })}
              </div>
            )}

            {etapa === 2 && (
              <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => setEtapa(1)} className="text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] text-[10px] font-black uppercase transition-colors">← Voltar</button>
                <h2 className="text-xs font-black text-[var(--cor-texto-secundario)] uppercase tracking-widest mb-4">Escolha o Profissional</h2>
                
                <div onClick={() => { setEscolha({...escolha, barbeiro: {id: 'qualquer', nome: 'Sem Preferência'}}); setEtapa(3); }} className="bg-[var(--cor-primaria)] bg-opacity-10 p-4 rounded-2xl border border-[var(--cor-primaria)] border-opacity-30 flex items-center gap-4 hover:bg-opacity-20 cursor-pointer group transition-all mb-2">
                  <div className="w-14 h-14 flex-shrink-0 bg-[var(--cor-primaria)] flex items-center justify-center rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                  </div>
                  <div>
                    <p className="font-black text-lg text-[var(--cor-primaria)] uppercase italic">Qualquer um</p>
                    <p className="text-[10px] text-[var(--cor-texto-secundario)] uppercase tracking-widest">Mais horários livres</p>
                  </div>
                </div>

                {barbeiros.map(b => (
                  <div key={b.id} onClick={() => { setEscolha({...escolha, barbeiro: b}); setEtapa(3); }} className="bg-[var(--cor-card)] p-4 rounded-2xl border border-[var(--cor-borda)] flex items-center gap-4 hover:border-[var(--cor-primaria)] cursor-pointer transition-colors">
                    <div className="w-14 h-14 flex-shrink-0">{b.foto ? <img src={b.foto} className="w-full h-full rounded-full border-2 border-[var(--cor-primaria)] object-cover" /> : <FotoPadrao />}</div>
                    <p className="font-bold text-lg text-[var(--cor-texto-principal)] uppercase italic">{b.nome}</p>
                  </div>
                ))}
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => { setEtapa(2); setFeriadoSelecionado(null); }} className="text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] text-[10px] font-black uppercase transition-colors">← Voltar</button>
                <h2 className="text-xs font-black text-[var(--cor-texto-secundario)] uppercase tracking-widest mb-4">Escolha o Dia</h2>
                
                <div className="bg-[var(--cor-card)] p-5 rounded-3xl border border-[var(--cor-borda)] shadow-lg">
                  <div className="flex justify-between items-center mb-6">
                    <button 
                      onClick={() => { setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1)); setFeriadoSelecionado(null); }} 
                      disabled={isMesAtual} 
                      className={`p-2 rounded-xl transition-colors ${isMesAtual ? 'text-[var(--cor-borda)]' : 'text-[var(--cor-primaria)] hover:bg-[var(--cor-bg-geral)]'}`}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    
                    <span className="font-black text-lg uppercase tracking-widest text-[var(--cor-texto-principal)]">
                      {NOMES_MESES[mesVisivel.getMonth()]} <span className="text-[var(--cor-texto-secundario)]">{mesVisivel.getFullYear()}</span>
                    </span>
                    
                    <button 
                      onClick={() => { setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1)); setFeriadoSelecionado(null); }} 
                      disabled={isMesLimite} 
                      className={`p-2 rounded-xl transition-colors ${isMesLimite ? 'text-[var(--cor-borda)]' : 'text-[var(--cor-primaria)] hover:bg-[var(--cor-bg-geral)]'}`}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center mb-3">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                      <span key={i} className="text-[10px] font-black text-[var(--cor-texto-secundario)] uppercase">{d}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {gridDias.map((dia, idx) => {
                      if (!dia) return <div key={`empty-${idx}`} />; 
                      const anoStr = dia.getFullYear();
                      const mesStr = String(dia.getMonth() + 1).padStart(2, '0');
                      const diaStr = String(dia.getDate()).padStart(2, '0');
                      const formatoAPI = `${anoStr}-${mesStr}-${diaStr}`;
                      const feriadoInfo = feriados.find(f => f.date === formatoAPI);
                      const eFeriado = configAgenda?.feriadosAtivos && !!feriadoInfo;
                      const disponivel = checarDisponibilidade(dia);
                      
                      return (
                        <button 
                          key={idx} 
                          onClick={() => {
                            if (eFeriado) {
                              setFeriadoSelecionado(feriadoInfo.name);
                            } else if (disponivel) {
                              setFeriadoSelecionado(null);
                              selecionarData({ dataReal: dia, formatoAPI: formatoAPI });
                            }
                          }} 
                          className={`aspect-square w-full rounded-2xl flex items-center justify-center text-sm font-bold transition-all relative
                            ${disponivel 
                              ? 'text-[var(--cor-texto-principal)] bg-[var(--cor-bg-geral)] hover:bg-[var(--cor-primaria)] hover:text-white hover:scale-105 border border-[var(--cor-borda)] hover:border-[var(--cor-primaria)] shadow-sm' 
                              : eFeriado 
                                ? 'border-2 border-[var(--cor-primaria)] text-[var(--cor-primaria)] bg-[var(--cor-primaria)] bg-opacity-10 animate-pulse cursor-pointer' 
                                : 'text-[var(--cor-texto-secundario)] opacity-30 cursor-not-allowed'}`}
                        >
                          {dia.getDate()}
                          {eFeriado && <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--cor-primaria)] rounded-full"></span>}
                        </button>
                      )
                    })}
                  </div>
                  
                  {feriadoSelecionado && (
                    <div className="mt-6 p-4 bg-[var(--cor-primaria)] bg-opacity-10 border border-[var(--cor-primaria)] border-opacity-30 rounded-2xl animate-in fade-in zoom-in">
                      <div className="flex items-center gap-2 text-[var(--cor-primaria)] mb-1">
                        <Info size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Feriado Detectado</span>
                      </div>
                      <p className="text-[var(--cor-texto-principal)] font-bold text-sm mt-2">Fechado devido a: <span className="italic">{feriadoSelecionado}</span></p>
                    </div>
                  )}

                </div>
              </div>
            )}

            {etapa === 4 && (
              <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => setEtapa(3)} className="text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] text-[10px] font-black uppercase transition-colors">← Voltar para Dias</button>
                <h2 className="text-xs font-black text-[var(--cor-texto-secundario)] uppercase tracking-widest mb-4">Horários em {formatarDataAmigavel(escolha.data)}</h2>
                <div className="grid grid-cols-3 gap-3">
                  {horariosGerados.map(h => {
                    const estaOcupado = horariosOcupados.includes(h)
                    return (
                      <button 
                        key={h} 
                        disabled={estaOcupado}
                        onClick={() => { setEscolha({...escolha, hora: h}); setEtapa(5); }} 
                        className={`py-4 rounded-xl font-black text-sm transition-all border 
                          ${estaOcupado ? 'bg-[var(--cor-bg-geral)] border-[var(--cor-borda)] text-[var(--cor-texto-secundario)] line-through opacity-50 cursor-not-allowed' : 'bg-[var(--cor-card)] text-[var(--cor-texto-principal)] border-[var(--cor-borda)] hover:bg-[var(--cor-primaria)] hover:text-white hover:border-[var(--cor-primaria)]'}`}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
                {horariosGerados.length === 0 && <p className="text-center text-xs text-[var(--cor-texto-secundario)] mt-10">Nenhum horário disponível para este dia.</p>}
              </div>
            )}

            {etapa === 5 && (
              <div className="space-y-6 animate-in slide-in-from-right">
                <button onClick={() => setEtapa(4)} className="text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] text-[10px] font-black uppercase transition-colors">← Voltar aos Horários</button>
                
                <div className="bg-[var(--cor-card)] p-6 rounded-2xl border-l-4 border-l-[var(--cor-primaria)] border-[var(--cor-borda)] shadow-lg">
                  <p className="text-[10px] font-black text-[var(--cor-primaria)] uppercase tracking-widest mb-2">Resumo da Reserva</p>
                  <p className="text-xl font-black uppercase italic text-[var(--cor-texto-principal)]">{escolha.servico.nome}</p>
                  <p className="text-sm text-[var(--cor-texto-secundario)] mt-1">
                    Com <span className="text-[var(--cor-texto-principal)] font-bold">{escolha.barbeiro.id === 'qualquer' ? 'Profissional Disponível' : escolha.barbeiro.nome}</span> no dia <span className="text-[var(--cor-texto-principal)] font-bold">{formatarDataAmigavel(escolha.data)}</span> às <span className="text-[var(--cor-texto-principal)] font-bold">{escolha.hora}</span>
                  </p>
                  
                  <div className="mt-4 pt-4 border-t border-[var(--cor-borda)]">
                    <p className="text-xs text-[var(--cor-texto-secundario)] uppercase font-black">Valor Final</p>
                    {modo === 'assinante_logado' && (perfil.servicosInclusos.includes(escolha.servico.nome) || escolha.servico.isCombo) && perfil.cortesRestantes > 0 ? (
                      <p className="text-lg font-black text-green-500">1 Crédito do Plano</p>
                    ) : (
                      <p className="text-lg font-black text-[var(--cor-primaria)]">{escolha.servico.preco} (Pagar no local)</p>
                    )}
                  </div>
                </div>

                <form onSubmit={finalizarAgendamento} className="space-y-4">
                  <input required value={contato.telefone} onChange={e => setContato({...contato, telefone: e.target.value})} placeholder="Seu WhatsApp (ex: 53999999999)" className="w-full bg-[var(--cor-bg-geral)] border border-[var(--cor-borda)] p-5 rounded-2xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] transition-colors" />
                  <input required value={contato.nome} onChange={e => setContato({...contato, nome: e.target.value})} placeholder="Seu Nome Completo" className="w-full bg-[var(--cor-bg-geral)] border border-[var(--cor-borda)] p-5 rounded-2xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] transition-colors" />
                  
                  <button type="submit" disabled={salvando} className="w-full bg-[var(--cor-primaria)] text-white font-black py-5 rounded-2xl hover:opacity-90 shadow-lg uppercase tracking-widest mt-4 transition-opacity">
                    {salvando ? 'Processando...' : (modo === 'assinante_logado' && (perfil.servicosInclusos.includes(escolha.servico.nome) || escolha.servico.isCombo) && perfil.cortesRestantes > 0) ? 'CONFIRMAR (USAR CRÉDITO)' : 'CONFIRMAR AGENDAMENTO'}
                  </button>
                </form>
              </div>
            )} 
          </div>
        )}
      </div>
    </div>
  )
}