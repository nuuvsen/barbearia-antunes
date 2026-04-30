import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { 
  Percent, Clock, Save, User, Calendar, 
  AlertCircle, Headphones, Palette, Loader2, ChevronDown 
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

  // CORES INICIAIS (Ajustadas para evitar o fundo preto nos inputs)
  const [cores, setCores] = useState({
    primaria: '#fbbf24',
    fundo: '#f8f9fa',
    card: '#ffffff',
    textoPrincipal: '#111827',
    textoSecundario: '#6b7280',
    borda: '#e5e7eb',
    inputBg: '#ffffff' // Forçado para branco como padrão
  })

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
    }
  })

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const coresRef = doc(db, "configuracoes", "personalizacao")
        const coresSnap = await getDoc(coresRef)
        
        if (coresSnap.exists()) {
          const d = coresSnap.data().cores
          setCores({
            primaria: d.primaria || '#fbbf24',
            fundo: d.fundo || '#f8f9fa',
            card: d.card || '#ffffff',
            textoPrincipal: d.texto || '#111827',
            textoSecundario: d.textoSecundario || '#6b7280',
            borda: d.borda || '#e5e7eb',
            inputBg: d.inputBg || '#ffffff' 
          })
        }

        const bSnap = await getDocs(collection(db, "barbeiros"))
        setBarbeiros(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        const comRef = doc(db, "configuracoes", "comissoes")
        const comSnap = await getDoc(comRef)
        if (comSnap.exists()) setComissoes(comSnap.data())

        const agendaRef = doc(db, "configuracoes", "agenda")
        const agendaSnap = await getDoc(agendaRef)
        if (agendaSnap.exists()) setConfigAgenda(agendaSnap.data())

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

  const salvarConfiguracoes = async () => {
    setSalvando(true)
    try {
      await setDoc(doc(db, "configuracoes", "comissoes"), comissoes)
      await setDoc(doc(db, "configuracoes", "agenda"), configAgenda)
      alert("Configurações salvas!")
    } catch (e) {
      alert("Erro ao salvar.")
    }
    setSalvando(false)
  }

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-gray-400" size={40} />
        <p className="font-black uppercase text-[10px] tracking-widest text-gray-400">Carregando Preferências...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl animate-in fade-in duration-500 pb-20 min-h-screen p-4" style={{ backgroundColor: cores.fundo }}>
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: cores.textoPrincipal }}>
            Painel de <span style={{ color: cores.primaria }}>Controle</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cores.primaria }} /> Configurações globais da barbearia
          </p>
        </div>
        
        {secao !== 'suporte' && secao !== 'personalizacao' && (
          <button 
            onClick={salvando ? null : salvarConfiguracoes}
            className="hover:scale-105 active:scale-95 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg"
            style={{ backgroundColor: cores.primaria, color: '#ffffff' }}
            disabled={salvando}
          >
            {salvando ? "Salvando..." : <><Save size={18} /> Salvar Tudo</>}
          </button>
        )}
      </div>

      {/* NAVEGAÇÃO */}
      <div className="flex flex-wrap gap-2 mb-8 p-1.5 rounded-2xl border" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
        {[
          { id: 'comissoes', label: 'Comissões', icon: Percent },
          { id: 'escala', label: 'Escala & Horários', icon: Clock },
          { id: 'personalizacao', label: 'Personalização', icon: Palette },
          { id: 'suporte', label: 'Suporte', icon: Headphones },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setSecao(item.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
            style={{ 
              backgroundColor: secao === item.id ? cores.primaria : 'transparent',
              color: secao === item.id ? '#ffffff' : cores.textoSecundario,
            }}
          >
            <item.icon size={14} /> {item.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO: ESCALA & HORÁRIOS */}
      {secao === 'escala' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* INTERVALO */}
            <div className="p-8 rounded-[2rem] border shadow-sm" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: cores.textoSecundario }}>
                Intervalo entre Cortes
              </label>
              <div className="relative">
                <select 
                  value={configAgenda.intervalo} 
                  onChange={e => setConfigAgenda({...configAgenda, intervalo: e.target.value})}
                  className="w-full border p-4 rounded-2xl outline-none font-black text-lg appearance-none cursor-pointer focus:ring-2 transition-all"
                  style={{ 
                    backgroundColor: cores.inputBg, 
                    borderColor: cores.borda, 
                    color: '#000000', // Texto sempre preto para leitura
                  }}
                >
                  {[15, 20, 30, 40, 45, 60].map(m => (
                    <option key={m} value={m}>{m} Minutos</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" size={20} style={{ color: cores.primaria }} />
              </div>
            </div>

            {/* FERIADOS */}
            <div className="p-8 rounded-[2rem] border shadow-sm flex flex-col justify-center text-center" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: cores.textoSecundario }}>
                Feriados e Datas Especiais
              </label>
              <button 
                onClick={() => setConfigAgenda({...configAgenda, feriadosAtivos: !configAgenda.feriadosAtivos})}
                className="w-full p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border flex items-center justify-center gap-3"
                style={{ 
                  backgroundColor: configAgenda.feriadosAtivos ? `${cores.primaria}10` : 'transparent',
                  borderColor: configAgenda.feriadosAtivos ? cores.primaria : cores.borda,
                  color: configAgenda.feriadosAtivos ? cores.primaria : cores.textoSecundario,
                }}
              >
                <AlertCircle size={16} />
                {configAgenda.feriadosAtivos ? 'Bloquear Agenda nos Feriados' : 'Trabalhar Normalmente'}
              </button>
            </div>
          </div>

          {/* LISTA DE DIAS */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest ml-2 mb-4 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
              <Calendar size={14} style={{ color: cores.primaria }} /> Definição de Turnos Semanais
            </h3>
            
            {DIAS_NOME.map((nome, diaIdx) => {
              const dia = configAgenda.horariosPorDia[diaIdx]
              return (
                <div key={diaIdx} className={`p-5 rounded-[1.5rem] border transition-all flex flex-col lg:flex-row items-center gap-6 ${dia.ativo ? 'shadow-sm' : 'opacity-40 grayscale'}`}
                     style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
                  
                  <div className="w-full lg:w-44 flex items-center gap-4">
                    <button 
                      onClick={() => handleDiaChange(diaIdx, 'ativo', !dia.ativo)}
                      className="w-12 h-6 rounded-full relative transition-all"
                      style={{ backgroundColor: dia.ativo ? cores.primaria : '#d1d5db' }}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${dia.ativo ? 'right-1' : 'left-1'}`} />
                    </button>
                    <span className="font-black uppercase tracking-tighter text-xs" style={{ color: cores.textoPrincipal }}>{nome}</span>
                  </div>

                  {dia.ativo ? (
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                      {[
                        { label: 'Manhã (Início)', key: 't1Ini' },
                        { label: 'Manhã (Fim)', key: 't1Fim' },
                        { label: 'Tarde (Início)', key: 't2Ini' },
                        { label: 'Tarde (Fim)', key: 't2Fim' }
                      ].map(campo => (
                        <div key={campo.key} className="space-y-1">
                          <span className="text-[8px] uppercase font-black block tracking-tighter" style={{ color: cores.textoSecundario }}>{campo.label}</span>
                          <input 
                            type="time" 
                            value={dia[campo.key]} 
                            onChange={e => handleDiaChange(diaIdx, campo.key, e.target.value)} 
                            className="w-full p-2.5 rounded-xl border outline-none font-bold text-xs text-center" 
                            style={{ 
                              backgroundColor: cores.inputBg, 
                              borderColor: cores.borda, 
                              color: '#000000' // Texto preto para garantir visibilidade
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="flex-1 text-[9px] font-black uppercase tracking-widest italic" style={{ color: cores.textoSecundario }}>Estabelecimento Fechado</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* OUTRAS SEÇÕES (REDUZIDAS PARA O CÓDIGO NÃO FICAR GIGANTE) */}
      {secao === 'comissoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-500">
           {barbeiros.map(b => (
            <div key={b.id} className="border p-5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <span className="font-black uppercase text-xs tracking-widest" style={{ color: cores.textoPrincipal }}>{b.nome}</span>
              <div className="flex items-center gap-2 p-2 rounded-xl border" style={{ backgroundColor: cores.inputBg, borderColor: cores.borda }}>
                <input 
                  type="number" 
                  value={comissoes[b.nome] || 50}
                  onChange={(e) => setComissoes({...comissoes, [b.nome]: e.target.value})}
                  className="w-10 text-center font-black bg-transparent outline-none"
                  style={{ color: cores.primaria }}
                />
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