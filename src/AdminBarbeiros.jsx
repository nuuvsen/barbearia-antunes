import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'

// ÍCONE PADRÃO: Letra A com Navalha (SVG customizado)
const FotoPadrao = () => (
  <div className="w-full h-full bg-[#1c1c1c] flex items-center justify-center rounded-full border-2 border-dashed border-red-600/30 group-hover:border-red-600 transition-colors">
    <svg viewBox="0 0 100 100" className="w-12 h-12 fill-none stroke-red-600" strokeWidth="3">
      {/* Navalha Estilizada */}
      <path d="M70 20 L30 60 L20 50 L60 10 Z" fill="currentColor" opacity="0.2" />
      <path d="M30 60 L75 15" strokeLinecap="round" />
      {/* Letra A Centralizada */}
      <text x="50%" y="65%" textAnchor="middle" className="fill-red-600 font-black italic tracking-tighter" fontSize="30">A</text>
    </svg>
  </div>
)

export default function AdminBarbeiros() {
  const [barbeiros, setBarbeiros] = useState([])
  const [form, setForm] = useState({ id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '' })

  const carregar = async () => {
    const snap = await getDocs(collection(db, "barbeiros"))
    setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome) return

    const dadosBarbeiro = {
      nome: form.nome,
      idade: form.idade,
      dataInicio: form.dataInicio,
      instagram: form.instagram,
      // Se o campo foto estiver vazio, salvamos uma string vazia (o que acionará o ícone no site)
      foto: form.foto || '' 
    }

    if (form.id) {
      await updateDoc(doc(db, "barbeiros", form.id), dadosBarbeiro)
    } else {
      await addDoc(collection(db, "barbeiros"), dadosBarbeiro)
    }

    setForm({ id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '' })
    carregar()
  }

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10">Equipe <span className="text-red-600">Antunes</span></h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        <div className="lg:col-span-2 space-y-4">
          {barbeiros.map(b => (
            <div key={b.id} className="bg-[#111111] p-6 rounded-3xl border border-[#1f1f1f] flex flex-col md:flex-row justify-between items-center gap-6 group transition-all">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 relative">
                  {/* Se tiver link de foto, mostra a foto. Se não, mostra o ícone do A */}
                  {b.foto ? (
                    <img src={b.foto} className="w-full h-full rounded-full border-2 border-red-600 object-cover" alt={b.nome} />
                  ) : (
                    <FotoPadrao />
                  )}
                </div>
                <div>
                  <p className="font-black text-2xl uppercase tracking-tighter">{b.nome}</p>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{b.idade} Anos • Desde {b.dataInicio}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => setForm(b)} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-white hover:text-black">✏️</button>
                <button onClick={async () => { if(confirm("Remover?")) { await deleteDoc(doc(db, "barbeiros", b.id)); carregar(); } }} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-red-600">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* FORMULÁRIO */}
        <div className="bg-[#111111] p-8 rounded-3xl border border-[#1f1f1f] h-fit sticky top-10 shadow-2xl">
          <h2 className="text-xl font-black mb-6 uppercase italic text-red-600">{form.id ? 'Editar' : 'Novo'} Barbeiro</h2>
          <form onSubmit={salvar} className="space-y-4">
            <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome Completo" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            
            <div className="grid grid-cols-2 gap-4">
              <input value={form.idade} onChange={e => setForm({...form, idade: e.target.value})} placeholder="Idade" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              <input value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} placeholder="Ano Início" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            </div>

            <input value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})} placeholder="Link do Instagram" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-black ml-2">Link da Foto (Opcional)</label>
              <input value={form.foto} onChange={e => setForm({...form, foto: e.target.value})} placeholder="https://..." className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600 text-xs" />
            </div>

            <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 uppercase tracking-widest mt-4">
              {form.id ? 'Salvar Alterações' : 'Cadastrar na Equipe'}
            </button>
            {form.id && <button type="button" onClick={() => setForm({id:null, nome:'', idade:'', dataInicio:'', instagram:'', foto:''})} className="w-full text-gray-500 text-xs font-bold mt-2">Cancelar</button>}
          </form>
        </div>
      </div>
    </div>
  )
}