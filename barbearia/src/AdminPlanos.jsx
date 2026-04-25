import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'

export default function AdminPlanos() {
  const [planos, setPlanos] = useState([])
  const [servicosDisponiveis, setServicosDisponiveis] = useState([])
  
  // Adicionado o array de "combos" no estado do formulário
  const [form, setForm] = useState({ id: null, nome: '', valor: '', cortes: '', status: 'Ativo', servicosInclusos: [], combos: [] })
  
  // Estado temporário para digitar o combo na hora
  const [novoCombo, setNovoCombo] = useState({ nome: '', tempo: '' })

  const carregar = async () => {
    const snapPlanos = await getDocs(collection(db, "planos"))
    setPlanos(snapPlanos.docs.map(d => ({ id: d.id, ...d.data() })))

    const snapServicos = await getDocs(collection(db, "servicos"))
    setServicosDisponiveis(snapServicos.docs.map(d => d.data().nome))
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome || !form.valor) return

    const dadosPlanos = {
      nome: form.nome,
      valor: form.valor,
      cortes: form.cortes,
      status: form.status,
      servicosInclusos: form.servicosInclusos,
      combos: form.combos // Salva os combos exclusivos criados
    }

    if (form.id) {
      await updateDoc(doc(db, "planos", form.id), dadosPlanos)
    } else {
      await addDoc(collection(db, "planos"), dadosPlanos)
    }

    setForm({ id: null, nome: '', valor: '', cortes: '', status: 'Ativo', servicosInclusos: [], combos: [] })
    carregar()
  }

  const alternarStatus = async (plano) => {
    const novoStatus = plano.status === 'Ativo' ? 'Inativo' : 'Ativo'
    await updateDoc(doc(db, "planos", plano.id), { status: novoStatus })
    carregar()
  }

  const toggleServico = (nome) => {
    if (form.servicosInclusos.includes(nome)) {
      setForm({ ...form, servicosInclusos: form.servicosInclusos.filter(s => s !== nome) })
    } else {
      setForm({ ...form, servicosInclusos: [...form.servicosInclusos, nome] })
    }
  }

  // Função para adicionar o combo na lista do plano
  const adicionarCombo = () => {
    if (novoCombo.nome && novoCombo.tempo) {
      setForm({ ...form, combos: [...form.combos, novoCombo] })
      setNovoCombo({ nome: '', tempo: '' }) // Limpa os campos após adicionar
    }
  }

  const removerCombo = (index) => {
    const novaLista = form.combos.filter((_, i) => i !== index)
    setForm({ ...form, combos: novaLista })
  }

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10 text-white">
        Gestão de <span className="text-red-600">Planos</span>
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LISTA DE PLANOS */}
        <div className="lg:col-span-2 space-y-4">
          {planos.map(p => (
            <div key={p.id} className={`bg-[#111111] p-6 rounded-3xl border ${p.status === 'Ativo' ? 'border-[#1f1f1f]' : 'border-red-900/20 opacity-50'} flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all`}>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-black text-2xl uppercase tracking-tighter text-white">{p.nome}</p>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase ${p.status === 'Ativo' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm text-red-500 font-bold mt-1">R$ {p.valor} <span className="text-gray-500 font-normal">/ mês</span></p>
                <p className="text-xs text-gray-400 mt-2 italic border-b border-[#1f1f1f] pb-2">Limite de {p.cortes} agendamentos</p>
                
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.servicosInclusos || []).length > 0 && p.servicosInclusos.map(s => <span key={s} className="bg-[#1c1c1c] text-gray-300 text-[10px] px-2 py-1 rounded-md uppercase font-bold">{s}</span>)}
                  {/* Mostra os combos na vitrine também */}
                  {(p.combos || []).length > 0 && p.combos.map((c, idx) => <span key={'c'+idx} className="bg-red-600/20 text-red-500 border border-red-600/30 text-[10px] px-2 py-1 rounded-md uppercase font-black">⭐ {c.nome}</span>)}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => alternarStatus(p)} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-yellow-600 transition-all" title="Inativar/Ativar">👁️</button>
                <button onClick={() => setForm(p)} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-white hover:text-black transition-all">✏️</button>
                <button onClick={async () => { if(confirm("Apagar plano?")) { await deleteDoc(doc(db, "planos", p.id)); carregar(); } }} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-red-600 transition-all">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* FORMULÁRIO */}
        <div className="bg-[#111111] p-8 rounded-3xl border border-[#1f1f1f] h-fit sticky top-10 shadow-2xl">
          <h2 className="text-xl font-black mb-6 uppercase italic text-red-600">{form.id ? 'Editar Plano' : 'Criar Novo Plano'}</h2>
          <form onSubmit={salvar} className="space-y-4">
            <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do Plano" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            
            <div className="grid grid-cols-2 gap-4">
              <input value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} placeholder="Valor (Ex: 80)" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              <input value={form.cortes} onChange={e => setForm({...form, cortes: e.target.value})} placeholder="Qtd Cortes" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
            </div>

            {/* SELEÇÃO DE SERVIÇOS AVULSOS */}
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl">
              <p className="text-[10px] text-gray-500 uppercase font-black mb-3">Serviços Base Cobertos:</p>
              <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 mb-2">
                {servicosDisponiveis.map(s => (
                  <label key={s} className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={form.servicosInclusos.includes(s)} onChange={() => toggleServico(s)} className="w-4 h-4 accent-red-600" />
                    <span className={`text-sm font-bold uppercase transition-colors ${form.servicosInclusos.includes(s) ? 'text-white' : 'text-gray-600 group-hover:text-gray-400'}`}>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* CRIAÇÃO DE COMBOS NA HORA */}
            <div className="bg-red-600/5 border border-red-600/20 p-4 rounded-2xl">
              <p className="text-[10px] text-red-500 uppercase font-black mb-3">Combos Exclusivos (Ocultos para não-assinantes):</p>
              
              <div className="flex gap-2 mb-3">
                <input value={novoCombo.nome} onChange={e => setNovoCombo({...novoCombo, nome: e.target.value})} placeholder="Ex: Corte Máquina + Sobrancelha" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-3 rounded-xl text-white outline-none focus:border-red-600 text-xs" />
                <input value={novoCombo.tempo} onChange={e => setNovoCombo({...novoCombo, tempo: e.target.value})} placeholder="Tempo" className="w-20 bg-[#0a0a0a] border border-[#1f1f1f] p-3 rounded-xl text-white outline-none focus:border-red-600 text-xs" />
                <button type="button" onClick={adicionarCombo} className="bg-red-600 text-white font-black px-4 rounded-xl hover:bg-red-700">+</button>
              </div>

              {form.combos && form.combos.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-red-600/20">
                  {form.combos.map((c, index) => (
                    <div key={index} className="flex justify-between items-center bg-[#0a0a0a] border border-[#1f1f1f] p-2 px-3 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-white uppercase">{c.nome}</p>
                        <p className="text-[10px] text-gray-500">{c.tempo}</p>
                      </div>
                      <button type="button" onClick={() => removerCombo(index)} className="text-red-600 hover:text-red-400 text-xs font-black">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 uppercase tracking-widest mt-4 transition-all">
              {form.id ? 'Salvar Mudanças' : 'Lançar Plano'}
            </button>
            {form.id && <button type="button" onClick={() => setForm({id:null, nome:'', valor:'', cortes:'', status:'Ativo', servicosInclusos: [], combos: []})} className="w-full text-gray-500 text-xs font-bold mt-2 hover:text-white">Cancelar Edição</button>}
          </form>
        </div>
      </div>
    </div>
  )
}