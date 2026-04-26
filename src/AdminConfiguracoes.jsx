import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { Percent, Clock, Save, User, Calendar, AlertCircle, ChevronRight } from 'lucide-react'

const DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function AdminConfiguracoes() {
  const [secao, setSecao] = useState('comissoes')
  const [barbeiros, setBarbeiros] = useState([])
  const [comissoes, setComissoes] = useState({})
  
  // Estado Unificado da Agenda (Horários, Intervalo e Feriados)
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
  
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const carregarDados = async () => {
      // 1. Carregar Barbeiros
      const bSnap = await getDocs(collection(db, "barbeiros"))
      setBarbeiros(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // 2. Carregar Comissões
      const comRef = doc(db, "configuracoes", "comissoes")
      const comSnap = await getDoc(comRef)
      if (comSnap.exists()) setComissoes(comSnap.data())

      // 3. Carregar Configurações de Agenda (Intervalo, Feriados e Escala)
      const agendaRef = doc(db, "configuracoes", "agenda")
      const agendaSnap = await getDoc(agendaRef)
      if (agendaSnap.exists()) {
        setConfigAgenda(agendaSnap.data())
      }
    }
    carregarDados()
  }, [])

  // Lógica para alterar horários da escala
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
      // Salva comissões no doc "comissoes"
      await setDoc(doc(db, "configuracoes", "comissoes"), comissoes)
      
      // Salva toda a estrutura da agenda no doc "agenda"
      await setDoc(doc(db, "configuracoes", "agenda"), configAgenda)
      
      alert("Configurações atualizadas com sucesso!")
    } catch (e) {
      console.error(e)
      alert("Erro ao salvar.")
    }
    setSalvando(false)
  }

  return (
    <div className="max-w-5xl animate-in fade-in duration-500 pb-20">
      
      {/* HEADER FIXO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Painel de <span className="text-red-600">Controle</span>
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
            <Save size={12} className="text-red-600" /> Configurações globais da barbearia
          </p>
        </div>
        <button 
          onClick={salvando ? null : salvarConfiguracoes}
          className="bg-red-600 hover:bg-red-700 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-red-600/20 active:scale-95 disabled:opacity-50"
          disabled={salvando}
        >
          {salvando ? "Salvando..." : <><Save size={20} /> Salvar Tudo</>}
        </button>
      </div>

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="flex gap-4 mb-8 bg-[#0a0a0a] p-2 rounded-2xl border border-[#1f1f1f]">
        <button 
          onClick={() => setSecao('comissoes')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${secao === 'comissoes' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Percent size={16} /> Comissões
        </button>
        <button 
          onClick={() => setSecao('escala')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${secao === 'escala' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Clock size={16} /> Escala & Horários
        </button>
      </div>

      {/* SEÇÃO: COMISSÕES */}
      {secao === 'comissoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-500">
          {barbeiros.map(b => (
            <div key={b.id} className="bg-[#111] border border-[#1f1f1f] p-6 rounded-3xl flex items-center justify-between group hover:border-red-600/40 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-red-600 border border-[#1f1f1f] group-hover:scale-110 transition-transform">
                  <User size={24} />
                </div>
                <div>
                  <span className="font-black uppercase text-sm tracking-widest text-white block">{b.nome}</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Repasse p/ Barbeiro</span>
                </div>
              </div>
              <div className="flex items-center bg-black border border-[#1f1f1f] rounded-2xl px-6 py-3 shadow-inner">
                <input 
                  type="number" 
                  value={comissoes[b.nome] || 50}
                  onChange={(e) => setComissoes({...comissoes, [b.nome]: parseInt(e.target.value)})}
                  className="bg-transparent w-12 text-center font-black focus:outline-none text-red-600 text-xl"
                />
                <Percent size={16} className="text-gray-600" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SEÇÃO: ESCALA & HORÁRIOS */}
      {secao === 'escala' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* CONFIGS GERAIS DE TEMPO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#111] p-8 rounded-[2.5rem] border border-[#1f1f1f]">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Intervalo entre Cortes</label>
              <select 
                value={configAgenda.intervalo} 
                onChange={e => setConfigAgenda({...configAgenda, intervalo: e.target.value})}
                className="w-full bg-black border border-[#1f1f1f] p-5 rounded-2xl text-white outline-none focus:border-red-600 font-black text-lg appearance-none cursor-pointer"
              >
                {[15, 20, 30, 40, 45, 60].map(m => (
                  <option key={m} value={m}>{m} Minutos</option>
                ))}
              </select>
            </div>

            <div className="bg-[#111] p-8 rounded-[2.5rem] border border-[#1f1f1f] flex flex-col justify-center">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 text-center">Feriados e Datas Especiais</label>
              <button 
                onClick={() => setConfigAgenda({...configAgenda, feriadosAtivos: !configAgenda.feriadosAtivos})}
                className={`w-full p-5 rounded-2xl font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-3 ${configAgenda.feriadosAtivos ? 'bg-red-600/10 border-red-600 text-red-500 shadow-lg shadow-red-600/5' : 'bg-black border-[#1f1f1f] text-gray-600'}`}
              >
                <AlertCircle size={18} />
                {configAgenda.feriadosAtivos ? 'Bloquear Agenda nos Feriados' : 'Trabalhar Normalmente'}
              </button>
            </div>
          </div>

          {/* GRADE SEMANAL DETALHADA */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-[0.3em] ml-4 mb-4 flex items-center gap-2">
              <Calendar size={14} /> Definição de Turnos Semanais
            </h3>
            
            {DIAS_NOME.map((nome, diaIdx) => {
              const dia = configAgenda.horariosPorDia[diaIdx]
              return (
                <div key={diaIdx} className={`p-6 rounded-[2rem] border transition-all flex flex-col lg:flex-row items-center gap-6 ${dia.ativo ? 'bg-[#111] border-[#1f1f1f]' : 'bg-[#0a0a0a] border-[#1a1a1a] opacity-50'}`}>
                  
                  {/* Status do Dia */}
                  <div className="w-full lg:w-48 flex-shrink-0">
                    <label className="flex items-center cursor-pointer gap-4 group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={dia.ativo}
                          onChange={(e) => handleDiaChange(diaIdx, 'ativo', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-12 h-6 rounded-full transition-colors ${dia.ativo ? 'bg-red-600' : 'bg-gray-800'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${dia.ativo ? 'right-1' : 'left-1'}`} />
                        </div>
                      </div>
                      <span className={`font-black uppercase tracking-widest text-sm ${dia.ativo ? 'text-white' : 'text-gray-600'}`}>{nome}</span>
                    </label>
                  </div>

                  {dia.ativo ? (
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                      {[
                        { label: 'Manhã (Início)', key: 't1Ini' },
                        { label: 'Manhã (Fim)', key: 't1Fim' },
                        { label: 'Tarde (Início)', key: 't2Ini' },
                        { label: 'Tarde (Fim)', key: 't2Fim' }
                      ].map(campo => (
                        <div key={campo.key}>
                          <span className="text-[9px] text-gray-500 uppercase font-black block mb-2 tracking-tighter">{campo.label}</span>
                          <input 
                            type="time" 
                            value={dia[campo.key]} 
                            onChange={e => handleDiaChange(diaIdx, campo.key, e.target.value)} 
                            className="w-full bg-black text-white p-3 rounded-xl border border-[#222] outline-none font-bold focus:border-red-600 transition-colors" 
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 text-gray-700 text-[10px] font-black uppercase tracking-[0.2em] italic">
                      Estabelecimento fechado
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}