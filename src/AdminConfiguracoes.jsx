import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import {
  Percent, Clock, Save, User, Calendar,
  AlertCircle, Headphones, Palette, ChevronDown, Plus, Trash2, CalendarRange, Bot, Edit2, X, Users, MessageCircle, Zap, Hand
} from 'lucide-react'
import AdminSuporte from './AdminSuporte'
import Personalizacao from './Personalizacao'
import GerenciadorBot from './GerenciadorBot'
import Carregando from './Carregando'

const DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const paraMinutos = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Um turno é válido se, quando tiver início e fim preenchidos, o fim vier depois do início.
const turnoValido = (ini, fim) => {
  const iniMin = paraMinutos(ini)
  const fimMin = paraMinutos(fim)
  if (iniMin === null || fimMin === null) return true
  return fimMin > iniMin
}

// Confere o dia inteiro: os dois turnos válidos individualmente, e a tarde não pode começar
// antes da manhã terminar — sem essa checagem, um horário assim ficava com a grade vazia (ou
// sobreposta) sem nenhum aviso pro admin, já que gerarGradeDaData só deduplica em silêncio.
const diaValido = (dados) => {
  if (!turnoValido(dados.t1Ini, dados.t1Fim)) return false
  if (!turnoValido(dados.t2Ini, dados.t2Fim)) return false
  const fimManha = paraMinutos(dados.t1Fim)
  const iniTarde = paraMinutos(dados.t2Ini)
  if (fimManha !== null && iniTarde !== null && iniTarde < fimManha) return false
  return true
}

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminConfiguracoes() {
  const [secao, setSecao] = useState('comissoes')
  const [barbeiros, setBarbeiros] = useState([])
  // Bug real encontrado: esta aba salvava as comissões digitadas num documento separado
  // (configuracoes/comissoes) que NADA no sistema lia de volta — o cálculo real de comissão,
  // tanto em Comanda.jsx quanto em AdminDashboard.jsx (ao concluir um agendamento), sempre usa
  // o campo comissaoServico gravado no próprio documento do barbeiro (barbeiros/{id}), que só
  // a tela Gerência → Barbeiros editava de verdade. Ou seja: o admin mudava a % aqui, via
  // "Configurações → Comissões", via "Salvar Tudo" e mostrava "salvo com sucesso" — mas nenhum
  // pagamento real usava esse valor, então a comissão de fato paga continuava a antiga, sem
  // aviso nenhum. Agora esta aba edita e salva diretamente barbeiros/{id}.comissaoServico, o
  // mesmo campo que todo o resto do sistema já lê, então as duas telas ficam consistentes.
  const [comissoesEditadas, setComissoesEditadas] = useState({}) // { [barbeiroId]: novoValor }
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // CORES INICIAIS
  const [cores, setCores] = useState({
    primaria: '#fbbf24',
    fundo: '#f8f9fa',
    card: '#ffffff',
    textoPrincipal: '#111827',
    textoSecundario: '#6b7280',
    borda: '#e5e7eb',
    inputBg: '#ffffff'
  })

  // CONFIGURAÇÃO DA AGENDA
  const [configAgenda, setConfigAgenda] = useState({
    intervalo: '30',
    feriadosAtivos: true,
    // Modo de funcionamento da Lista de Espera (ver bloqueioUtils.js liberarHorario):
    // 'manual' (padrão) -> só fica visível pro admin, nada automático acontece.
    // 'bot' -> segura o horário e pergunta pro primeiro da fila via WhatsApp, sem prazo.
    // 'automatico' -> agenda direto pro primeiro da fila e só avisa.
    listaEsperaModo: 'manual',
    horariosPorDia: {
      0: { ativo: false, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '18:00' },
      1: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      2: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      3: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      4: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      5: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '20:00' },
      6: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '18:00' }
    },
    excecoes: {}, // Datas exatas (ex: '2026-05-15')
    regrasSemanas: [] // Regras por semana do mês
  })

  // ESTADOS PARA NOVA EXCEÇÃO DE DATA EXATA
  const [dataNovaExcecao, setDataNovaExcecao] = useState('')
  const [formExcecao, setFormExcecao] = useState({
    ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '20:00'
  })
  // true quando a data escolhida acima já tem uma exceção salva (carregada pra edição) —
  // sem isso, clicar em "Criar" de novo sobrescrevia silenciosamente o que já estava
  // configurado, trocando pelos valores padrão do formulário.
  const [dataEmEdicao, setDataEmEdicao] = useState(false)

  // ESTADOS PARA NOVA REGRA DE SEMANA
  const [formRegraSemana, setFormRegraSemana] = useState({
    diaSemana: 5, // Padrão: Sexta
    semanas: [1, 2], // Padrão: 1ª e 2ª semana
    ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00'
  })
  const [editandoRegraId, setEditandoRegraId] = useState(null)

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const coresRef = doc(db, "configuracoes", "personalizacao")
        const coresSnap = await getDoc(coresRef)
        if (coresSnap.exists()) {
          const d = coresSnap.data().cores
          setCores({
            primaria: d.primaria || '#fbbf24', fundo: d.fundo || '#f8f9fa', card: d.card || '#ffffff',
            textoPrincipal: d.texto || '#111827', textoSecundario: d.textoSecundario || '#6b7280',
            borda: d.borda || '#e5e7eb', inputBg: d.inputBg || '#ffffff' 
          })
        }

        const bSnap = await getDocs(collection(db, "barbeiros"))
        setBarbeiros(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        const agendaRef = doc(db, "configuracoes", "agenda")
        const agendaSnap = await getDoc(agendaRef)
        if (agendaSnap.exists()) {
          const dadosAgenda = agendaSnap.data()
          setConfigAgenda({
            ...dadosAgenda,
            excecoes: dadosAgenda.excecoes || {},
            regrasSemanas: dadosAgenda.regrasSemanas || [],
            listaEsperaModo: dadosAgenda.listaEsperaModo || 'manual'
          })
        }
      } catch (e) {
        console.error("Erro:", e)
      } finally {
        setCarregando(false)
      }
    }
    carregarDados()
  }, [])

  const handleDiaChange = (diaIdx, campo, valor) => {
    setConfigAgenda(prev => ({
      ...prev,
      horariosPorDia: {
        ...prev.horariosPorDia,
        [diaIdx]: { ...prev.horariosPorDia[diaIdx], [campo]: valor }
      }
    }))
  }

  // ---- FUNÇÕES REGRAS POR SEMANA DO MÊS ----
  const toggleSemana = (num) => {
    setFormRegraSemana(prev => ({
      ...prev,
      semanas: prev.semanas.includes(num) ? prev.semanas.filter(n => n !== num) : [...prev.semanas, num].sort()
    }))
  }

  // Uma regra só é realmente aplicada se nenhuma outra regra cadastrada disputar o mesmo
  // dia da semana + semana do mês — a grade (gerarGradeDaData, em Cliente/Dashboard/Painel/
  // Agenda) usa .find() e pega sempre a primeira da lista, então uma 2ª regra conflitante
  // ficava cadastrada mas nunca tinha efeito nenhum, sem avisar o admin.
  const encontrarConflitoRegraSemana = (regra, ignorarId = null) => {
    return (configAgenda.regrasSemanas || []).find(r =>
      r.id !== ignorarId &&
      r.diaSemana === regra.diaSemana &&
      r.semanas.some(s => regra.semanas.includes(s))
    )
  }

  const adicionarRegraSemana = () => {
    if (formRegraSemana.semanas.length === 0) return toast("Selecione ao menos uma semana do mês.")
    if (!diaValido(formRegraSemana)) {
      toast.error("Horário inválido: o fim de cada turno precisa ser depois do início, e a tarde não pode começar antes da manhã terminar.")
      return
    }

    const conflito = encontrarConflitoRegraSemana(formRegraSemana, editandoRegraId)
    if (conflito) {
      toast.error(`Já existe uma regra pra ${DIAS_NOME[conflito.diaSemana]} na ${conflito.semanas.join('ª, ')}ª semana. Edite ou remova ela primeiro.`)
      return
    }

    if (editandoRegraId) {
      setConfigAgenda(prev => ({
        ...prev,
        regrasSemanas: prev.regrasSemanas.map(r => r.id === editandoRegraId ? { ...formRegraSemana, id: editandoRegraId } : r)
      }))
      setEditandoRegraId(null)
      toast.success("Regra atualizada!")
    } else {
      setConfigAgenda(prev => ({
        ...prev,
        regrasSemanas: [...(prev.regrasSemanas || []), { ...formRegraSemana, id: Date.now().toString() }]
      }))
    }
  }

  const iniciarEdicaoRegraSemana = (regra) => {
    const { id, ...resto } = regra
    setFormRegraSemana(resto)
    setEditandoRegraId(id)
  }

  const cancelarEdicaoRegraSemana = () => {
    setEditandoRegraId(null)
    setFormRegraSemana({ diaSemana: 5, semanas: [1, 2], ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' })
  }

  const removerRegraSemana = async (id) => {
    const regra = (configAgenda.regrasSemanas || []).find(r => r.id === id)
    const confirmacao = await Swal.fire({
      title: 'Remover regra?',
      text: regra ? `A regra de ${DIAS_NOME[regra.diaSemana]} (${regra.semanas.join('ª, ')}ª semana) será removida ao salvar.` : 'Esta regra será removida ao salvar.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, remover',
      cancelButtonText: 'Cancelar'
    })
    if (!confirmacao.isConfirmed) return

    setConfigAgenda(prev => ({
      ...prev,
      regrasSemanas: prev.regrasSemanas.filter(r => r.id !== id)
    }))
    if (editandoRegraId === id) cancelarEdicaoRegraSemana()
  }

  // ---- FUNÇÕES EXCEÇÕES DATA EXATA ----
  // Ao trocar a data escolhida, se já existir uma exceção salva pra ela, carrega os horários
  // dela no formulário em vez de deixar os valores padrão — sem isso, escolher sem querer uma
  // data que já tinha uma exceção configurada e clicar em "Criar" sobrescrevia ela em silêncio.
  const selecionarDataExcecao = (novaData) => {
    setDataNovaExcecao(novaData)
    const existente = configAgenda.excecoes?.[novaData]
    if (existente) {
      setFormExcecao(existente)
      setDataEmEdicao(true)
    } else {
      setDataEmEdicao(false)
    }
  }

  const adicionarExcecao = () => {
    if (!dataNovaExcecao) return toast("Selecione uma data para a exceção.")
    if (!diaValido(formExcecao)) {
      toast.error("Horário inválido: o fim de cada turno precisa ser depois do início, e a tarde não pode começar antes da manhã terminar.")
      return
    }
    setConfigAgenda(prev => ({
      ...prev,
      excecoes: { ...prev.excecoes, [dataNovaExcecao]: formExcecao }
    }))
    toast.success(dataEmEdicao ? "Exceção atualizada!" : "Exceção criada!")
    setDataNovaExcecao('')
    setFormExcecao({ ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '20:00' })
    setDataEmEdicao(false)
  }

  const removerExcecao = async (dataRemover) => {
    const confirmacao = await Swal.fire({
      title: 'Remover exceção?',
      text: `A exceção de ${formatarDataBR(dataRemover)} será removida ao salvar.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, remover',
      cancelButtonText: 'Cancelar'
    })
    if (!confirmacao.isConfirmed) return

    setConfigAgenda(prev => {
      const novasExcecoes = { ...prev.excecoes }
      delete novasExcecoes[dataRemover]
      return { ...prev, excecoes: novasExcecoes }
    })
    if (dataNovaExcecao === dataRemover) {
      setDataNovaExcecao('')
      setDataEmEdicao(false)
    }
  }

  const formatarDataBR = (dataISO) => {
    const [ano, mes, dia] = dataISO.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const salvarConfiguracoes = async () => {
    const diasInvalidos = DIAS_NOME.filter((_, idx) => {
      const dia = configAgenda.horariosPorDia[idx]
      return dia?.ativo && !diaValido(dia)
    })
    if (diasInvalidos.length > 0) {
      toast.error(`Corrija o horário de ${diasInvalidos.join(', ')} antes de salvar: o fim de cada turno precisa ser depois do início.`)
      return
    }

    setSalvando(true)
    try {
      const atualizacoesComissao = Object.entries(comissoesEditadas)
        .filter(([, valor]) => valor !== '' && !isNaN(Number(valor)))
        .map(([barbeiroId, valor]) => updateDoc(doc(db, "barbeiros", barbeiroId), { comissaoServico: Number(valor) }))
      if (atualizacoesComissao.length > 0) await Promise.all(atualizacoesComissao)

      await setDoc(doc(db, "configuracoes", "agenda"), configAgenda)
      toast.success("Configurações salvas com sucesso!")

      if (atualizacoesComissao.length > 0) {
        setBarbeiros(prev => prev.map(b => comissoesEditadas[b.id] !== undefined ? { ...b, comissaoServico: Number(comissoesEditadas[b.id]) } : b))
        setComissoesEditadas({})
      }
    } catch (e) {
      toast.error("Erro ao salvar.")
    }
    setSalvando(false)
  }

  if (carregando) return <Carregando label="Carregando preferências..." />;

  return (
    <div className="max-w-5xl animate-in fade-in duration-500 pb-20 min-h-screen p-4" style={{ backgroundColor: cores.fundo }}>
      
      {/* HEADER E NAVEGAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: cores.textoPrincipal }}>
            Painel de <span style={{ color: cores.primaria }}>Controle</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cores.primaria }} /> Configurações globais
          </p>
        </div>
        
        {secao !== 'suporte' && secao !== 'personalizacao' && secao !== 'bot' && (
          <button onClick={salvando ? null : salvarConfiguracoes} disabled={salvando}
            className="hover:scale-105 active:scale-95 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg"
            style={{ backgroundColor: cores.primaria, color: '#ffffff' }}>
            {salvando ? "Salvando..." : <><Save size={18} /> Salvar Tudo</>}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-8 p-1.5 rounded-2xl border" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
        {[
          { id: 'comissoes', label: 'Comissões', icon: Percent },
          { id: 'escala', label: 'Escala & Horários', icon: Clock },
          { id: 'listaEspera', label: 'Lista de Espera', icon: Users },
          { id: 'personalizacao', label: 'Personalização', icon: Palette },
          { id: 'bot', label: 'Bot WhatsApp', icon: Bot },
          { id: 'suporte', label: 'Suporte', icon: Headphones }
        ].map((item) => (
          <button key={item.id} onClick={() => setSecao(item.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
            style={{ backgroundColor: secao === item.id ? cores.primaria : 'transparent', color: secao === item.id ? '#ffffff' : cores.textoSecundario }}>
            <item.icon size={14} /> {item.label}
          </button>
        ))}
      </div>

      {secao === 'escala' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* INTERVALO E FERIADOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-[2rem] border shadow-sm" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: cores.textoSecundario }}>Intervalo entre Cortes</label>
              <div className="relative">
                <select value={configAgenda.intervalo} onChange={e => setConfigAgenda({...configAgenda, intervalo: e.target.value})}
                  className="w-full border p-4 rounded-2xl outline-none font-black text-lg appearance-none cursor-pointer focus:ring-2 transition-all"
                  style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: '#000000' }}>
                  {[15, 20, 30, 40, 45, 60].map(m => (<option key={m} value={m}>{m} Minutos</option>))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" size={20} style={{ color: cores.primaria }} />
              </div>
            </div>
            <div className="p-8 rounded-[2rem] border shadow-sm flex flex-col justify-center text-center" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: cores.textoSecundario }}>Feriados Nacionais</label>
              <button onClick={() => setConfigAgenda({...configAgenda, feriadosAtivos: !configAgenda.feriadosAtivos})}
                className="w-full p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border flex items-center justify-center gap-3"
                style={{ backgroundColor: configAgenda.feriadosAtivos ? `${cores.primaria}10` : 'transparent', borderColor: configAgenda.feriadosAtivos ? cores.primaria : cores.borda, color: configAgenda.feriadosAtivos ? cores.primaria : cores.textoSecundario }}>
                <AlertCircle size={16} /> {configAgenda.feriadosAtivos ? 'Bloquear Agenda' : 'Trabalhar Normalmente'}
              </button>
            </div>
          </div>

          {/* TURNOS PADRÃO */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest ml-2 mb-4 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
              <Calendar size={14} style={{ color: cores.primaria }} /> Turnos Padrão (Fixos)
            </h3>
            {DIAS_NOME.map((nome, diaIdx) => {
              const dia = configAgenda.horariosPorDia[diaIdx]
              const diaInvalido = dia.ativo && !diaValido(dia)
              return (
                <div key={diaIdx} className={`p-5 rounded-[1.5rem] border flex flex-col gap-3 ${dia.ativo ? 'shadow-sm' : 'opacity-40 grayscale'}`} style={{ backgroundColor: cores.card, borderColor: diaInvalido ? '#ef4444' : cores.borda }}>
                  <div className="flex flex-col lg:flex-row items-center gap-6 w-full">
                    <div className="w-full lg:w-44 flex items-center gap-4">
                      <button onClick={() => handleDiaChange(diaIdx, 'ativo', !dia.ativo)} className="w-12 h-6 rounded-full relative transition-all" style={{ backgroundColor: dia.ativo ? cores.primaria : '#d1d5db' }}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${dia.ativo ? 'right-1' : 'left-1'}`} />
                      </button>
                      <span className="font-black uppercase text-xs" style={{ color: cores.textoPrincipal }}>{nome}</span>
                    </div>
                    {dia.ativo ? (
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                        {[{ label: 'Manhã (In)', key: 't1Ini' }, { label: 'Manhã (Fim)', key: 't1Fim' }, { label: 'Tarde (In)', key: 't2Ini' }, { label: 'Tarde (Fim)', key: 't2Fim' }].map(campo => (
                          <div key={campo.key} className="space-y-1">
                            <span className="text-[8px] uppercase font-black" style={{ color: cores.textoSecundario }}>{campo.label}</span>
                            <input type="time" value={dia[campo.key]} onChange={e => handleDiaChange(diaIdx, campo.key, e.target.value)}
                              className="w-full p-2.5 rounded-xl border outline-none font-bold text-xs text-center" style={{ backgroundColor: cores.inputBg, borderColor: diaInvalido ? '#ef4444' : cores.borda, color: '#000000' }} />
                          </div>
                        ))}
                      </div>
                    ) : <span className="flex-1 text-[9px] font-black uppercase italic" style={{ color: cores.textoSecundario }}>Fechado</span>}
                  </div>
                  {diaInvalido && (
                    <p className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1.5 lg:ml-[188px]">
                      <AlertCircle size={12} /> Horário inválido: o fim de cada turno precisa ser depois do início, e a tarde não pode começar antes da manhã terminar.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* REGRAS POR SEMANA (DINÂMICAS) */}
          <div className="mt-12 pt-8 border-t border-dashed" style={{ borderColor: cores.borda }}>
            <h3 className="text-sm font-black uppercase tracking-widest ml-2 mb-2 flex items-center gap-2" style={{ color: cores.textoPrincipal }}>
              <CalendarRange size={18} style={{ color: cores.primaria }} /> Regras Dinâmicas por Semana do Mês
            </h3>
            <p className="text-xs mb-6 ml-2" style={{ color: cores.textoSecundario }}>
              Exemplo: Criar um horário que se aplica apenas na 1ª e na 2ª sexta-feira de todo mês.
            </p>

            <div className="p-6 rounded-[2rem] border mb-6" style={{ backgroundColor: editandoRegraId ? `${cores.primaria}15` : `${cores.primaria}08`, borderColor: editandoRegraId ? cores.primaria : cores.borda }}>
              <div className="flex flex-col gap-6">

                {editandoRegraId && (
                  <div className="flex items-center justify-between -mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: cores.primaria }}>
                      <Edit2 size={12} /> Editando regra existente
                    </span>
                    <button onClick={cancelarEdicaoRegraSemana} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:opacity-70" style={{ color: cores.textoSecundario }}>
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="w-full md:w-1/3">
                    <label className="text-[10px] font-black uppercase tracking-widest block mb-2" style={{ color: cores.textoPrincipal }}>Dia da Semana</label>
                    <select 
                      value={formRegraSemana.diaSemana} 
                      onChange={e => setFormRegraSemana({...formRegraSemana, diaSemana: Number(e.target.value)})}
                      className="w-full p-3 rounded-xl border outline-none font-bold text-xs"
                      style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: '#000000' }}
                    >
                      {DIAS_NOME.map((nome, idx) => <option key={idx} value={idx}>{nome}</option>)}
                    </select>
                  </div>
                  
                  <div className="w-full md:w-2/3">
                    <label className="text-[10px] font-black uppercase tracking-widest block mb-2" style={{ color: cores.textoPrincipal }}>Aplicar nestas semanas do mês</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map(num => (
                        <button 
                          key={num} onClick={() => toggleSemana(num)}
                          className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all border ${formRegraSemana.semanas.includes(num) ? 'shadow-md' : 'opacity-60 grayscale'}`}
                          style={{ 
                            backgroundColor: formRegraSemana.semanas.includes(num) ? cores.primaria : cores.card, 
                            borderColor: formRegraSemana.semanas.includes(num) ? cores.primaria : cores.borda,
                            color: formRegraSemana.semanas.includes(num) ? '#fff' : cores.textoSecundario
                          }}
                        >
                          {num}ª Sem.
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row items-end gap-4 border-t pt-4" style={{ borderColor: cores.borda }}>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    {[{ label: 'Manhã (Início)', key: 't1Ini' }, { label: 'Manhã (Fim)', key: 't1Fim' }, { label: 'Tarde (Início)', key: 't2Ini' }, { label: 'Tarde (Fim)', key: 't2Fim' }].map(campo => (
                      <div key={campo.key} className="space-y-1">
                        <span className="text-[8px] uppercase font-black" style={{ color: cores.textoPrincipal }}>{campo.label}</span>
                        <input type="time" value={formRegraSemana[campo.key]} onChange={e => setFormRegraSemana({...formRegraSemana, [campo.key]: e.target.value})}
                          className="w-full p-3 rounded-xl border outline-none font-bold text-xs text-center" style={{ backgroundColor: cores.inputBg, borderColor: diaValido(formRegraSemana) ? cores.borda : '#ef4444', color: '#000000' }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={adicionarRegraSemana} className="px-6 py-3 rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:brightness-110 transition-all w-full lg:w-auto h-full" style={{ backgroundColor: cores.primaria, color: '#ffffff' }}>
                    {editandoRegraId ? <><Save size={16} /> Salvar Edição</> : <><Plus size={16} /> Adicionar</>}
                  </button>
                </div>
                {!diaValido(formRegraSemana) && (
                  <p className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1.5 -mt-2">
                    <AlertCircle size={12} /> O fim de cada turno precisa ser depois do início, e a tarde não pode começar antes da manhã terminar.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {(configAgenda.regrasSemanas || []).map(regra => (
                <div key={regra.id} className="p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4" style={{ backgroundColor: cores.card, borderColor: editandoRegraId === regra.id ? cores.primaria : cores.borda }}>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="font-black px-4 py-2 rounded-lg text-sm border" style={{ backgroundColor: cores.fundo, borderColor: cores.borda, color: cores.textoPrincipal }}>
                      {DIAS_NOME[regra.diaSemana]}s <span style={{ color: cores.primaria }}>({regra.semanas.join('ª, ')}ª Sem)</span>
                    </div>
                    <div className="text-xs font-bold" style={{ color: cores.textoSecundario }}>
                      {regra.t1Ini} às {regra.t1Fim}  —  {regra.t2Ini} às {regra.t2Fim}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => iniciarEdicaoRegraSemana(regra)} className="p-3 bg-blue-50 border border-blue-200 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => removerRegraSemana(regra.id)} className="p-3 bg-red-50 border border-red-200 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {(configAgenda.regrasSemanas || []).length === 0 && (
                <p className="text-center text-xs font-bold py-4 opacity-50" style={{ color: cores.textoSecundario }}>Nenhuma regra dinâmica de semana cadastrada.</p>
              )}
            </div>
          </div>

          {/* EXCEÇÕES DATA EXATA (MANUAL) */}
          <div className="mt-12 pt-8 border-t border-dashed" style={{ borderColor: cores.borda }}>
            <h3 className="text-sm font-black uppercase tracking-widest ml-2 mb-2 flex items-center gap-2" style={{ color: cores.textoPrincipal }}>
              <AlertCircle size={18} style={{ color: cores.primaria }} /> Exceções por Data Exata
            </h3>
            <p className="text-xs mb-6 ml-2" style={{ color: cores.textoSecundario }}>
              Sobrepõe qualquer regra acima. Use para horários especiais em um dia único do ano.
            </p>

            <div className="p-6 rounded-[2rem] border mb-6" style={{ backgroundColor: dataEmEdicao ? `${cores.primaria}10` : cores.card, borderColor: dataEmEdicao ? cores.primaria : cores.borda }}>
              {dataEmEdicao && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: cores.primaria }}>
                    <Edit2 size={12} /> Editando exceção já existente para esta data
                  </span>
                </div>
              )}
              <div className="flex flex-col lg:flex-row gap-6 items-end">
                <div className="w-full lg:w-48 space-y-2">
                  <label className="text-[10px] font-black uppercase" style={{ color: cores.textoPrincipal }}>Selecione o Dia Único</label>
                  <input type="date" value={dataNovaExcecao} min={hojeISO()} onChange={(e) => selecionarDataExcecao(e.target.value)}
                    className="w-full p-3 rounded-xl border outline-none font-bold text-xs" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: '#000000' }} />
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  {[{ label: 'Início 1', key: 't1Ini' }, { label: 'Fim 1', key: 't1Fim' }, { label: 'Início 2', key: 't2Ini' }, { label: 'Fim 2', key: 't2Fim' }].map(campo => (
                    <div key={campo.key} className="space-y-1">
                      <span className="text-[8px] uppercase font-black" style={{ color: cores.textoPrincipal }}>{campo.label}</span>
                      <input type="time" value={formExcecao[campo.key]} onChange={e => setFormExcecao({...formExcecao, [campo.key]: e.target.value})}
                        className="w-full p-3 rounded-xl border outline-none font-bold text-xs text-center" style={{ backgroundColor: cores.inputBg, borderColor: diaValido(formExcecao) ? cores.borda : '#ef4444', color: '#000000' }} />
                    </div>
                  ))}
                </div>
                <button onClick={adicionarExcecao} className="px-6 py-3 rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-gray-100 transition-all w-full lg:w-auto h-full border" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: cores.textoPrincipal }}>
                  {dataEmEdicao ? <><Save size={16} /> Atualizar</> : <><Plus size={16} /> Criar</>}
                </button>
              </div>
              {!diaValido(formExcecao) && (
                <p className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1.5 mt-3">
                  <AlertCircle size={12} /> O fim de cada turno precisa ser depois do início, e a tarde não pode começar antes da manhã terminar.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {Object.entries(configAgenda.excecoes || {}).map(([dataStr, config]) => (
                <div key={dataStr} className="p-4 rounded-2xl border flex items-center justify-between gap-4" style={{ backgroundColor: cores.card, borderColor: dataNovaExcecao === dataStr ? cores.primaria : cores.borda }}>
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500/10 text-red-500 font-black px-4 py-2 rounded-lg text-lg">{formatarDataBR(dataStr)}</div>
                    <div className="text-xs font-bold" style={{ color: cores.textoSecundario }}>{config.t1Ini} às {config.t1Fim}  —  {config.t2Ini} às {config.t2Fim}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => selecionarDataExcecao(dataStr)} className="p-3 bg-blue-50 border border-blue-200 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => removerExcecao(dataStr)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {Object.keys(configAgenda.excecoes || {}).length === 0 && (
                <p className="text-center text-xs font-bold py-6 opacity-50" style={{ color: cores.textoSecundario }}>Nenhuma exceção exata cadastrada.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO COMISSÕES */}
      {secao === 'comissoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-500">
           {barbeiros.map(b => (
            <div key={b.id} className="border p-5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <span className="font-black uppercase text-xs tracking-widest" style={{ color: cores.textoPrincipal }}>{b.nome}</span>
              <div className="flex items-center gap-2 p-2 rounded-xl border" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda }}>
                <input type="number" value={comissoesEditadas[b.id] ?? b.comissaoServico ?? 50} onChange={(e) => setComissoesEditadas({...comissoesEditadas, [b.id]: e.target.value})}
                  className="w-10 text-center font-black bg-transparent outline-none" style={{ color: cores.primaria }} />
                <Percent size={14} style={{ color: cores.textoSecundario }} />
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* SEÇÃO LISTA DE ESPERA */}
      {secao === 'listaEspera' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
            <h3 className="text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: cores.textoPrincipal }}>
              <Users size={18} style={{ color: cores.primaria }} /> Como avisar quem está na fila?
            </h3>
            <p className="text-xs mb-6" style={{ color: cores.textoSecundario }}>
              Quando o dia inteiro de um barbeiro (ou de "qualquer barbeiro") está lotado, o cliente pode entrar numa lista de espera.
              Escolha o que acontece quando um horário daquele dia vaga (por cancelamento, por exemplo).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'manual',
                  icone: Hand,
                  titulo: 'Manual',
                  descricao: 'Nada automático. A fila fica visível só pra você, na Agenda, e você decide quem avisar.'
                },
                {
                  id: 'bot',
                  icone: MessageCircle,
                  titulo: 'Bot (WhatsApp)',
                  descricao: 'O sistema segura o horário e pergunta pro primeiro da fila via WhatsApp, sem prazo — ninguém mais agenda por cima enquanto ele não responde.'
                },
                {
                  id: 'automatico',
                  icone: Zap,
                  titulo: 'Automático',
                  descricao: 'O horário é agendado direto pro primeiro da fila, e ele só recebe um aviso confirmando.'
                }
              ].map(opcao => {
                const selecionado = (configAgenda.listaEsperaModo || 'manual') === opcao.id
                const Icone = opcao.icone
                return (
                  <button
                    key={opcao.id}
                    onClick={() => setConfigAgenda({ ...configAgenda, listaEsperaModo: opcao.id })}
                    className="text-left p-6 rounded-[1.5rem] border-2 transition-all flex flex-col gap-3 hover:shadow-md"
                    style={{
                      backgroundColor: selecionado ? `${cores.primaria}10` : cores.inputBg,
                      borderColor: selecionado ? cores.primaria : cores.borda
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: selecionado ? cores.primaria : cores.borda, color: selecionado ? '#ffffff' : cores.textoSecundario }}>
                      <Icone size={18} />
                    </div>
                    <span className="font-black uppercase text-xs tracking-widest" style={{ color: selecionado ? cores.primaria : cores.textoPrincipal }}>
                      {opcao.titulo}
                    </span>
                    <span className="text-[11px] font-bold leading-relaxed" style={{ color: cores.textoSecundario }}>
                      {opcao.descricao}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {secao === 'personalizacao' && <Personalizacao />}
      {secao === 'bot' && <GerenciadorBot />}
      {secao === 'suporte' && <AdminSuporte />}
    </div>
  )
}