import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function AdminHorarios() {
  const [config, setConfig] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const carregarConfig = async () => {
      const docRef = doc(db, "configuracoes", "agenda")
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        setConfig(docSnap.data())
      } else {
        setConfig({
          intervalo: '30',
          feriadosAtivos: true, // Padrão agora é fechar nos feriados
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
      }
    }
    carregarConfig()
  }, [])

  const handleDiaChange = (diaIdx, campo, valor) => {
    setConfig(prev => ({
      ...prev,
      horariosPorDia: {
        ...prev.horariosPorDia,
        [diaIdx]: {
          ...prev.horariosPorDia[diaIdx],
          [campo]: valor
        }
      }
    }))
  }

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      await setDoc(doc(db, "configuracoes", "agenda"), config)
      alert("Horários atualizados com sucesso!")
    } catch (error) {
      alert("Erro ao salvar horários.")
    }
    setSalvando(false)
  }

  if (!config) return <div className="text-gray-500 font-black animate-pulse">Carregando configurações...</div>

  return (
    <div className="animate-in fade-in duration-500">
      <form onSubmit={salvar} className="max-w-4xl space-y-8">
        
        {/* CONFIGURAÇÕES GERAIS */}
        <div className="bg-[#111111] p-8 rounded-3xl border border-[#1f1f1f] shadow-lg flex gap-8 items-center">
          <div className="flex-1">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Tempo Padrão de Corte (Minutos)</label>
            <select 
              value={config.intervalo} 
              onChange={e => setConfig({...config, intervalo: e.target.value})}
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600 font-bold"
            >
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos</option>
              <option value="40">40 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Fechar nos Feriados?</label>
            <button 
              type="button"
              onClick={() => setConfig({...config, feriadosAtivos: !config.feriadosAtivos})}
              className={`w-full p-4 rounded-2xl font-black uppercase tracking-widest transition-all border ${config.feriadosAtivos ? 'bg-red-600/10 border-red-600 text-red-500' : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-500'}`}
            >
              {config.feriadosAtivos ? 'Sim (Bloquear Dia)' : 'Não (Trabalhar Normal)'}
            </button>
          </div>
        </div>

        {/* GRADE DE DIAS DA SEMANA */}
        <div className="space-y-4">
          <h2 className="text-xl font-black uppercase italic text-white mb-4">Escala Semanal da Barbearia</h2>
          
          {Object.keys(config.horariosPorDia).map((diaIdx) => {
            const dia = config.horariosPorDia[diaIdx]
            return (
              <div key={diaIdx} className={`p-6 rounded-3xl border transition-all flex flex-col md:flex-row items-center gap-6 ${dia.ativo ? 'bg-[#111111] border-[#1f1f1f]' : 'bg-[#0a0a0a] border-[#1a1a1a] opacity-60'}`}>
                
                <div className="w-32 flex-shrink-0">
                  <label className="flex items-center cursor-pointer gap-3">
                    <input 
                      type="checkbox" 
                      checked={dia.ativo}
                      onChange={(e) => handleDiaChange(diaIdx, 'ativo', e.target.checked)}
                      className="w-5 h-5 accent-red-600"
                    />
                    <span className="font-black uppercase tracking-widest text-sm text-white">{DIAS_NOME[diaIdx]}</span>
                  </label>
                </div>

                {dia.ativo ? (
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">Manhã (Início)</span>
                      <input type="time" value={dia.t1Ini} onChange={e => handleDiaChange(diaIdx, 't1Ini', e.target.value)} className="w-full bg-[#1a1a1a] text-white p-3 rounded-xl border border-[#333] outline-none" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">Manhã (Fim)</span>
                      <input type="time" value={dia.t1Fim} onChange={e => handleDiaChange(diaIdx, 't1Fim', e.target.value)} className="w-full bg-[#1a1a1a] text-white p-3 rounded-xl border border-[#333] outline-none" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">Tarde (Início)</span>
                      <input type="time" value={dia.t2Ini} onChange={e => handleDiaChange(diaIdx, 't2Ini', e.target.value)} className="w-full bg-[#1a1a1a] text-white p-3 rounded-xl border border-[#333] outline-none" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">Tarde (Fim)</span>
                      <input type="time" value={dia.t2Fim} onChange={e => handleDiaChange(diaIdx, 't2Fim', e.target.value)} className="w-full bg-[#1a1a1a] text-white p-3 rounded-xl border border-[#333] outline-none" />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 text-gray-600 text-xs font-black uppercase tracking-widest">
                    Fechado neste dia
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button type="submit" disabled={salvando} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-700 uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all">
          {salvando ? 'Salvando...' : 'Salvar Configurações de Horário'}
        </button>

      </form>
    </div>
  )
}