import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Check, X, Calendar } from 'lucide-react'

const DIAS_DA_SEMANA = [
  { id: 'seg', nome: 'Segunda' },
  { id: 'ter', nome: 'Terça' },
  { id: 'qua', nome: 'Quarta' },
  { id: 'qui', nome: 'Quinta' },
  { id: 'sex', nome: 'Sexta' },
  { id: 'sab', nome: 'Sábado' },
  { id: 'dom', nome: 'Domingo' },
]

const FotoPadrao = () => (
  <div className="w-full h-full bg-[#1c1c1c] flex items-center justify-center rounded-full border-2 border-dashed border-red-600/30 group-hover:border-red-600 transition-colors">
    <svg viewBox="0 0 100 100" className="w-12 h-12 fill-none stroke-red-600" strokeWidth="3">
      <path d="M70 20 L30 60 L20 50 L60 10 Z" fill="currentColor" opacity="0.2" />
      <path d="M30 60 L75 15" strokeLinecap="round" />
      <text x="50%" y="65%" textAnchor="middle" className="fill-red-600 font-black italic tracking-tighter" fontSize="30">A</text>
    </svg>
  </div>
)

export default function AdminBarbeiros() {
  const [barbeiros, setBarbeiros] = useState([])
  
  // Agenda padrão inicial: todos os dias começam como 'true' (trabalha)
  const agendaInicial = {
    seg: true, ter: true, qua: true, qui: true, sex: true, sab: true, dom: false
  }

  const [form, setForm] = useState({ 
    id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '',
    diasTrabalho: agendaInicial 
  })

  const carregar = async () => {
    const snap = await getDocs(collection(db, "barbeiros"))
    setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { carregar() }, [])

  const toggleDia = (diaId) => {
    setForm(prev => ({
      ...prev,
      diasTrabalho: {
        ...prev.diasTrabalho,
        [diaId]: !prev.diasTrabalho[diaId]
      }
    }))
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome) return

    const dadosBarbeiro = {
      nome: form.nome,
      idade: form.idade,
      dataInicio: form.dataInicio,
      instagram: form.instagram,
      foto: form.foto || '',
      diasTrabalho: form.diasTrabalho // Salva apenas quais dias ele está ativo
    }

    if (form.id) {
      await updateDoc(doc(db, "barbeiros", form.id), dadosBarbeiro)
    } else {
      await addDoc(collection(db, "barbeiros"), dadosBarbeiro)
    }

    setForm({ id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '', diasTrabalho: agendaInicial })
    carregar()
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10 text-white">Equipe <span className="text-red-600">Antunes</span></h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LISTA DE BARBEIROS */}
        <div className="lg:col-span-2 space-y-4">
          {barbeiros.map(b => (
            <div key={b.id} className="bg-[#111111] p-6 rounded-3xl border border-[#1f1f1f] flex flex-col md:flex-row justify-between items-center gap-6 group transition-all">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 relative">
                  {b.foto ? (
                    <img src={b.foto} className="w-full h-full rounded-full border-2 border-red-600 object-cover" alt={b.nome} />
                  ) : (
                    <FotoPadrao />
                  )}
                </div>
                <div>
                  <p className="font-black text-2xl uppercase tracking-tighter text-white">{b.nome}</p>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{b.idade} Anos • Desde {b.dataInicio}</p>
                  
                  {/* Resumo visual dos dias que trabalha */}
                  <div className="flex gap-1 mt-3">
                    {DIAS_DA_SEMANA.map(d => (
                      <div key={d.id} className={`text-[9px] px-1.5 py-0.5 rounded font-black ${b.diasTrabalho?.[d.id] ? 'bg-green-600/20 text-green-500' : 'bg-white/5 text-gray-600'}`}>
                        {d.id.toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...b, diasTrabalho: b.diasTrabalho || agendaInicial })} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-white hover:text-black transition-all">✏️</button>
                <button onClick={async () => { if(confirm("Remover da equipe?")) { await deleteDoc(doc(db, "barbeiros", b.id)); carregar(); } }} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-red-600 transition-all text-white">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* FORMULÁRIO */}
        <div className="bg-[#111111] p-8 rounded-3xl border border-[#1f1f1f] h-fit sticky top-10 shadow-2xl">
          <h2 className="text-xl font-black mb-6 uppercase italic text-red-600">{form.id ? 'Editar' : 'Novo'} Barbeiro</h2>
          <form onSubmit={salvar} className="space-y-6">
            
            <div className="space-y-3">
              <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do Barbeiro" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.idade} onChange={e => setForm({...form, idade: e.target.value})} placeholder="Idade" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
                <input value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} placeholder="Início (Ano)" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              </div>
            </div>

            {/* SELEÇÃO DE DIAS (AGENDA PADRÃO) */}
            <div className="pt-4 border-t border-white/5">
              <h3 className="text-[10px] font-black uppercase text-gray-500 mb-4 flex items-center gap-2 tracking-widest">
                <Calendar size={12} className="text-red-600" /> Dias de Atendimento
              </h3>
              
              <div className="grid grid-cols-1 gap-2">
                {DIAS_DA_SEMANA.map((dia) => (
                  <button 
                    key={dia.id} 
                    type="button"
                    onClick={() => toggleDia(dia.id)}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                      form.diasTrabalho[dia.id] 
                      ? 'bg-red-600/10 border-red-600/40 text-white' 
                      : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-700'
                    }`}
                  >
                    <span className="font-bold text-xs uppercase tracking-tighter">{dia.nome}</span>
                    {form.diasTrabalho[dia.id] ? <Check size={14} className="text-red-600" /> : <X size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 uppercase tracking-widest transition-all shadow-lg shadow-red-600/20">
              {form.id ? 'Atualizar Perfil' : 'Salvar Barbeiro'}
            </button>
            
            {form.id && (
              <button type="button" onClick={() => setForm({id:null, nome:'', idade:'', dataInicio:'', instagram:'', foto:'', diasTrabalho: agendaInicial})} className="w-full text-gray-600 text-[10px] font-black uppercase tracking-widest mt-2 hover:text-white transition-colors">
                Cancelar Edição
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}