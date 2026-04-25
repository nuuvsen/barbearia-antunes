import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, updateDoc, setDoc, query, where, deleteDoc, writeBatch } from 'firebase/firestore'

export default function AdminClientes() {
  const [clientes, setClientes] = useState([])
  const [planos, setPlanos] = useState([])
  const [form, setForm] = useState({ telefoneAntigo: null, nome: '', telefone: '', planoId: '', cortesRestantes: 0 })
  const [salvando, setSalvando] = useState(false)

  const carregarDados = async () => {
    const snapPlanos = await getDocs(collection(db, "planos"))
    const listaPlanos = snapPlanos.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status === 'Ativo')
    setPlanos(listaPlanos)

    const snapAgendamentos = await getDocs(collection(db, "agendamentos"))
    const mapaAgendamentos = {}
    snapAgendamentos.docs.forEach(d => {
      const tel = d.data().clienteTelefone
      if (!mapaAgendamentos[tel]) mapaAgendamentos[tel] = 0
      mapaAgendamentos[tel] += 1
    })

    const snapClientes = await getDocs(collection(db, "clientes"))
    const mapaClientes = {}
    snapClientes.docs.forEach(d => {
      mapaClientes[d.id] = d.data() 
    })

    const listaFinal = []
    
    for (const tel in mapaClientes) {
      listaFinal.push({
        telefone: tel,
        nome: mapaClientes[tel].nome,
        totalAtendimentos: mapaAgendamentos[tel] || 0,
        planoId: mapaClientes[tel].planoId || '',
        planoNome: mapaClientes[tel].planoNome || '',
        cortesRestantes: mapaClientes[tel].cortesRestantes || 0
      })
    }

    for (const tel in mapaAgendamentos) {
      if (!mapaClientes[tel]) {
        const agendamentoDesseCliente = snapAgendamentos.docs.find(d => d.data().clienteTelefone === tel)
        listaFinal.push({
          telefone: tel,
          nome: agendamentoDesseCliente.data().clienteNome,
          totalAtendimentos: mapaAgendamentos[tel],
          planoId: '',
          planoNome: '',
          cortesRestantes: 0
        })
      }
    }

    listaFinal.sort((a, b) => b.totalAtendimentos - a.totalAtendimentos)
    setClientes(listaFinal)
  }

  useEffect(() => { carregarDados() }, [])

  const excluirCliente = async (cliente) => {
    const confirmar = window.confirm(`ATENÇÃO: Deseja deletar permanentemente o cliente ${cliente.nome}? Isso apagará todo o histórico de agendamentos e o plano ativo.`)
    
    if (confirmar) {
      try {
        await deleteDoc(doc(db, "clientes", cliente.telefone))
        const q = query(collection(db, "agendamentos"), where("clienteTelefone", "==", cliente.telefone))
        const snap = await getDocs(q)
        
        const batch = writeBatch(db)
        snap.docs.forEach((d) => {
          batch.delete(d.ref)
        })
        await batch.commit()

        alert("Cliente removido com sucesso!")
        carregarDados() 
      } catch (erro) {
        console.error("Erro ao deletar:", erro)
        alert("Erro ao remover cliente.")
      }
    }
  }

  const editar = (cliente) => {
    setForm({
      telefoneAntigo: cliente.telefone,
      nome: cliente.nome,
      telefone: cliente.telefone,
      planoId: cliente.planoId || '',
      cortesRestantes: cliente.cortesRestantes || 0
    })
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome || !form.telefone) return
    setSalvando(true)
    
    try {
      let planoNome = ''
      
      // Busca apenas o nome do plano (os créditos já foram setados no onChange do select)
      if (form.planoId) {
        const planoEscolhido = planos.find(p => p.id === form.planoId)
        planoNome = planoEscolhido.nome
      }

      await setDoc(doc(db, "clientes", form.telefone), {
        nome: form.nome,
        telefone: form.telefone,
        planoId: form.planoId,
        planoNome: planoNome,
        cortesRestantes: form.cortesRestantes // Usa o valor que está no formulário
      }, { merge: true })

      if (form.telefone !== form.telefoneAntigo) {
        const q = query(collection(db, "agendamentos"), where("clienteTelefone", "==", form.telefoneAntigo))
        const snap = await getDocs(q)
        const promessas = snap.docs.map(d => updateDoc(doc(db, "agendamentos", d.id), { clienteNome: form.nome, clienteTelefone: form.telefone }))
        await Promise.all(promessas)
      }

      setForm({ telefoneAntigo: null, nome: '', telefone: '', planoId: '', cortesRestantes: 0 })
      carregarDados()
    } catch (erro) {
      console.error(erro)
      alert("Erro ao salvar cliente.")
    }
    setSalvando(false)
  }

  // ==========================================
  // NOVA INTELIGÊNCIA: Selecionar Plano e Autopreencher Créditos
  // ==========================================
  const aoMudarPlano = (e) => {
    const idEscolhido = e.target.value
    if (!idEscolhido) {
      // Se ele selecionou "Sem plano (Avulso)", zera tudo
      setForm({ ...form, planoId: '', cortesRestantes: 0 })
      return
    }

    // Acha o plano na lista para saber quantos cortes ele dá direito
    const planoEncontrado = planos.find(p => p.id === idEscolhido)
    
    setForm({ 
      ...form, 
      planoId: idEscolhido, 
      cortesRestantes: Number(planoEncontrado.cortes) // Autopreenchimento Mágico!
    })
  }

  const debitarCorte = async (cliente) => {
    if (cliente.cortesRestantes > 0) {
      if (window.confirm(`Debitar 1 corte do plano de ${cliente.nome}? (Restam ${cliente.cortesRestantes})`)) {
        await updateDoc(doc(db, "clientes", cliente.telefone), {
          cortesRestantes: cliente.cortesRestantes - 1
        })
        carregarDados()
      }
    } else {
      alert("Este cliente não tem mais créditos neste plano!")
    }
  }

  const formatarWhatsApp = (numero) => `https://wa.me/55${numero.replace(/\D/g, '')}`

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10">Base de <span className="text-red-600">Clientes</span></h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#111111] rounded-3xl border border-[#1f1f1f] overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#161616] border-b border-[#1f1f1f]">
                  <th className="p-5 text-xs text-gray-500 uppercase font-black">Cliente</th>
                  <th className="p-5 text-xs text-gray-500 uppercase font-black text-center">Plano Ativo</th>
                  <th className="p-5 text-xs text-gray-500 uppercase font-black text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c, i) => (
                  <tr key={i} className="border-b border-[#1f1f1f] hover:bg-[#161616] transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-white text-lg uppercase tracking-tighter">{c.nome}</p>
                        {c.totalAtendimentos >= 3 && <span className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-widest border border-yellow-500/30">VIP</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{c.telefone} • {c.totalAtendimentos} visitas</p>
                    </td>
                    
                    <td className="p-5 text-center">
                      {c.planoId ? (
                        <div className="flex flex-col items-center">
                          <span className="bg-red-600/20 text-red-500 text-xs px-3 py-1 rounded-t-lg font-black uppercase border border-red-600/30 border-b-0 w-24 truncate">
                            {c.planoNome}
                          </span>
                          <button 
                            onClick={() => debitarCorte(c)}
                            className={`text-xs px-3 py-1 rounded-b-lg font-black uppercase border border-red-600/30 w-24 transition-colors ${c.cortesRestantes > 0 ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-[#1c1c1c] text-gray-500'}`}
                            title="Clique para debitar 1 corte"
                          >
                            {c.cortesRestantes} Cortes
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs font-bold uppercase italic">- Avulso -</span>
                      )}
                    </td>
                    
                    <td className="p-5 text-right space-x-2 flex justify-end">
                      <a href={formatarWhatsApp(c.telefone)} target="_blank" rel="noreferrer" className="inline-block p-2 bg-[#222] rounded-lg hover:bg-green-600 text-white transition-all" title="Chamar no Zap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      </a>
                      <button onClick={() => editar(c)} className="p-2 bg-[#222] rounded-lg hover:bg-white hover:text-black transition-all">✏️</button>
                      <button onClick={() => excluirCliente(c)} className="p-2 bg-[#222] rounded-lg hover:bg-red-600 text-white transition-all ml-2" title="Excluir Cliente Permanentemente">
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#111111] p-8 rounded-3xl border border-[#1f1f1f] h-fit sticky top-10 shadow-2xl">
          <h2 className="text-xl font-black mb-6 uppercase italic text-red-600">
            {form.telefoneAntigo ? '✏️ Editar / Assinar Plano' : 'Selecione um cliente'}
          </h2>
          
          {form.telefoneAntigo ? (
            <form onSubmit={salvar} className="space-y-4">
              <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              <input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="WhatsApp" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />

              <div className="p-4 bg-red-600/10 border border-red-600/20 rounded-2xl mt-4">
                <label className="text-[10px] text-red-500 uppercase font-black">Vincular Assinatura</label>
                
                {/* Aqui está o pulo do gato: chamamos a nova função aoMudarPlano */}
                <select 
                  value={form.planoId} 
                  onChange={aoMudarPlano} 
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-xl text-white outline-none focus:border-red-600 mt-2"
                >
                  <option value="">Sem plano (Avulso)</option>
                  {planos.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.cortes} cortes)</option>
                  ))}
                </select>

                {form.planoId && (
                  <div className="mt-4 flex items-center justify-between">
                    <label className="text-[10px] text-gray-500 uppercase font-black">Créditos Restantes:</label>
                    <input 
                      type="number" 
                      value={form.cortesRestantes} 
                      onChange={e => setForm({...form, cortesRestantes: Number(e.target.value)})}
                      className="w-20 bg-[#0a0a0a] border border-[#1f1f1f] p-2 rounded-lg text-center font-bold text-white outline-none focus:border-red-600"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button type="submit" disabled={salvando} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 uppercase tracking-widest disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar Cliente'}
                </button>
                <button type="button" onClick={() => setForm({telefoneAntigo: null, nome: '', telefone: '', planoId: '', cortesRestantes: 0})} className="w-full text-gray-500 text-xs font-bold mt-4 hover:text-white transition-colors">
                  Cancelar Edição
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-[#1f1f1f] rounded-2xl">
              <p className="text-gray-500 text-sm">Clique no ícone ✏️ na tabela para cadastrar o plano de um cliente.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}