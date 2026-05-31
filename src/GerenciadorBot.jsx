import { useState, useEffect } from 'react'
import { CheckCircle, Bot, QrCode, Power, RefreshCcw, Bell, Clock, MessageSquare, Plus, Trash2, Save, Loader2, Megaphone, Send, UserSearch, Star } from 'lucide-react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function GerenciadorBot() {
  const [botStatus, setBotStatus] = useState('desconectado')
  const [qrCodeUrl, setQrCodeUrl] = useState(null)
  const [carregandoConfig, setCarregandoConfig] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [novoHorario, setNovoHorario] = useState('')

  const [mensagemCampanha, setMensagemCampanha] = useState('')
  const [enviandoCampanha, setEnviandoCampanha] = useState(false)

  // ESTADO ATUALIZADO COM TODAS AS CONFIGURAÇÕES (Lembretes, Radar e NPS)
  const [config, setConfig] = useState({
    lembretesAtivos: true,
    horarios: ['09:00', '18:00'],
    msgConfirmacao: '✅ *Olá, {nome}!* Seu agendamento foi confirmado com sucesso!\n\n✂️ *Serviço:* {servico}\n📅 *Data:* {data}\n⏰ *Horário:* {hora}\n💈 *Profissional:* {barbeiro}\n\nTe esperamos na Barbearia Antunes!',
    msgLembrete: '⏰ *Olá, {nome}!* Passando para lembrar do seu agendamento hoje às *{hora}* na Barbearia Antunes.\n\nCaso não possa comparecer, responda *Menu* e selecione cancelar.',
    
    // RADAR DE RECUPERAÇÃO DE CLIENTES
    radarAtivo: false,
    radarDias: 45,
    msgRadar: 'Fala {nome}, sumido! Já faz uns dias desde o seu último trato no visual. Que tal agendar um horário essa semana na Barbearia Antunes?',

    // ⭐ AVALIAÇÃO PÓS-CORTE (NPS)
    npsAtivo: true,
    npsTempoMinutos: 30,
    msgNPS: 'Olá, {nome}! Esperamos que tenha curtido o seu visual hoje na Barbearia Antunes. ✂️\n\nComo foi o seu atendimento com o profissional *{barbeiro}*?\n\nResponda a esta mensagem com uma nota de *1 a 5* ⭐ para nos ajudar a manter a qualidade lá em cima!'
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
      const resposta = await fetch('http://localhost:3001/api/bot/status')
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

  const adicionarHorario = () => {
    if (!novoHorario) return
    if (config.horarios.includes(novoHorario)) return alert("Horário já adicionado!")
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
      alert("Configurações salvas com sucesso!")
    } catch (e) {
      alert("Erro ao salvar as configurações.")
    }
    setSalvando(false)
  }

  const dispararCampanha = async () => {
    if (!mensagemCampanha.trim()) return alert("Digite uma mensagem para a campanha.")
    if (botStatus !== 'conectado') return alert("O bot precisa estar conectado para enviar mensagens.")
    
    const confirmar = window.confirm("⚠️ ATENÇÃO: Esta mensagem será enviada para TODOS os seus clientes cadastrados. Tem certeza que deseja iniciar o disparo?")
    if (!confirmar) return

    setEnviandoCampanha(true)
    try {
      const res = await fetch('http://localhost:3001/api/bot/campanha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: mensagemCampanha })
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert("✅ Campanha iniciada com sucesso! Acompanhe o envio no terminal do Node.")
        setMensagemCampanha('')
      } else {
        alert("Erro ao iniciar campanha: " + data.error)
      }
    } catch (error) {
      alert("Erro ao se comunicar com o servidor do bot.")
    }
    setEnviandoCampanha(false)
  }

  if (carregandoConfig) return (
    <div className="flex justify-center items-center h-40">
      <Loader2 className="animate-spin" size={32} style={{ color: 'var(--cor-primaria)' }} />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* CARD 1: STATUS DA CONEXÃO */}
      <div className="rounded-[2.5rem] p-10 shadow-2xl animate-in fade-in duration-300 border transition-colors" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
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

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <div className="border p-6 rounded-3xl" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--cor-texto-secundario)' }}>Status da Conexão</h3>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${botStatus === 'conectado' ? 'bg-green-500 animate-pulse' : botStatus === 'aguardando_qr' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--cor-texto-principal)' }}>
                  {botStatus === 'desconectado' && 'Offline / Desconectado'}
                  {botStatus === 'aguardando_qr' && 'Aguardando Leitura'}
                  {botStatus === 'conectado' && 'Online e Operante'}
                </span>
              </div>
            </div>

            {botStatus === 'desconectado' && (
              <div className="bg-red-900/10 border border-red-900/30 p-6 rounded-3xl">
                 <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center">Inicie o servidor Node.js no terminal para conectar.</p>
              </div>
            )}
            {botStatus === 'conectado' && (
              <button onClick={() => alert("Para desconectar, feche o terminal ou desvincule no celular.")}
                className="w-full bg-red-600/10 text-red-500 border border-red-600/30 font-black py-5 rounded-2xl uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-red-600 hover:text-white transition-all">
                <Power size={20} /> Desconectar Bot
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center border p-8 rounded-3xl min-h-[250px]" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
            {botStatus === 'desconectado' ? (
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

      {/* CARD 2: CONFIGURAÇÕES DE FUNCIONAMENTO */}
      <div className="border rounded-[2.5rem] p-10 shadow-sm transition-colors" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
              Comportamento do <span style={{ color: 'var(--cor-primaria)' }}>Sistema</span>
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--cor-texto-secundario)' }}>Ajuste os lembretes e mensagens do seu robô</p>
          </div>
          <button onClick={salvarConfiguracoes} disabled={salvando}
            className="text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 hover:brightness-110 active:scale-95"
            style={{ backgroundColor: 'var(--cor-primaria)' }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {salvando ? 'Salvando...' : 'Salvar Regras'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--cor-borda)' }}>
              <div className="flex items-center gap-3">
                <Bell size={20} style={{ color: 'var(--cor-primaria)' }} />
                <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Lembretes Automáticos</h3>
              </div>
              <button onClick={() => setConfig({...config, lembretesAtivos: !config.lembretesAtivos})} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{ backgroundColor: config.lembretesAtivos ? 'var(--cor-primaria)' : 'var(--cor-borda)' }}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.lembretesAtivos ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className={`space-y-4 transition-all duration-300 ${!config.lembretesAtivos ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
              <p className="text-xs font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Em quais horários o bot deve avisar os clientes que têm agendamento para aquele dia?</p>
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
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--cor-borda)' }}>
              <MessageSquare size={20} style={{ color: 'var(--cor-primaria)' }} />
              <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: 'var(--cor-texto-principal)' }}>Textos das Mensagens</h3>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Lembrete</label>
                <textarea value={config.msgLembrete} onChange={(e) => setConfig({...config, msgLembrete: e.target.value})} className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-24 resize-none transition-colors" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Variáveis: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{hora}'}</span></p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Confirmação</label>
                <textarea value={config.msgConfirmacao} onChange={(e) => setConfig({...config, msgConfirmacao: e.target.value})} className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-32 resize-none transition-colors" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Variáveis: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{servico}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{data}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{hora}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{barbeiro}'}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3: RADAR DE CLIENTES SUMIDOS E MARKETING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RADAR DE RECUPERAÇÃO */}
        <div className="border rounded-[2.5rem] p-10 shadow-sm transition-colors flex flex-col" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
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
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--cor-texto-secundario)' }}>
              O bot buscará clientes que não cortam o cabelo há X dias para tentar recuperá-los.
            </p>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Disparar após quantos dias sem vir?</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={config.radarDias} 
                  onChange={(e) => setConfig({...config, radarDias: Number(e.target.value)})}
                  className="w-24 border p-3 rounded-xl text-sm font-black outline-none text-center transition-colors" 
                  style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}
                  min="1"
                />
                <span className="text-xs font-black uppercase" style={{ color: 'var(--cor-texto-principal)' }}>Dias</span>
              </div>
            </div>

            <div className="space-y-2 mt-4 flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Resgate</label>
              <textarea 
                value={config.msgRadar} 
                onChange={(e) => setConfig({...config, msgRadar: e.target.value})}
                className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-28 resize-none transition-colors" 
                style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
              />
              <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Variável: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span></p>
            </div>
          </div>
        </div>

        {/* MARKETING */}
        <div className="border rounded-[2.5rem] p-10 shadow-sm transition-colors flex flex-col" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
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
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>
              Sua Mensagem de Promoção/Aviso
            </label>
            <textarea 
              value={mensagemCampanha} 
              onChange={(e) => setMensagemCampanha(e.target.value)}
              placeholder="Ex: Fala {nome}! Só hoje na Barbearia Antunes, qualquer corte tem 20% de desconto. Aproveite!"
              className="w-full border p-4 rounded-xl text-xs font-medium outline-none flex-1 min-h-[120px] resize-none transition-colors"
              style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
            />
            <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>
              Variável disponível: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>
            </p>
            
            <button 
              onClick={dispararCampanha} 
              disabled={enviandoCampanha || !mensagemCampanha}
              className="text-white px-8 py-4 rounded-xl w-full font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 hover:brightness-110 active:scale-95 mt-auto"
              style={{ backgroundColor: 'var(--cor-primaria)' }}
            >
              {enviandoCampanha ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
              {enviandoCampanha ? 'Processando Disparo...' : 'Disparar para Todos'}
            </button>
          </div>
        </div>
      </div>

      {/* CARD 4: ⭐ AVALIAÇÃO PÓS-CORTE (NPS) */}
      <div className="border rounded-[2.5rem] p-10 shadow-sm transition-colors flex flex-col lg:col-span-2" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
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
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--cor-texto-secundario)' }}>
            O bot enviará uma mensagem pedindo a nota do cliente após você clicar em "Concluir" no painel.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Enviar após quantos minutos?</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={config.npsTempoMinutos} 
                  onChange={(e) => setConfig({...config, npsTempoMinutos: Number(e.target.value)})}
                  className="w-full md:w-24 border p-3 rounded-xl text-sm font-black outline-none text-center transition-colors" 
                  style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}
                  min="1"
                />
                <span className="text-xs font-black uppercase" style={{ color: 'var(--cor-texto-principal)' }}>Minutos</span>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Mensagem de Avaliação</label>
              <textarea 
                value={config.msgNPS} 
                onChange={(e) => setConfig({...config, msgNPS: e.target.value})}
                className="w-full border p-4 rounded-xl text-xs font-medium outline-none h-28 resize-none transition-colors" 
                style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
              />
              <p className="text-[9px] font-bold" style={{ color: 'var(--cor-texto-secundario)' }}>Variáveis: <span style={{ color: 'var(--cor-primaria)' }}>{'{nome}'}</span>, <span style={{ color: 'var(--cor-primaria)' }}>{'{barbeiro}'}</span></p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}