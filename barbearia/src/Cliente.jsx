import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore'

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
  
  const [perfil, setPerfil] = useState(null)
  const [telefoneLogin, setTelefoneLogin] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const [contato, setContato] = useState({ nome: '', telefone: '' })
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  
  const [barbeiros, setBarbeiros] = useState([])
  
  // DADOS DA AGENDA INTELIGENTE
  const [configAgenda, setConfigAgenda] = useState(null)
  const [feriados, setFeriados] = useState([])
  const [diasDisponiveis, setDiasDisponiveis] = useState([])
  const [horariosGerados, setHorariosGerados] = useState([])
  const [horariosOcupados, setHorariosOcupados] = useState([])

  useEffect(() => {
    const carregarTudo = async () => {
      // Barbeiros
      const snapB = await getDocs(collection(db, "barbeiros"))
      setBarbeiros(snapB.docs.map(d => ({ id: d.id, ...d.data() })))

      // Configuração da Agenda 
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

      // Feriados da API
      const ano = new Date().getFullYear()
      let feriadosLocal = []
      try {
        const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`)
        const dados = await res.json()
        feriadosLocal = dados.map(f => f.date)
        setFeriados(feriadosLocal)
      } catch(e) { console.error(e) }

      // GERA OS PRÓXIMOS 15 DIAS
      let proximosDias = []
      for(let i=0; i<15; i++) {
        let d = new Date()
        d.setDate(d.getDate() + i)
        let formatoAPI = d.toISOString().split('T')[0]
        let diaSemana = d.getDay()
        
        if(cfg.horariosPorDia && cfg.horariosPorDia[diaSemana] && cfg.horariosPorDia[diaSemana].ativo) {
          if(!cfg.feriadosAtivos || !feriadosLocal.includes(formatoAPI)) {
            proximosDias.push({ dataReal: d, formatoAPI: formatoAPI })
          }
        }
      }
      setDiasDisponiveis(proximosDias)
    }
    carregarTudo()
  }, [])

  // ==========================================
  // NOVA LÓGICA DE GERAR HORÁRIOS COM "SEM PREFERÊNCIA" E TRAVA DE TEMPO
  // ==========================================
  const selecionarData = async (dia) => {
    setEscolha({...escolha, data: dia.formatoAPI})
    setEtapa(4)

    const diaSemana = dia.dataReal.getDay()
    const regraDoDia = configAgenda.horariosPorDia[diaSemana]

    let ocupados = []

    if (escolha.barbeiro.id === 'qualquer') {
      // 2A. O CLIENTE NÃO TEM PREFERÊNCIA
      const q = query(collection(db, "agendamentos"), where("data", "==", dia.formatoAPI))
      const snap = await getDocs(q)
      
      const contagemHoras = {}
      snap.docs.forEach(d => {
        const h = d.data().hora
        contagemHoras[h] = (contagemHoras[h] || 0) + 1
      })

      const totalBarbeiros = barbeiros.length || 1
      for (const [hora, qtd] of Object.entries(contagemHoras)) {
        if (qtd >= totalBarbeiros) ocupados.push(hora)
      }

    } else {
      // 2B. O CLIENTE ESCOLHEU UM BARBEIRO ESPECÍFICO
      const q = query(
        collection(db, "agendamentos"), 
        where("barbeiro", "==", escolha.barbeiro.nome),
        where("data", "==", dia.formatoAPI)
      )
      const snap = await getDocs(q)
      ocupados = snap.docs.map(d => d.data().hora)
    }

    setHorariosOcupados(ocupados)

    // 3. GERA OS SLOTS DE HORÁRIO COM TRAVA PARA HORÁRIOS PASSADOS
    const gerarSlots = (inicio, fim, intervalo) => {
      let slots = []
      let [h, m] = inicio.split(':').map(Number)
      let fimMin = fim.split(':').map(Number)
      let totalFim = fimMin[0] * 60 + fimMin[1]
      let atual = h * 60 + m

      // Verifica se a data selecionada é o dia de hoje
      const agora = new Date()
      const eHoje = dia.dataReal.getDate() === agora.getDate() && 
                    dia.dataReal.getMonth() === agora.getMonth() && 
                    dia.dataReal.getFullYear() === agora.getFullYear()
      
      const minutosAtuais = agora.getHours() * 60 + agora.getMinutes()

      while(atual + parseInt(intervalo) <= totalFim) {
        // Se não for hoje, libera. Se for hoje, só libera horários futuros.
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

  const sairOuVoltar = () => {
    setModo('agendamento'); setPerfil(null); setTelefoneLogin(''); setEtapa(1); setEscolha({ servico: null, barbeiro: null, data: null, hora: null })
  }

  // ==========================================
  // DISTRIBUIÇÃO AUTOMÁTICA DE BARBEIRO
  // ==========================================
  const finalizarAgendamento = async (e) => {
    e.preventDefault()
    setSalvando(true)

    const estaInclusoNoPlano = modo === 'assinante_logado' && (perfil.servicosInclusos.includes(escolha.servico.nome) || escolha.servico.isCombo)

    let barbeiroFinalNome = escolha.barbeiro.nome

    if (escolha.barbeiro.id === 'qualquer') {
      const q = query(collection(db, "agendamentos"), where("data", "==", escolha.data), where("hora", "==", escolha.hora))
      const snap = await getDocs(q)
      const barbeirosOcupadosNesteHorario = snap.docs.map(d => d.data().barbeiro)
      
      const barbeiroLivre = barbeiros.find(b => !barbeirosOcupadosNesteHorario.includes(b.nome))
      barbeiroFinalNome = barbeiroLivre ? barbeiroLivre.nome : "Equipe Antunes"
    }

    try {
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
    } catch (erro) { alert("Erro ao confirmar.") }
    setSalvando(false)
  }

  let listaParaMostrar = [...servicos]
  if (modo === 'assinante_logado' && perfil?.combosExclusivos) {
    perfil.combosExclusivos.forEach(combo => {
      listaParaMostrar.push({ id: 'combo-'+combo.nome, nome: combo.nome, tempo: combo.tempo, preco: 'INCLUSO NO PLANO', isCombo: true })
    })
  }

  const formatarDataAmigavel = (dataFormatoAPI) => {
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

  return (
    <div className="min-h-screen w-full bg-[#1a1a1a] text-white font-sans selection:bg-red-600">
      <div className="max-w-md mx-auto p-6 min-h-screen pb-24">
        
        <header className="flex justify-between items-center mb-6 pt-4">
          <div onClick={() => window.location.reload()} className="cursor-pointer">
            <h1 className="text-2xl font-black italic text-red-600 tracking-tighter uppercase">Antunes</h1>
          </div>
          {modo === 'agendamento' ? (
            <button onClick={() => setModo('login_assinante')} className="text-[10px] bg-red-600 text-white font-black px-3 py-2 rounded-lg uppercase tracking-widest hover:bg-red-700">Assinaturas</button>
          ) : (
            <button onClick={sairOuVoltar} className="text-[10px] bg-[#242424] border border-[#333] text-gray-400 hover:text-white font-black px-3 py-2 rounded-lg uppercase tracking-widest">{modo === 'assinante_logado' ? 'Sair da Conta' : 'Voltar ao Início'}</button>
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
              <button type="submit" className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-red-700">Entrar no Plano</button>
            </form>
          </div>
        )}

        {(modo === 'agendamento' || modo === 'assinante_logado') && (
          <div className="space-y-6">
            
            {/* ETAPA 1: SERVIÇO */}
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

            {/* ETAPA 2: BARBEIRO */}
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

            {/* ETAPA 3: DIA */}
            {etapa === 3 && (
              <div className="space-y-4 animate-in slide-in-from-right">
                <button onClick={() => setEtapa(2)} className="text-gray-400 hover:text-white text-[10px] font-black uppercase">← Voltar</button>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Escolha o Dia</h2>
                <div className="grid grid-cols-2 gap-3">
                  {diasDisponiveis.map((dia, idx) => {
                    const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
                    return (
                      <button key={idx} onClick={() => selecionarData(dia)} className="bg-[#242424] py-4 rounded-xl border border-[#333] hover:bg-red-600 flex flex-col items-center transition-colors">
                        <span className="text-[10px] text-gray-400 uppercase font-black">{diasNomes[dia.dataReal.getDay()]}</span>
                        <span className="text-lg font-black text-white">{dia.dataReal.getDate().toString().padStart(2, '0')}/{((dia.dataReal.getMonth())+1).toString().padStart(2, '0')}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ETAPA 4: HORA */}
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

            {/* ETAPA 5: CONFIRMAÇÃO E DADOS */}
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
                  <input required value={contato.nome} onChange={e => setContato({...contato, nome: e.target.value})} placeholder="Seu Nome" className="w-full bg-[#111111] border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-red-600" />
                  <input required value={contato.telefone} onChange={e => setContato({...contato, telefone: e.target.value})} placeholder="WhatsApp" className="w-full bg-[#111111] border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-red-600" />
                  
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