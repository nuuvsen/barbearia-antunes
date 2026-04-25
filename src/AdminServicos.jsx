import { useState } from 'react'
import { db } from './firebase'
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'

export default function AdminServicos({ servicos, aoMudar }) {
  const [form, setForm] = useState({ id: null, nome: '', preco: '', tempo: '' })

  const salvarServico = async (e) => {
    e.preventDefault()
    if (form.id) {
      await updateDoc(doc(db, "servicos", form.id), { nome: form.nome, preco: form.preco, tempo: form.tempo })
    } else {
      await addDoc(collection(db, "servicos"), { nome: form.nome, preco: form.preco, tempo: form.tempo || "30min" })
    }
    setForm({ id: null, nome: '', preco: '', tempo: '' })
    aoMudar()
  }

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10">Gerenciar <span className="text-red-600">Serviços</span></h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* TABELA DE SERVIÇOS */}
        <div className="lg:col-span-2">
          <div className="bg-[#111111] rounded-3xl border border-[#1f1f1f] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#161616] text-[10px] uppercase font-black text-gray-500">
                <tr><th className="p-5">Serviço</th><th className="p-5 text-center">Preço</th><th className="p-5 text-right">Ações</th></tr>
              </thead>
              <tbody>
                {servicos.map(s => (
                  <tr key={s.id} className="border-b border-[#1f1f1f] hover:bg-[#161616] transition-colors group">
                    <td className="p-5"><p className="font-bold text-white">{s.nome}</p><p className="text-xs text-gray-500">{s.tempo}</p></td>
                    <td className="p-5 text-center"><span className="bg-red-600/10 text-red-500 px-3 py-1 rounded-full text-xs font-black border border-red-600/20">{s.preco}</span></td>
                    <td className="p-5 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setForm(s)} className="p-2 bg-[#222] rounded-lg hover:bg-white hover:text-black">✏️</button>
                      <button onClick={async () => { if(confirm("Apagar?")) { await deleteDoc(doc(db, "servicos", s.id)); aoMudar(); } }} className="p-2 bg-[#222] rounded-lg hover:bg-red-600">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULÁRIO */}
        <div className="bg-[#111111] p-8 rounded-3xl border border-[#1f1f1f] h-fit sticky top-10 shadow-2xl">
          <h2 className="text-xl font-black mb-6 uppercase italic text-red-600">{form.id ? 'Editar Item' : 'Novo Serviço'}</h2>
          <form onSubmit={salvarServico} className="space-y-4">
            <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Degradê" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            <input value={form.preco} onChange={e => setForm({...form, preco: e.target.value})} placeholder="R$ 00" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            <input value={form.tempo} onChange={e => setForm({...form, tempo: e.target.value})} placeholder="40min" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 uppercase tracking-widest">{form.id ? 'Salvar Mudanças' : 'Publicar no Site'}</button>
            {form.id && <button type="button" onClick={() => setForm({id:null, nome:'', preco:'', tempo:''})} className="w-full text-gray-500 text-xs font-bold mt-2 hover:text-white">Cancelar Edição</button>}
          </form>
        </div>
      </div>
    </div>
  )
}