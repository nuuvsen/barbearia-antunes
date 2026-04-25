import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function AdminAgenda() {
  const [salvando, setSalvando] = useState(false)
  
  const [config, setConfig] = useState({
    intervalo: '40',
    feriadosAtivos: true,
    horariosPorDia: {
      0: { ativo: false, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '18:00' },
      1: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      2: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      3: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      4: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '19:00' },
      5: { ativo: true, t1Ini: '09:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '21:00' },
      6: { ativo: true, t1Ini: '08:00', t1Fim: '12:00', t2Ini: '13:00', t2Fim: '20:00' },
    }
  })

  useEffect(() => {
    const carregar = async () => {
      const docSnap = await getDoc(doc(db, "configuracoes", "agenda"))
      if (docSnap.exists()) setConfig(docSnap.data())
    }
    carregar()
  }, [])

  const atualizarDia = (diaId, campo, valor) => {
    setConfig({
      ...config,
      horariosPorDia: {
        ...config.horariosPorDia,
        [diaId]: { ...config.horariosPorDia[diaId], [campo]: valor }
      }
    })
  }

  const aplicarATodos = (diaIdOrigem) => {
    const base = config.horariosPorDia[diaIdOrigem]
    const novosHorarios = {}
    Object.keys(config.horariosPorDia).forEach(id => {
      novosHorarios[id] = { ...base, ativo: config.horariosPorDia[id].ativo }
    })
    setConfig({ ...config, horariosPorDia: novosHorarios })
  }

  const salvar = async () => {
    setSalvando(true)
    await setDoc(doc(db, "configuracoes", "agenda"), config)
    setSalvando(false)
    alert("Configurações de agenda guardadas!")
  }

  const diasNomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10 text-white">
        Horários <span className="text-red-600">Flexíveis</span>
      </h1>

      <div className="space-y-6">
        <div className="bg-[#111111] p-6 rounded-3xl border border-[#1f1f1f] flex flex-wrap gap-8 items-center">
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-black block mb-2">Intervalo de Cortes</label>
            <select 
              value={config.intervalo} 
              onChange={e => setConfig({...config, intervalo: e.target.value})} 
              className="bg-[#0a0a0a] border border-[#1f1f1f] p-3 rounded-xl text-white outline-none focus:border-red-600"
            >
              {/* NOVAS OPÇÕES ADICIONADAS AQUI */}
              <option value="5">5 min (Rápido)</option>
              <option value="20">20 min</option>
              <option value="30">30 min</option>
              <option value="40">40 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hora</option>
            </select>
          </div>
          <button onClick={salvar} disabled={salvando} className="ml-auto bg-green-600 px-10 py-4 rounded-2xl font-black uppercase text-sm hover:bg-green-500 transition-all">
            {salvando ? 'A guardar...' : 'Guardar Alterações'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {diasNomes.map((nome, id) => (
            <div key={id} className={`bg-[#111111] p-6 rounded-3xl border transition-all ${config.horariosPorDia[id].ativo ? 'border-[#1f1f1f]' : 'border-red-900/20 opacity-50'}`}>
              <div className="flex flex-wrap items-center gap-6">
                <div className="w-40">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={config.horariosPorDia[id].ativo} onChange={e => atualizarDia(id, 'ativo', e.target.checked)} className="w-5 h-5 accent-red-600" />
                    <span className="font-bold uppercase italic text-white">{nome}</span>
                  </label>
                </div>

                {config.horariosPorDia[id].ativo && (
                  <>
                    <div className="flex items-center gap-2 bg-[#0a0a0a] p-2 rounded-xl border border-[#1f1f1f]">
                      <span className="text-[10px] text-gray-500 uppercase font-black px-2">T1:</span>
                      <input type="time" value={config.horariosPorDia[id].t1Ini} onChange={e => atualizarDia(id, 't1Ini', e.target.value)} className="bg-transparent text-white outline-none" />
                      <span className="text-gray-700">às</span>
                      <input type="time" value={config.horariosPorDia[id].t1Fim} onChange={e => atualizarDia(id, 't1Fim', e.target.value)} className="bg-transparent text-white outline-none" />
                    </div>

                    <div className="flex items-center gap-2 bg-[#0a0a0a] p-2 rounded-xl border border-[#1f1f1f]">
                      <span className="text-[10px] text-gray-500 uppercase font-black px-2">T2:</span>
                      <input type="time" value={config.horariosPorDia[id].t2Ini} onChange={e => atualizarDia(id, 't2Ini', e.target.value)} className="bg-transparent text-white outline-none" />
                      <span className="text-gray-700">às</span>
                      <input type="time" value={config.horariosPorDia[id].t2Fim} onChange={e => atualizarDia(id, 't2Fim', e.target.value)} className="bg-transparent text-white outline-none" />
                    </div>

                    <button onClick={() => aplicarATodos(id)} className="text-[10px] text-gray-600 hover:text-red-500 font-black uppercase tracking-widest transition-colors">
                      Replicar para todos
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}