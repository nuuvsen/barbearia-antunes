import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, query, where, deleteDoc, limit, setDoc } from 'firebase/firestore'
import { Info } from 'lucide-react'

const MAPA_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const FotoPadrao = () => (
  <div className="w-14 h-14 bg-[#111111] flex items-center justify-center rounded-full border-2 border-red-600/30">
    <svg viewBox="0 0 100 100" className="w-8 h-8 fill-none stroke-red-600" strokeWidth="3">
      <path d="M70 20 L30 60 L20 50 L60 10 Z" fill="currentColor" opacity="0.2" />
      <path d="M30 60 L75 15" strokeLinecap="round" />
      <text x="50%" y="65%" textAnchor="middle" className="fill-red-600 font-black italic tracking-tighter" fontSize="30">A</text>
    </svg>
  </div>
)

export default function Cliente({ servicos }) {
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
        }
      }
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
    const barbeariaAberta = configAgenda.horariosPorDia[diaNum]?.ativo;
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
    const regraDoDia = configAgenda.horariosPorDia[diaSemana]
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
      alert("Erro ao buscar histórico.")
    }
    setCarregandoHistorico(false)
  }

  const cancelarMeuAgendamento = async (agendamento) => {
    if(window.confirm(`Deseja cancelar o agendamento de ${agendamento.servico} do dia ${formatarDataAmigavel(agendamento.data)} às ${agendamento.hora}?`)) {
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
        
        alert("Agendamento cancelado com sucesso!")
      } catch (error) {
        alert("Erro ao cancelar o agendamento.")
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
      // --- LÓGICA PARA GARANTIR QUE O CLIENTE ESTEJA NA COLEÇÃO "clientes" ---
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
        // Se já existe, apenas incrementa as visitas (opcional)
        const totalAtual = clienteSnap.data().totalVisitas || 0;
        await updateDoc(clienteRef, { totalVisitas: totalAtual + 1 });
      }
      // -----------------------------------------------------------------------

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
      setSucesso(true)
    } catch (erro) { 
      console.error(erro);
      alert("Erro ao confirmar."); 
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

  if (sucesso) {
    return (
      <div className="min-h-screen w-full bg-[#1a1a1a] text-white flex flex-col items-center justify-center text-center p-6 animate-in zoom-in">
        <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-6 border-2 border-green-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h1 className="text-3xl font-black italic mb-2 text-white">RESERVADO!</h1>
        <p className="text-gray-400">Dia <strong>{formatarDataAmigavel(escolha.data)}</strong> às <strong>{escolha.hora}</strong>, te esperamos lá!</p>
        <button onClick={() => window.location.reload()} className="mt-8 bg-red-600 px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-all">VOLTAR AO INÍCIO</button>
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
    <div className="min-h-screen w-full bg-[#1a1a1a] text-white font-sans selection:bg-red-600">
      <div className="max-w-md mx-auto p-6 min-h-screen pb-24">
        
        <header className="flex justify-between items-center mb-6 pt-4">
          <div onClick={() => window.location.reload()} className="cursor-pointer">
            <h1 className="text-2xl font-black italic text-red-600 tracking-tighter uppercase">Antunes</h1>
          </div>
          
          {modo === 'agendamento' ? (
            <div className="flex gap-2">
              <button 
                onClick={() => setModo('login_historico')} 
                className="text-[9px] bg-[#242424] border border-[#333] text-gray-300 font-black px-3 py-2 rounded-lg uppercase tracking-widest hover:text-white hover:border-gray-500 transition-all"
              >
                Agendamentos
              </button>
              <button 
                onClick={() => setModo('login_assinante')} 
                className="text-[9px] bg-red-600 text-white font-black px-3 py-2 rounded-lg uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-600/20"
              >
                Assinaturas
              </button>
            </div>
          ) : (
            <button onClick={sairOuVoltar} className="text-[10px] bg-[#242424] border border-[#333] text-gray-400 hover:text-white font-black px-3 py-2 rounded-lg uppercase tracking-widest">
              {modo === 'assinante_logado' || modo === 'historico' ? 'Sair' : 'Voltar ao Início'}
            </button>
          )}
        </header>

        {modo === 'assinante_logado' && perfil && (
          <div className="bg-gradient-to-br from-[#242424] to-[#1a1a1a] p-5 rounded-2xl border border-red-600/30 shadow-lg mb-8 animate-in fade-in slide-in-from-top-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-red-500 uppercase tracking-widest font-black mb-1">Membro VIP</p>
              <h2 className="text-xl font-black text-white italic uppercase truncate max-w-[180px]">{perfil.nome}</h2>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="bg-red-600/10 border border-red-600/30 rounded-xl px-4 py-2 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-red-500 leading-none">{perfil.cortesRestantes !== undefined ? perfil.cortesRestantes : 0}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mt-1">Créditos</span>
              </div>
            </div>
          </div>
        )}

        {modo === 'login_assinante' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="text-center mt-8">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Área do <span className="text-red-600">Assinante</span></h2>
            </div>
            <form onSubmit={fazerLogin} className="space-y-4">
              <input required value={telefoneLogin} onChange={e => setTelefoneLogin(e.target.value)} placeholder="Seu Telefone (WhatsApp)" className="w-full bg-[#242424] border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-red-600 text-center text-xl font-black tracking-widest" />
              {erroLogin && <p className="text-red-500 text-xs text-center font-bold">{erroLogin}</p>}
              <button type="submit" className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-600/20">Entrar no Plano</button>
            </form>
          </div>
        )}

        {modo === 'login_historico' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="text-center mt-8">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Meus <span className="text-red-600">Agendamentos</span></h2>
              <p className="text-xs text-gray-500 mt-2">Acesse seu histórico e gerencie suas reservas</p>
            </div>
            <form onSubmit={buscarHistorico} className="space-y-4">
              <input required value={telefoneHistorico} onChange={e => setTelefoneHistorico(e.target.value)} placeholder="Seu Telefone (WhatsApp)" className="w-full bg-[#242424] border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-red-600 text-center text-xl font-black tracking-widest" />
              <button type="submit" disabled={carregandoHistorico} className="w-full bg-[#111] border border-[#333] hover:border-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest transition-all">
                {carregandoHistorico ? 'Buscando...' : 'Ver Meu Histórico'}
              </button>
            </form>
          </div>
        )}

        {modo === 'historico' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6">Seu <span className="text-red-600">Histórico</span></h2>
            
            {meusAgendamentos.length === 0 ? (
               <div className="text-center p-10 bg-[#242424] rounded-3xl border border-[#333]">
                 <p className="text-gray-400 font-bold text-sm">Nenhum agendamento encontrado.</p>
               </div>
            ) : (
               meusAgendamentos.map(ag => {
                 const isPendente = ag.status !== 'Concluído' && ag.status !== 'Cancelado'
                 return (
                   <div key={ag.id} className={`p-5 rounded-3xl border transition-all ${!isPendente ? 'bg-[#111] border-[#222] opacity-60' : 'bg-[#242424] border-[#333] border-l-4 border-l-red-600'}`}>
                      <div className="flex justify-between items-start mb-2">
                         <div>
                           <p className="text-white font-black uppercase text-lg italic">{ag.servico}</p>
                           <p className="text-xs text-gray-400 mt-1 font-bold">
                             {formatarDataAmigavel(ag.data)} às {ag.hora} <br/> 
                             <span className="text-gray-500 font-normal">com {ag.barbeiro}</span>
                           </p>
                         </div>
                         <div className="text-right">
                           <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${isPendente ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : ag.status === 'Cancelado' ? 'bg-red-500/20 text-red-500' : 'bg-gray-800 text-gray-500'}`}>
                             {ag.status || 'Pendente'}
                           </span>
                         </div>
                      </div>
                      
                      {isPendente && (
                         <button 
                           onClick={() => cancelarMeuAgendamento(ag)} 
                           className="w-full mt-4 bg-red-600/10 border border-red-600/20 text-red-500 hover:bg-red-600 hover:text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all"
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
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Selecione o Corte</h2>
                {listaParaMostrar.map(s => {
                  const estaIncluso = modo === 'assinante_logado' && (perfil.servicosInclusos.includes(s.nome) || s.isCombo)
                  const temSaldo = modo === 'assinante_logado' && perfil.cortesRestantes > 0
                  return (
                    <div key={s.id} onClick={() => { setEscolha({...escolha, servico: s}); setEtapa(2); }} className={`bg-[#242424] p-5 rounded-2xl border ${s.isCombo ? 'border-red-600/50' : 'border-[#333]'} flex justify-between items-center hover:border-red-600 cursor-pointer group`}>
                      <div>
                        <p className="font-bold text-lg text-white uppercase">{s.isCombo && <span className="text-red-500 mr-2">★</span>} {s.nome}</p>
                        <p className="text-xs text-gray-400 mt-1">{s.tempo} • <span className={`${estaIncluso && temSaldo ? 'text-green-500 font-black' : 'text-red-500 font-bold'}`}>{estaIncluso && temSaldo ? 'INCLUSO NO PLANO' : s.preco}</span></p>
                      </div>
                      <span className="text-red-600 font-bold text-xl">→</span>
                    </div>
                  )
                })}
              </div>
            )}

            {etapa === 2 && (
              <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => setEtapa(1)} className="text-gray-400 hover:text-white text-[10px] font-black uppercase">← Voltar</button>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Escolha o Profissional</h2>
                
                <div onClick={() => { setEscolha({...escolha, barbeiro: {id: 'qualquer', nome: 'Sem Preferência'}}); setEtapa(3); }} className="bg-red-600/10 p-4 rounded-2xl border border-red-600/30 flex items-center gap-4 hover:bg-red-600/20 cursor-pointer group transition-all mb-2">
                  <div className="w-14 h-14 flex-shrink-0 bg-red-600 flex items-center justify-center rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                  </div>
                  <div>
                    <p className="font-black text-lg text-red-500 uppercase italic">Qualquer um</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Mais horários livres</p>
                  </div>
                </div>

                {barbeiros.map(b => (
                  <div key={b.id} onClick={() => { setEscolha({...escolha, barbeiro: b}); setEtapa(3); }} className="bg-[#242424] p-4 rounded-2xl border border-[#333] flex items-center gap-4 hover:border-red-600 cursor-pointer">
                    <div className="w-14 h-14 flex-shrink-0">{b.foto ? <img src={b.foto} className="w-full h-full rounded-full border-2 border-red-600 object-cover" /> : <FotoPadrao />}</div>
                    <p className="font-bold text-lg text-white uppercase italic">{b.nome}</p>
                  </div>
                ))}
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => { setEtapa(2); setFeriadoSelecionado(null); }} className="text-gray-400 hover:text-white text-[10px] font-black uppercase">← Voltar</button>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Escolha o Dia</h2>
                
                <div className="bg-[#242424] p-5 rounded-3xl border border-[#333] shadow-lg">
                  <div className="flex justify-between items-center mb-6">
                    <button 
                      onClick={() => { setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1)); setFeriadoSelecionado(null); }} 
                      disabled={isMesAtual} 
                      className={`p-2 rounded-xl transition-colors ${isMesAtual ? 'text-[#333]' : 'text-red-500 hover:bg-[#111]'}`}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    
                    <span className="font-black text-lg uppercase tracking-widest text-white">
                      {NOMES_MESES[mesVisivel.getMonth()]} <span className="text-gray-500">{mesVisivel.getFullYear()}</span>
                    </span>
                    
                    <button 
                      onClick={() => { setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1)); setFeriadoSelecionado(null); }} 
                      disabled={isMesLimite} 
                      className={`p-2 rounded-xl transition-colors ${isMesLimite ? 'text-[#333]' : 'text-red-500 hover:bg-[#111]'}`}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center mb-3">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                      <span key={i} className="text-[10px] font-black text-gray-500 uppercase">{d}</span>
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
                              ? 'text-white bg-[#111] hover:bg-red-600 hover:scale-105 border border-[#333] hover:border-red-600 shadow-sm' 
                              : eFeriado 
                                ? 'border-2 border-red-600 text-red-500 bg-red-600/5 animate-pulse cursor-pointer' 
                                : 'text-gray-600 opacity-20 cursor-not-allowed'}`}
                        >
                          {dia.getDate()}
                          {eFeriado && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full"></span>}
                        </button>
                      )
                    })}
                  </div>
                  
                  {feriadoSelecionado && (
                    <div className="mt-6 p-4 bg-red-600/10 border border-red-600/30 rounded-2xl animate-in fade-in zoom-in">
                      <div className="flex items-center gap-2 text-red-500 mb-1">
                        <Info size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Feriado Detectado</span>
                      </div>
                      <p className="text-white font-bold text-sm mt-2">Fechado devido a: <span className="italic">{feriadoSelecionado}</span></p>
                    </div>
                  )}

                </div>
              </div>
            )}

            {etapa === 4 && (
              <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => setEtapa(3)} className="text-gray-400 hover:text-white text-[10px] font-black uppercase">← Voltar para Dias</button>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Horários em {formatarDataAmigavel(escolha.data)}</h2>
                <div className="grid grid-cols-3 gap-3">
                  {horariosGerados.map(h => {
                    const estaOcupado = horariosOcupados.includes(h)
                    return (
                      <button 
                        key={h} 
                        disabled={estaOcupado}
                        onClick={() => { setEscolha({...escolha, hora: h}); setEtapa(5); }} 
                        className={`py-4 rounded-xl font-black text-sm transition-all border 
                          ${estaOcupado ? 'bg-[#111] border-[#222] text-gray-600 line-through opacity-50 cursor-not-allowed' : 'bg-[#242424] text-white border-[#333] hover:bg-red-600 hover:border-red-600'}`}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
                {horariosGerados.length === 0 && <p className="text-center text-xs text-gray-500 mt-10">Nenhum horário disponível para este dia.</p>}
              </div>
            )}

            {etapa === 5 && (
              <div className="space-y-6 animate-in slide-in-from-right">
                <button onClick={() => setEtapa(4)} className="text-gray-400 hover:text-white text-[10px] font-black uppercase">← Voltar aos Horários</button>
                
                <div className="bg-[#242424] p-6 rounded-2xl border-l-4 border-l-red-600 border-[#333] shadow-lg">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Resumo da Reserva</p>
                  <p className="text-xl font-black uppercase italic text-white">{escolha.servico.nome}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Com <span className="text-white font-bold">{escolha.barbeiro.id === 'qualquer' ? 'Profissional Disponível' : escolha.barbeiro.nome}</span> no dia <span className="text-white font-bold">{formatarDataAmigavel(escolha.data)}</span> às <span className="text-white font-bold">{escolha.hora}</span>
                  </p>
                  
                  <div className="mt-4 pt-4 border-t border-[#333]">
                    <p className="text-xs text-gray-500 uppercase font-black">Valor Final</p>
                    {modo === 'assinante_logado' && (perfil.servicosInclusos.includes(escolha.servico.nome) || escolha.servico.isCombo) && perfil.cortesRestantes > 0 ? (
                      <p className="text-lg font-black text-green-500">1 Crédito do Plano</p>
                    ) : (
                      <p className="text-lg font-black text-red-500">{escolha.servico.preco} (Pagar no local)</p>
                    )}
                  </div>
                </div>

                <form onSubmit={finalizarAgendamento} className="space-y-4">
                  <input required value={contato.telefone} onChange={e => setContato({...contato, telefone: e.target.value})} placeholder="Seu WhatsApp (ex: 53999999999)" className="w-full bg-[#111111] border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-red-600" />
                  <input required value={contato.nome} onChange={e => setContato({...contato, nome: e.target.value})} placeholder="Seu Nome Completo" className="w-full bg-[#111111] border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-red-600" />
                  
                  <button type="submit" disabled={salvando} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-700 shadow-lg shadow-red-600/20 uppercase tracking-widest mt-4">
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