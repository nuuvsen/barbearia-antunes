import { useState, useEffect } from 'react'
import { CheckCircle, Bot, QrCode, Power, RefreshCcw, RotateCw, Bell, Clock, MessageSquare, Plus, Trash2, Save, Loader2, Megaphone, Send, UserSearch, Star, X, Users, FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast' // <-- Adicionado o import do toast que estava faltando!
import { db } from './firebase'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { BOT_URL } from './botConfig'
import Carregando from './Carregando'
import CampoComVariaveis from './CampoComVariaveis'
import { ehBloqueio } from './bloqueioUtils'

// Variáveis disponíveis pro seletor "/" em cada campo de mensagem — cada mensagem só
// oferece as que ela de fato consegue preencher (ex: a campanha não tem como saber o
// {servico} de cada cliente, então nem aparece como opção nela).
const VARIAVEIS = {
  nome: { valor: '{nome}', nome: 'nome', descricao: 'Primeiro nome do cliente' },
  servico: { valor: '{servico}', nome: 'servico', descricao: 'Serviço agendado' },
  data: { valor: '{data}', nome: 'data', descricao: 'Data do agendamento' },
  hora: { valor: '{hora}', nome: 'hora', descricao: 'Horário do agendamento' },
  barbeiro: { valor: '{barbeiro}', nome: 'barbeiro', descricao: 'Nome do profissional' },
}

export default function GerenciadorBot() {
  const [botStatus, setBotStatus] = useState('desconectado')
  const [qrCodeUrl, setQrCodeUrl] = useState(null)
  const [carregandoConfig, setCarregandoConfig] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [novoHorario, setNovoHorario] = useState('')
  const [reiniciandoBot, setReiniciandoBot] = useState(false)

  const [mensagemCampanha, setMensagemCampanha] = useState('')
  const [enviandoCampanha, setEnviandoCampanha] = useState(false)
  const [cancelandoCampanha, setCancelandoCampanha] = useState(false)
  const [progressoCampanha, setProgressoCampanha] = useState(null) // { emAndamento, total, enviados, falhas, cancelada }

  // 🎯 Segmentação de campanha — mesmo critério usado na tela de Clientes: "cortes" e
  // "cliente desde" são calculados a partir dos agendamentos reais (exclui cancelados e
  // bloqueios de agenda), não são um campo fixo salvo em algum lugar.
  const [segmentoTipo, setSegmentoTipo] = useState('todos') // 'todos' | 'antigos' | 'cortes' | 'plano'
  const [segmentoDias, setSegmentoDias] = useState(90)
  const [segmentoCortesMin, setSegmentoCortesMin] = useState(3)
  const [segmentoPlanoId, setSegmentoPlanoId] = useState('')
  const [planosDisponiveis, setPlanosDisponiveis] = useState([])
  const [previaSegmento, setPreviaSegmento] = useState(null) // quantos clientes batem com o filtro atual
  const [calculandoPrevia, setCalculandoPrevia] = useState(false)

  const [numeroTeste, setNumeroTeste] = useState('')
  const [enviandoTeste, setEnviandoTeste] = useState(false)

  // ESTADO ATUALIZADO COM TODAS AS CONFIGURAÇÕES (Lembretes, Radar e NPS)
  const [config, setConfig] = useState({
    lembretesAtivos: true,
    horarios: ['09:00', '18:00'],
    lembreteAntecedenciaAtivo: false,
    lembreteAntecedenciaMinutos: 60,
    msgConfirmacao: '✅ *Olá, {nome}!* Seu agendamento foi confirmado com sucesso!\n\n✂️ *Serviço:* {servico}\n📅 *Data:* {data}\n⏰ *Horário:* {hora}\n💈 *Profissional:* {barbeiro}\n\nTe esperamos na Barbearia Antunes!',
    msgLembrete: '⏰ *Olá, {nome}!* Passando para lembrar do seu agendamento hoje às *{hora}* na Barbearia Antunes.\n\nCaso não possa comparecer, responda *Menu* e selecione cancelar.',
    
    // RADAR DE RECUPERAÇÃO DE CLIENTES
    radarAtivo: false,
    radarDias: 45,
    msgRadar: 'Fala {nome}, sumido! Já faz uns dias desde o seu último trato no visual. Que tal agendar um horário essa semana na Barbearia Antunes?',

    // ⭐ AVALIAÇÃO PÓS-CORTE (NPS)
    npsAtivo: true,
    npsTempoMinutos: 30,
    msgNPS: 'Olá, {nome}! Esperamos que tenha curtido o seu visual hoje na Barbearia Antunes. ✂️\n\nComo foi o seu atendimento com o profissional *{barbeiro}*?\n\nResponda a esta mensagem com uma nota de *1 a 5* ⭐ para nos ajudar a manter a qualidade lá em cima!',

    // 🕐 LISTA DE ESPERA (modo "bot" — ver Configurações → Lista de Espera pra escolher o modo)
    msgListaEspera: '🎉 *Boa notícia, {nome}!* Um horário vagou na Barbearia Antunes e você é o próximo da lista de espera!\n\n✂️ *Serviço:* {servico}\n📅 *Data:* {data}\n⏰ *Horário:* {hora}\n💈 *Profissional:* {barbeiro}\n\nVocê ainda quer esse horário?\n\n*1* - Sim, quero!\n*2* - Não, obrigado'
  })

  useEffect(() => {
    const carregarConfig = async () => {
      try {
        const docRef = doc(db, 'configuracoes', 'botWhatsApp')
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setConfig({ ...config, ...docSnap.data() })
        }
      } catch (e) {
        console.error("Erro ao carregar configurações:", e)
      } finally {
        setCarregandoConfig(false)
      }
    }
    carregarConfig()
  }, [])

  const buscarStatusBot = async () => {
    try {
      const resposta = await fetch(`${BOT_URL}/api/bot/status`)
      const dados = await resposta.json()
      setBotStatus(dados.status)
      setQrCodeUrl(dados.qrCodeUrl)
    } catch (erro) {
      setBotStatus('desconectado')
    }
  }

  useEffect(() => {
    buscarStatusBot()
    const intervalo = setInterval(buscarStatusBot, 3000)
    return () => clearInterval(intervalo)
  }, [])

  const buscarProgressoCampanha = async () => {
    try {
      const resposta = await fetch(`${BOT_URL}/api/bot/campanha/status`)
      const dados = await resposta.json()
      setProgressoCampanha(dados)
      return dados
    } catch (erro) {
      return null
    }
  }

  useEffect(() => {
    // Ao abrir a tela, checa se já existe um disparo em andamento (ex: o painel foi
    // recarregado no meio de uma campanha) e, se sim, já religa a barra de progresso.
    buscarProgressoCampanha().then(dados => {
      if (dados?.emAndamento) setEnviandoCampanha(true)
    })
  }, [])

  useEffect(() => {
    if (!enviandoCampanha) return
    const intervalo = setInterval(async () => {
      const dados = await buscarProgressoCampanha()
      if (dados && !dados.emAndamento) {
        setEnviandoCampanha(false)
      }
    }, 1500)
    return () => clearInterval(intervalo)
  }, [enviandoCampanha])

  // Carrega os planos ativos uma vez, pra popular o filtro "por assinatura".
  useEffect(() => {
    const carregarPlanos = async () => {
      try {
        const snap = await getDocs(collection(db, 'planos'))
        setPlanosDisponiveis(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status === 'Ativo'))
      } catch (e) {
        console.error('Erro ao carregar planos:', e)
      }
    }
    carregarPlanos()
  }, [])

  // 🎯 Monta a lista de clientes que batem com o filtro de segmentação escolhido. Mesma
  // lógica de agregação usada em AdminClientes.jsx (totalAtendimentos e primeiraVisita
  // vêm de contar os agendamentos reais de cada telefone, não de um campo salvo) — se
  // aquela tela mudar esse critério um dia, esta função precisa ser atualizada junto.
  const montarListaSegmentada = async () => {
    const snapClientes = await getDocs(collection(db, 'clientes'))
    const mapaClientes = {}
    snapClientes.docs.forEach(d => { mapaClientes[d.id] = d.data() })

    const snapAgendamentos = await getDocs(collection(db, 'agendamentos'))
    const agendamentosReais = snapAgendamentos.docs.filter(d => !ehBloqueio(d.data()) && d.data().status !== 'Cancelado')
    const stats = {}
    agendamentosReais.forEach(d => {
      const tel = d.data().clienteTelefone
      const dataVisita = d.data().data
      if (!tel) return
      if (!stats[tel]) stats[tel] = { total: 0, primeiraVisita: dataVisita, nome: d.data().clienteNome }
      stats[tel].total += 1
      if (dataVisita && dataVisita < stats[tel].primeiraVisita) stats[tel].primeiraVisita = dataVisita
    })

    // União dos telefones cadastrados em "clientes" com os que só têm agendamento (ex:
    // cliente antigo que nunca preencheu o próprio cadastro formal).
    const telefones = new Set([...Object.keys(mapaClientes), ...Object.keys(stats)])
    let lista = Array.from(telefones).map(tel => ({
      telefone: tel,
      nome: mapaClientes[tel]?.nome || stats[tel]?.nome || 'Cliente',
      totalAtendimentos: stats[tel]?.total || 0,
      primeiraVisita: stats[tel]?.primeiraVisita || null,
      planoId: mapaClientes[tel]?.planoId || ''
    })).filter(c => c.telefone && c.telefone !== '00000000000')

    const hoje = new Date().toISOString().split('T')[0]
    const diasEntre = (dataIso) => {
      if (!dataIso) return Infinity
      const diffMs = new Date(hoje) - new Date(dataIso)
      return Math.floor(diffMs / (1000 * 60 * 60 * 24))
    }

    if (segmentoTipo === 'antigos') {
      lista = lista.filter(c => diasEntre(c.primeiraVisita) >= segmentoDias)
    } else if (segmentoTipo === 'cortes') {
      lista = lista.filter(c => c.totalAtendimentos >= segmentoCortesMin)
    } else if (segmentoTipo === 'plano') {
      lista = lista.filter(c => segmentoPlanoId ? c.planoId === segmentoPlanoId : !!c.planoId)
    }

    return lista
  }

  // Recalcula o "prévia: N clientes" toda vez que o filtro muda, pra dar confiança antes
  // de disparar de verdade (com um pequeno debounce pra não bater no Firestore a cada
  // tecla digitada nos campos de dias/cortes).
  useEffect(() => {
    setCalculandoPrevia(true)
    const timeout = setTimeout(async () => {
      try {
        const lista = await montarListaSegmentada()
        setPreviaSegmento(lista.length)
      } catch (e) {
        console.error('Erro ao calcular prévia da segmentação:', e)
        setPreviaSegmento(null)
      }
      setCalculandoPrevia(false)
    }, 500)
    return () => clearTimeout(timeout)
  }, [segmentoTipo, segmentoDias, segmentoCortesMin, segmentoPlanoId])

  const reiniciarBot = async () => {
    setReiniciandoBot(true)
    try {
      const resposta = await fetch(`${BOT_URL}/api/bot/reiniciar`, { method: 'POST' })
      const dados = await resposta.json().catch(() => ({}))
      if (resposta.ok && dados.ok) {
        toast.success("Reiniciando o bot... acompanhe o status abaixo.")
        buscarStatusBot()
      } else {
        toast.error(dados.erro || "Não foi possível reiniciar o bot.")
      }
    } catch (erro) {
      toast.error("Não consegui falar com o servidor do bot. Ele precisa estar rodando (Docker/terminal) para poder ser reiniciado.")
    }
    // Dá um respiro antes de liberar o botão de novo, pra não deixar
    // clicarem várias vezes seguidas enquanto o painel ainda nem
    // atualizou o status via polling.
    setTimeout(() => setReiniciandoBot(false), 4000)
  }

  const adicionarHorario = () => {
    if (!novoHorario) return
    if (config.horarios.includes(novoHorario)) return toast("Horário já adicionado!")
    setConfig(prev => ({ ...prev, horarios: [...prev.horarios, novoHorario].sort() }))
    setNovoHorario('')
  }

  const removerHorario = (horarioRemover) => {
    setConfig(prev => ({ ...prev, horarios: prev.horarios.filter(h => h !== horarioRemover) }))
  }

  const salvarConfiguracoes = async () => {
    setSalvando(true)
    try {
      await setDoc(doc(db, 'configuracoes', 'botWhatsApp'), config)
      toast.success("Configurações salvas com sucesso!")
    } catch (e) {
      toast.error("Erro ao salvar as configurações.")
    }
    setSalvando(false)
  }

  const rotuloSegmento = () => {
    if (segmentoTipo === 'antigos') return `clientes há ${segmentoDias}+ dias`
    if (segmentoTipo === 'cortes') return `clientes com ${segmentoCortesMin}+ cortes`
    if (segmentoTipo === 'plano') {
      const plano = planosDisponiveis.find(p => p.id === segmentoPlanoId)
      return plano ? `assinantes do plano "${plano.nome}"` : 'clientes com qualquer plano ativo'
    }
    return 'TODOS os seus clientes cadastrados'
  }

  const dispararCampanha = async () => {
    if (!mensagemCampanha.trim()) return toast("Digite uma mensagem para a campanha.")
    if (botStatus !== 'conectado') return toast("O bot precisa estar conectado para enviar mensagens.")

    setEnviandoCampanha(true)
    let listaSegmentada
    try {
      listaSegmentada = await montarListaSegmentada()
    } catch (e) {
      toast.error("Erro ao buscar os clientes desse filtro.")
      setEnviandoCampanha(false)
      return
    }

    if (listaSegmentada.length === 0) {
      toast.error("Nenhum cliente encontrado com esse filtro.")
      setEnviandoCampanha(false)
      return
    }

    const confirmar = window.confirm(`⚠️ ATENÇÃO: Esta mensagem será enviada para ${listaSegmentada.length} ${rotuloSegmento()}. Tem certeza que deseja iniciar o disparo?`)
    if (!confirmar) {
      setEnviandoCampanha(false)
      return
    }

    try {
      const res = await fetch(`${BOT_URL}/api/bot/campanha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: mensagemCampanha, clientes: listaSegmentada })
      })

      const data = await res.json()

      if (data.success) {
        toast.success("✅ Campanha iniciada! Acompanhe o progresso abaixo.")
        setMensagemCampanha('')
        buscarProgressoCampanha()
        return // mantém enviandoCampanha=true; o polling acima desliga sozinho no final
      } else {
        toast.error(data.error || "Erro ao iniciar campanha.")
      }
    } catch (error) {
      toast.error("Erro ao se comunicar com o servidor do bot.")
    }
    setEnviandoCampanha(false)
  }

  const cancelarCampanha = async () => {
    setCancelandoCampanha(true)
    try {
      const res = await fetch(`${BOT_URL}/api/bot/campanha/cancelar`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success("Cancelamento solicitado — o disparo vai parar em instantes.")
      } else {
        toast.error(data.error || "Não consegui cancelar o disparo.")
      }
    } catch (e) {
      toast.error("Erro ao se comunicar com o servidor do bot.")
    }
    setCancelandoCampanha(false)
  }

  const enviarTeste = async () => {
    if (!mensagemCampanha.trim()) return toast("Digite uma mensagem antes de testar.")
    if (!numeroTeste.trim()) return toast("Informe o seu número de WhatsApp pra receber o teste.")
    if (botStatus !== 'conectado') return toast("O bot precisa estar conectado para enviar mensagens.")

    setEnviandoTeste(true)
    try {
      const res = await fetch(`${BOT_URL}/api/bot/campanha/teste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: mensagemCampanha, numeroTeste })
      })
      const data = await res.json()
      if (data.success) {
        toast.success("🧪 Mensagem de teste enviada!")
      } else {
        toast.error(data.error || "Erro ao enviar o teste.")
      }
    } catch (e) {
      toast.error("Erro ao se comunicar com o servidor do bot.")
    }
    setEnviandoTeste(false)
  }

  if (carregandoConfig) return <Carregando tela={false} label="Carregando..." />;

  return (
    /* LARGURA MAXIMA EXPANDIDA (max-w-[1600px]) PARA COBRIR TELAS LARGAS */
    <div className="w-full max-w-[1600px] mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* CARD 1: STATUS DA CONEXÃO */}
      <div className="rounded-[2.5rem] p-8 md:p-10 shadow-2xl border transition-colors" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
            <Bot size={28} style={{ color: 'var(--cor-primaria)' }} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
              Conexão do <span style={{ color: 'var(--cor-primaria)' }}>Bot</span>
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--cor-texto-secundario)' }}>
              Conecte o seu aparelho para ativar o assistente
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="border p-6 rounded-3xl" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--cor-texto-secundario)' }}>Status da Conexão</h3>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${botStatus === 'conectado' ? 'bg-green-500 animate-pulse' : botStatus === 'aguardando_qr' ? 'bg-yellow-500 animate-pulse' : botStatus === 'reiniciando' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--cor-texto-principal)' }}>
                  {botStatus === 'desconectado' && 'Offline / Desconectado'}
                  {botStatus === 'aguardando_qr' && 'Aguardando Leitura'}
                  {botStatus === 'conectado' && 'Online e Operante'}
                  {botStatus === 'reiniciando' && 'Reiniciando...'}
                </span>
              </div>
            </div>

            {botStatus === 'desconectado' && (
              <div className="bg-red-900/10 border border-red-900/30 p-6 rounded-3xl space-y-1">
                 <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center">Servidor do bot não respondeu.</p>
                 <p className="text-red-500/70 text-[10px] font-medium text-center">Se o Docker/terminal do bot estiver desligado, o botão abaixo não vai adiantar — precisa ligar o processo primeiro. Se ele estiver ligado mas travado, "Reiniciar" resolve.</p>
              </div>
            )}
            {botStatus === 'reiniciando' && (
              <div className="bg-blue-900/10 border border-blue-900/30 p-6 rounded-3xl flex items-center justify-center gap-3">
                <Loader2 size={18} className="animate-spin text-blue-500" />
                <p className="text-blue-500 text-xs font-bold uppercase tracking-widest text-center">Reiniciando o bot...</p>
              </div>
            )}
            {botStatus === 'conectado' && (
              <button onClick={() => toast("Para desconectar, feche o terminal ou desvincule no celular.")}
                className="w-full bg-red-600/10 text-red-500 border border-red-600/30 font-black py-5 rounded-2xl uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-red-600 hover:text-white transition-all">
                <Power size={20} /> Desconectar Bot
              </button>
            )}
            {botStatus !== 'reiniciando' && (
              <button onClick={reiniciarBot} disabled={reiniciandoBot}
                className="w-full bg-blue-600/10 text-blue-500 border border-blue-600/30 font-black py-5 rounded-2xl uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 disabled:pointer-events-none">
                {reiniciandoBot ? <Loader2 size={20} className="animate-spin" /> : <RotateCw size={20} />}
                {reiniciandoBot ? 'Reiniciando...' : 'Reiniciar Bot'}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center justify-center border p-8 rounded-3xl min-h-[200px]" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
            {botStatus === 'reiniciando' ? (
              <div className="text-center text-blue-500">
                <RotateCw size={48} className="mx-auto mb-4 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Reiniciando a sessão do WhatsApp...</p>
              </div>
            ) : botStatus === 'desconectado' ? (
              <div className="text-center opacity-30">
                <QrCode size={64} className="mx-auto mb-4" style={{ color: 'var(--cor-texto-principal)' }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Servidor Desligado</p>
              </div>
            ) : botStatus === 'aguardando_qr' && !qrCodeUrl ? (
              <div className="text-center text-yellow-500"><RefreshCcw size={32} className="mx-auto mb-4 animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest">Gerando QR Code...</p></div>
            ) : botStatus === 'aguardando_qr' && qrCodeUrl ? (
              <div className="text-center animate-in zoom-in duration-300">
                <div className="bg-white p-4 rounded-xl mb-4"><img src={qrCodeUrl} alt="QR Code WhatsApp" className="w-48 h-48" /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Abra o WhatsApp e escaneie</p>
              </div>
            ) : null}

            {botStatus === 'conectado' && (
                <div className="text-center text-green-500 animate-in zoom-in duration-300">
                <CheckCircle size={64} className="mx-auto mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">Aparelho Vinculado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SISTEMA DE GRID LATERIZADO PARA TELAS DE PC */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA (Ocupa 7 espaços): COMPORTAMENTO DO SISTEMA */}
        <div className="xl:col-span-7 flex flex-col border rounded-[2.5rem] p-8 md:p-10 shadow-sm transition-colors" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
          {/* BUG ENCONTRADO NO PASSEIO VISUAL: numa janela um pouco mais estreita, o título
              "Comportamento do Sistema" (texto grande, em uma linha só) empurrava o botão
              "Salvar Regras" pra fora da tela, criando uma barra de rolagem horizontal na
              página inteira. Isso acontece porque um item de flexbox, por padrão, nunca
              encolhe menos que o tamanho do seu conteúdo — precisa de "min-w-0" pra permitir
              que o título quebre em duas linhas quando faltar espaço, em vez de estourar. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b pb-6" style={{ borderColor: 'var(--cor-borda)' }}>
            <div className="min-w-0">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                Comportamento <span style={{ color: 'var(--cor-primaria)' }}>do Sistema</span>
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--cor-texto-secundario)' }}>Ajuste os lembretes e mensagens</p>
            </div>
            <button onClick={salvarConfiguracoes} disabled={salvando}
              className="text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 hover:brightness-110 active:scale-95 whitespace-nowrap"
              style={{ backgroundColor: 'var(--cor-primaria)' }}>
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {salvando ? 'Salvando...' : 'Salvar Regras'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} style={{ color: 'var(--cor-primaria)' }} />
                  <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Lembretes</h3>
                </div>
                <button onClick={() => setConfig({...config, lembretesAtivos: !config.lembretesAtivos})} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{ backgroundColor: config.lembretesAtivos ? 'var(--cor-primaria)' : 'var(--cor-borda)' }}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.lembretesAtivos ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className={`space-y-4 transition-all duration-300 ${!config.lembretesAtivos ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                <p className="text-xs font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Horários que o bot avisa os clientes do dia:</p>
                <div className="flex gap-2">
                  <input type="time" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} className="flex-1 p-3 rounded-xl font-bold text-sm outline-none border transition-colors" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                  <button onClick={adicionarHorario} className="text-white p-3 rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: 'var(--cor-primaria)' }}><Plus size={20} /></button>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {config.horarios.map(h => (
                    <div key={h} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black tracking-wider border" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-primaria)', color: 'var(--cor-texto-principal)' }}>
                      <Clock size={14} style={{ color: 'var(--cor-primaria)' }} /> {h}
                      <button onClick={() => removerHorario(h)} className="ml-2 text-red-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso por antecedência — mecanismo independente dos horários fixos acima:
                  avisa CADA cliente contando pra trás a partir do horário do corte DELE. */}
              <div className="pt-5 mt-2 border-t space-y-4" style={{ borderColor: 'var(--cor-borda)' }}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Avisar com antecedência do horário do corte:</p>
                  <button onClick={() => setConfig({...config, lembreteAntecedenciaAtivo: !config.lembreteAntecedenciaAtivo})} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0" style={{ backgroundColor: config.lembreteAntecedenciaAtivo ? 'var(--cor-primaria)' : 'var(--cor-borda)' }}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.lembreteAntecedenciaAtivo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className={`flex items-center gap-3 transition-all duration-300 ${!config.lembreteAntecedenciaAtivo ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                  <input type="number" min="1" value={config.lembreteAntecedenciaMinutos}
                    onChange={(e) => setConfig({...config, lembreteAntecedenciaMinutos: Number(e.target.value)})}
                    className="w-24 border p-3 rounded-xl text-sm font-black outline-none text-center transition-colors"
                    style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }} />
                  <span className="text-xs font-black uppercase" style={{ color: 'var(--cor-texto-principal)' }}>Minutos antes do corte</span>
                </div>
                <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>
                  Ex: 60 avisa 1h antes de CADA agendamento, seja qual for o horário dele — funciona junto (e além) dos horários fixos configurados acima.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} style={{ color: 'var(--cor-primaria)' }} />
                <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Textos</h3>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Lembrete</label>
                  <CampoComVariaveis value={config.msgLembrete} onChange={(v) => setConfig({...config, msgLembrete: v})} variaveis={[VARIAVEIS.nome, VARIAVEIS.hora]} className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-24 resize-none transition-colors" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                  <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Digite <span style={{ color: 'var(--cor-primaria)' }}>/</span> pra escolher uma variável, ou use: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{hora}'}</span></p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Confirmação</label>
                  <CampoComVariaveis value={config.msgConfirmacao} onChange={(v) => setConfig({...config, msgConfirmacao: v})} variaveis={[VARIAVEIS.nome, VARIAVEIS.servico, VARIAVEIS.data, VARIAVEIS.hora, VARIAVEIS.barbeiro]} className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-32 resize-none transition-colors" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                  <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Digite <span style={{ color: 'var(--cor-primaria)' }}>/</span> pra escolher uma variável, ou use: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{servico}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{data}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{hora}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{barbeiro}'}</span></p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Lista de Espera</label>
                  <CampoComVariaveis value={config.msgListaEspera} onChange={(v) => setConfig({...config, msgListaEspera: v})} variaveis={[VARIAVEIS.nome, VARIAVEIS.servico, VARIAVEIS.data, VARIAVEIS.hora, VARIAVEIS.barbeiro]} className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-32 resize-none transition-colors" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                  <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Enviada no modo "Bot" (Configurações → Lista de Espera) quando um horário vaga. Digite <span style={{ color: 'var(--cor-primaria)' }}>/</span> pra escolher uma variável, ou use: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{servico}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{data}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{hora}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{barbeiro}'}</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (Ocupa 5 espaços): RADAR E CAMPANHAS (EMPILHADOS) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* RADAR DE RECUPERAÇÃO */}
          <div className="border rounded-[2.5rem] p-8 md:p-10 shadow-sm transition-colors flex flex-col" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
            <div className="flex items-center justify-between mb-6 border-b pb-4" style={{ borderColor: 'var(--cor-borda)' }}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                  <UserSearch size={20} style={{ color: 'var(--cor-primaria)' }} />
                </div>
                <div>
                  <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Radar de Sumidos</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Recuperação Automática</p>
                </div>
              </div>
              <button onClick={() => setConfig({...config, radarAtivo: !config.radarAtivo})} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{ backgroundColor: config.radarAtivo ? 'var(--cor-primaria)' : 'var(--cor-borda)' }}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.radarAtivo ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className={`space-y-4 flex-1 flex flex-col transition-all duration-300 ${!config.radarAtivo ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Disparar após quantos dias sem vir?</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={config.radarDias} onChange={(e) => setConfig({...config, radarDias: Number(e.target.value)})}
                    className="w-24 border p-3 rounded-xl text-sm font-black outline-none text-center transition-colors" 
                    style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }} min="1" />
                  <span className="text-xs font-black uppercase" style={{ color: 'var(--cor-texto-principal)' }}>Dias</span>
                </div>
              </div>

              <div className="space-y-2 mt-2 flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Resgate</label>
                <CampoComVariaveis value={config.msgRadar} onChange={(v) => setConfig({...config, msgRadar: v})} variaveis={[VARIAVEIS.nome]}
                  className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-24 resize-none transition-colors"
                  style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Digite <span style={{ color: 'var(--cor-primaria)' }}>/</span> pra escolher uma variável, ou use: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span></p>
              </div>
            </div>
          </div>

          {/* CAMPANHAS E DISPAROS */}
          <div className="border rounded-[2.5rem] p-8 md:p-10 shadow-sm transition-colors flex flex-col flex-1" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
            <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: 'var(--cor-borda)' }}>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                <Megaphone size={20} style={{ color: 'var(--cor-primaria)' }} />
              </div>
              <div>
                <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Campanhas</h3>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Disparo em Massa</p>
              </div>
            </div>

            <div className="space-y-4 flex-1 flex flex-col">
              <CampoComVariaveis
                value={mensagemCampanha}
                onChange={setMensagemCampanha}
                variaveis={[VARIAVEIS.nome]}
                placeholder="Ex: Fala {nome}! Só hoje na barbearia, qualquer corte tem 20% OFF."
                className="w-full border p-4 rounded-xl text-xs font-medium outline-none flex-1 min-h-[100px] resize-none transition-colors"
                style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
              />
              <p className="text-[9px] font-bold -mt-2" style={{ color: 'var(--cor-texto-secundario)' }}>
                Digite <span style={{ color: 'var(--cor-primaria)' }}>/</span> pra escolher uma variável, ou use: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>
              </p>

              {/* 🎯 Segmentação — escolhe QUEM recebe, em vez de sempre disparar pra
                  todo mundo. O cálculo de "cortes" e "cliente desde" é feito na hora,
                  a partir dos agendamentos reais (mesmo critério da tela Clientes). */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--cor-borda)' }}>
                <div className="flex items-center gap-2 pt-2">
                  <Users size={14} style={{ color: 'var(--cor-primaria)' }} />
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Público-alvo</label>
                </div>
                <select value={segmentoTipo} onChange={(e) => setSegmentoTipo(e.target.value)}
                  className="w-full border p-3 rounded-xl text-xs font-bold outline-none transition-colors"
                  style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
                  <option value="todos">Todos os clientes cadastrados</option>
                  <option value="antigos">Clientes há X dias (antiguidade)</option>
                  <option value="cortes">Clientes com X+ cortes</option>
                  <option value="plano">Clientes por assinatura/plano</option>
                </select>

                {segmentoTipo === 'antigos' && (
                  <div className="flex items-center gap-3 pt-1">
                    <input type="number" min="1" value={segmentoDias} onChange={(e) => setSegmentoDias(Number(e.target.value))}
                      className="w-20 border p-2 rounded-xl text-sm font-black outline-none text-center transition-colors"
                      style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }} />
                    <span className="text-[10px] font-black uppercase" style={{ color: 'var(--cor-texto-principal)' }}>dias ou mais, desde o 1º corte</span>
                  </div>
                )}
                {segmentoTipo === 'cortes' && (
                  <div className="flex items-center gap-3 pt-1">
                    <input type="number" min="1" value={segmentoCortesMin} onChange={(e) => setSegmentoCortesMin(Number(e.target.value))}
                      className="w-20 border p-2 rounded-xl text-sm font-black outline-none text-center transition-colors"
                      style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }} />
                    <span className="text-[10px] font-black uppercase" style={{ color: 'var(--cor-texto-principal)' }}>cortes ou mais (concluídos)</span>
                  </div>
                )}
                {segmentoTipo === 'plano' && (
                  <select value={segmentoPlanoId} onChange={(e) => setSegmentoPlanoId(e.target.value)}
                    className="w-full border p-3 rounded-xl text-xs font-bold outline-none transition-colors"
                    style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
                    <option value="">Qualquer plano ativo</option>
                    {planosDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                )}

                <p className="text-[9px] font-bold pt-1" style={{ color: 'var(--cor-texto-secundario)' }}>
                  {calculandoPrevia ? 'Calculando...' : previaSegmento === null ? '' : (
                    <>Prévia: <span style={{ color: 'var(--cor-primaria)' }}>{previaSegmento}</span> cliente(s) vão receber</>
                  )}
                </p>
              </div>

              {/* 🧪 Teste — manda só pra um número (o seu, por exemplo) antes de
                  disparar de verdade, pra revisar o texto formatado na prática. */}
              <div className="flex gap-2 pt-1">
                <input type="tel" value={numeroTeste} onChange={(e) => setNumeroTeste(e.target.value)}
                  placeholder="Seu WhatsApp (DDD + número)"
                  className="flex-1 border p-3 rounded-xl text-xs font-bold outline-none transition-colors"
                  style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                <button onClick={enviarTeste} disabled={enviandoTeste || !mensagemCampanha || !numeroTeste}
                  className="px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border transition-all disabled:opacity-50 hover:brightness-95 active:scale-95 whitespace-nowrap"
                  style={{ borderColor: 'var(--cor-primaria)', color: 'var(--cor-primaria)' }}>
                  {enviandoTeste ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                  Testar
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 mt-auto pt-2">
                {progressoCampanha?.emAndamento ? (
                  <button onClick={cancelarCampanha} disabled={cancelandoCampanha}
                    className="text-red-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 border border-red-500/30 hover:bg-red-600 hover:text-white active:scale-95">
                    {cancelandoCampanha ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                    {cancelandoCampanha ? 'Cancelando...' : 'Cancelar Disparo'}
                  </button>
                ) : (
                  <button onClick={dispararCampanha} disabled={enviandoCampanha || !mensagemCampanha}
                    className="text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 hover:brightness-110 active:scale-95"
                    style={{ backgroundColor: 'var(--cor-primaria)' }}>
                    {enviandoCampanha ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {enviandoCampanha ? 'Enviando...' : 'Disparar'}
                  </button>
                )}
              </div>

              {/* Barra de progresso do disparo — consultada via polling em
                  /api/bot/campanha/status enquanto o backend manda as mensagens. */}
              {progressoCampanha && progressoCampanha.total > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>
                    <span>{progressoCampanha.emAndamento ? 'Enviando...' : progressoCampanha.cancelada ? 'Cancelado pelo usuário' : 'Último disparo concluído'}</span>
                    <span style={{ color: 'var(--cor-primaria)' }}>{progressoCampanha.enviados + progressoCampanha.falhas} / {progressoCampanha.total}</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden border" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round(((progressoCampanha.enviados + progressoCampanha.falhas) / progressoCampanha.total) * 100))}%`,
                        backgroundColor: progressoCampanha.cancelada ? '#ef4444' : 'var(--cor-primaria)'
                      }}
                    />
                  </div>
                  {progressoCampanha.falhas > 0 && (
                    <p className="text-[9px] font-bold text-red-500">
                      {progressoCampanha.falhas} cliente(s) não receberam (número inválido ou sem WhatsApp).
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CARD 4: ⭐ AVALIAÇÃO PÓS-CORTE (NPS) - Ocupa a largura total na parte de baixo */}
      <div className="border rounded-[2.5rem] p-8 md:p-10 shadow-sm transition-colors flex flex-col" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
        <div className="flex items-center justify-between mb-6 border-b pb-4" style={{ borderColor: 'var(--cor-borda)' }}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
              <Star size={20} style={{ color: 'var(--cor-primaria)' }} />
            </div>
            <div>
              <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Avaliação Pós-Corte</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Pesquisa de Satisfação (NPS)</p>
            </div>
          </div>
          <button onClick={() => setConfig({...config, npsAtivo: !config.npsAtivo})} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{ backgroundColor: config.npsAtivo ? 'var(--cor-primaria)' : 'var(--cor-borda)' }}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.npsAtivo ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className={`space-y-4 flex flex-col transition-all duration-300 ${!config.npsAtivo ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <p className="text-xs font-bold mb-4" style={{ color: 'var(--cor-texto-secundario)' }}>
            O bot enviará uma mensagem pedindo a nota do cliente após você clicar em "Concluir" no painel.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Enviar após quantos minutos?</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={config.npsTempoMinutos} 
                  onChange={(e) => setConfig({...config, npsTempoMinutos: Number(e.target.value)})}
                  className="w-full md:w-32 border p-4 rounded-xl text-sm font-black outline-none text-center transition-colors" 
                  style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}
                  min="1"
                />
                <span className="text-xs font-black uppercase" style={{ color: 'var(--cor-texto-principal)' }}>Minutos</span>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Avaliação</label>
              <CampoComVariaveis
                value={config.msgNPS}
                onChange={(v) => setConfig({...config, msgNPS: v})}
                variaveis={[VARIAVEIS.nome, VARIAVEIS.barbeiro]}
                className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-28 resize-none transition-colors"
                style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
              />
              <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Digite <span style={{ color: 'var(--cor-primaria)' }}>/</span> pra escolher uma variável, ou use: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{barbeiro}'}</span></p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}