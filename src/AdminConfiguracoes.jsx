import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { 
  Percent, Clock, Save, User, Calendar, 
  AlertCircle, Headphones, Palette, Loader2, ChevronDown, Plus, Trash2, CalendarRange 
} from 'lucide-react'
import AdminSuporte from './AdminSuporte'
import Personalizacao from './Personalizacao' 

const DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function AdminConfiguracoes() {
  const [secao, setSecao] = useState('comissoes')
  const [barbeiros, setBarbeiros] = useState([])
  const [comissoes, setComissoes] = useState({})
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
    ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '20:40'
  })

  // ESTADOS PARA NOVA REGRA DE SEMANA
  const [formRegraSemana, setFormRegraSemana] = useState({
    diaSemana: 5, // Padrão: Sexta
    semanas: [1, 2], // Padrão: 1ª e 2ª semana
    ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:40'
  })

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

        const comRef = doc(db, "configuracoes", "comissoes")
        const comSnap = await getDoc(comRef)
        if (comSnap.exists()) setComissoes(comSnap.data())

        const agendaRef = doc(db, "configuracoes", "agenda")
        const agendaSnap = await getDoc(agendaRef)
        if (agendaSnap.exists()) {
          const dadosAgenda = agendaSnap.data()
          setConfigAgenda({ 
            ...dadosAgenda, 
            excecoes: dadosAgenda.excecoes || {},
            regrasSemanas: dadosAgenda.regrasSemanas || []
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

  const adicionarRegraSemana = () => {
    if (formRegraSemana.semanas.length === 0) return alert("Selecione ao menos uma semana do mês.")
    setConfigAgenda(prev => ({
      ...prev,
      regrasSemanas: [...(prev.regrasSemanas || []), { ...formRegraSemana, id: Date.now().toString() }]
    }))
  }

  const removerRegraSemana = (id) => {
    setConfigAgenda(prev => ({
      ...prev,
      regrasSemanas: prev.regrasSemanas.filter(r => r.id !== id)
    }))
  }

  // ---- FUNÇÕES EXCEÇÕES DATA EXATA ----
  const adicionarExcecao = () => {
    if (!dataNovaExcecao) return alert("Selecione uma data para a exceção.")
    setConfigAgenda(prev => ({
      ...prev,
      excecoes: { ...prev.excecoes, [dataNovaExcecao]: formExcecao }
    }))
    setDataNovaExcecao('')
  }

  const removerExcecao = (dataRemover) => {
    setConfigAgenda(prev => {
      const novasExcecoes = { ...prev.excecoes }
      delete novasExcecoes[dataRemover]
      return { ...prev, excecoes: novasExcecoes }
    })
  }

  const formatarDataBR = (dataISO) => {
    const [ano, mes, dia] = dataISO.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const salvarConfiguracoes = async () => {
    setSalvando(true)
    try {
      await setDoc(doc(db, "configuracoes", "comissoes"), comissoes)
      await setDoc(doc(db, "configuracoes", "agenda"), configAgenda)
      alert("Configurações salvas com sucesso!")
    } catch (e) {
      alert("Erro ao salvar.")
    }
    setSalvando(false)
  }

  if (carregando) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin text-gray-400" size={40} />
      <p className="font-black uppercase text-[10px] tracking-widest text-gray-400">Carregando Preferências...</p>
    </div>
  )

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
        
        {secao !== 'suporte' && secao !== 'personalizacao' && (
          <button onClick={salvando ? null : salvarConfiguracoes} disabled={salvando}
            className="hover:scale-105 active:scale-95 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg"
            style={{ backgroundColor: cores.primaria, color: '#ffffff' }}>
            {salvando ? "Salvando..." : <><Save size={18} /> Salvar Tudo</>}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-8 p-1.5 rounded-2xl border" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
        {[{ id: 'comissoes', label: 'Comissões', icon: Percent }, { id: 'escala', label: 'Escala & Horários', icon: Clock },
          { id: 'personalizacao', label: 'Personalização', icon: Palette }, { id: 'suporte', label: 'Suporte', icon: Headphones }].map((item) => (
          <button key={item.id} onClick={() => setSecao(item.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
            style={{ backgroundColor: secao === item.id ? cores.primaria : 'transparent', color: secao === item.id ? '#ffffff' : cores.textoSecundario }}>
            <item.icon size={14} /> {item.label}
          </button>
        ))}
      </div>

      {secao === 'escala' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* INTERVALO E FERIADOS... (IGUAL ANTES) */}
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

          {/* TURNOS PADRÃO (IGUAL ANTES) */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest ml-2 mb-4 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
              <Calendar size={14} style={{ color: cores.primaria }} /> Turnos Padrão (Fixos)
            </h3>
            {DIAS_NOME.map((nome, diaIdx) => {
              const dia = configAgenda.horariosPorDia[diaIdx]
              return (
                <div key={diaIdx} className={`p-5 rounded-[1.5rem] border flex flex-col lg:flex-row items-center gap-6 ${dia.ativo ? 'shadow-sm' : 'opacity-40 grayscale'}`} style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
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
                            className="w-full p-2.5 rounded-xl border outline-none font-bold text-xs text-center" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: '#000000' }} />
                        </div>
                      ))}
                    </div>
                  ) : <span className="flex-1 text-[9px] font-black uppercase italic" style={{ color: cores.textoSecundario }}>Fechado</span>}
                </div>
              )
            })}
          </div>

          {/* NOVA SEÇÃO: REGRAS POR SEMANA (DINÂMICAS) */}
          <div className="mt-12 pt-8 border-t border-dashed" style={{ borderColor: cores.borda }}>
            <h3 className="text-sm font-black uppercase tracking-widest ml-2 mb-2 flex items-center gap-2" style={{ color: cores.textoPrincipal }}>
              <CalendarRange size={18} style={{ color: cores.primaria }} /> Regras Dinâmicas por Semana do Mês
            </h3>
            <p className="text-xs mb-6 ml-2" style={{ color: cores.textoSecundario }}>
              Exemplo: Criar um horário que se aplica apenas na 1ª e na 2ª sexta-feira de todo mês.
            </p>

            <div className="p-6 rounded-[2rem] border mb-6" style={{ backgroundColor: `${cores.primaria}08`, borderColor: cores.borda }}>
              <div className="flex flex-col gap-6">
                
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
                          className="w-full p-3 rounded-xl border outline-none font-bold text-xs text-center" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: '#000000' }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={adicionarRegraSemana} className="px-6 py-3 rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:brightness-110 transition-all w-full lg:w-auto h-full" style={{ backgroundColor: cores.primaria, color: '#ffffff' }}>
                    <Plus size={16} /> Adicionar
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {(configAgenda.regrasSemanas || []).map(regra => (
                <div key={regra.id} className="p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="font-black px-4 py-2 rounded-lg text-sm border" style={{ backgroundColor: cores.fundo, borderColor: cores.borda, color: cores.textoPrincipal }}>
                      {DIAS_NOME[regra.diaSemana]}s <span style={{ color: cores.primaria }}>({regra.semanas.join('ª, ')}ª Sem)</span>
                    </div>
                    <div className="text-xs font-bold" style={{ color: cores.textoSecundario }}>
                      {regra.t1Ini} às {regra.t1Fim}  —  {regra.t2Ini} às {regra.t2Fim}
                    </div>
                  </div>
                  <button onClick={() => removerRegraSemana(regra.id)} className="p-3 bg-red-50 border border-red-200 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                    <Trash2 size={16} />
                  </button>
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

            <div className="p-6 rounded-[2rem] border mb-6" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <div className="flex flex-col lg:flex-row gap-6 items-end">
                <div className="w-full lg:w-48 space-y-2">
                  <label className="text-[10px] font-black uppercase" style={{ color: cores.textoPrincipal }}>Selecione o Dia Único</label>
                  <input type="date" value={dataNovaExcecao} onChange={(e) => setDataNovaExcecao(e.target.value)}
                    className="w-full p-3 rounded-xl border outline-none font-bold text-xs" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: '#000000' }} />
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  {[{ label: 'Início 1', key: 't1Ini' }, { label: 'Fim 1', key: 't1Fim' }, { label: 'Início 2', key: 't2Ini' }, { label: 'Fim 2', key: 't2Fim' }].map(campo => (
                    <div key={campo.key} className="space-y-1">
                      <span className="text-[8px] uppercase font-black" style={{ color: cores.textoPrincipal }}>{campo.label}</span>
                      <input type="time" value={formExcecao[campo.key]} onChange={e => setFormExcecao({...formExcecao, [campo.key]: e.target.value})} 
                        className="w-full p-3 rounded-xl border outline-none font-bold text-xs text-center" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: '#000000' }} />
                    </div>
                  ))}
                </div>
                <button onClick={adicionarExcecao} className="px-6 py-3 rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-gray-100 transition-all w-full lg:w-auto h-full border" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda, color: cores.textoPrincipal }}>
                  <Plus size={16} /> Criar
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(configAgenda.excecoes || {}).map(([dataStr, config]) => (
                <div key={dataStr} className="p-4 rounded-2xl border flex items-center justify-between gap-4" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500/10 text-red-500 font-black px-4 py-2 rounded-lg text-lg">{formatarDataBR(dataStr)}</div>
                    <div className="text-xs font-bold" style={{ color: cores.textoSecundario }}>{config.t1Ini} às {config.t1Fim}  —  {config.t2Ini} às {config.t2Fim}</div>
                  </div>
                  <button onClick={() => removerExcecao(dataStr)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
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
                <input type="number" value={comissoes[b.nome] || 50} onChange={(e) => setComissoes({...comissoes, [b.nome]: e.target.value})}
                  className="w-10 text-center font-black bg-transparent outline-none" style={{ color: cores.primaria }} />
                <Percent size={14} style={{ color: cores.textoSecundario }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {secao === 'personalizacao' && <Personalizacao />}
      {secao === 'suporte' && <AdminSuporte />}
    </div>
  )
}