import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, updateDoc, setDoc, query, where, deleteDoc, writeBatch } from 'firebase/firestore'

export default function AdminClientes() {
  const [clientes, setClientes] = useState([])
  const [planos, setPlanos] = useState([])
  const [salvando, setSalvando] = useState(false)
  
  // ESTADO DA BUSCA
  const [termoBusca, setTermoBusca] = useState('')
  
  // ESTADOS DO MODAL DE EDIÇÃO/CRIAÇÃO
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState({ telefoneAntigo: null, nome: '', telefone: '', planoId: '', cortesRestantes: 0 })

  // ESTADOS DO MODAL DE HISTÓRICO
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)
  const [clienteAtual, setClienteAtual] = useState(null)
  const [historico, setHistorico] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

  const carregarDados = async () => {
    const snapPlanos = await getDocs(collection(db, "planos"))
    const listaPlanos = snapPlanos.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status === 'Ativo')
    setPlanos(listaPlanos)

    const snapAgendamentos = await getDocs(collection(db, "agendamentos"))
    const statsAgendamentos = {}
    
    snapAgendamentos.docs.forEach(d => {
      const tel = d.data().clienteTelefone
      const dataVisita = d.data().data 
      
      if (!statsAgendamentos[tel]) {
        statsAgendamentos[tel] = { total: 0, primeiraVisita: dataVisita }
      }
      
      statsAgendamentos[tel].total += 1
      if (dataVisita && dataVisita < statsAgendamentos[tel].primeiraVisita) {
        statsAgendamentos[tel].primeiraVisita = dataVisita
      }
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
        totalAtendimentos: statsAgendamentos[tel]?.total || 0,
        primeiraVisita: statsAgendamentos[tel]?.primeiraVisita || null,
        planoId: mapaClientes[tel].planoId || '',
        planoNome: mapaClientes[tel].planoNome || '',
        cortesRestantes: mapaClientes[tel].cortesRestantes || 0
      })
    }

    for (const tel in statsAgendamentos) {
      if (!mapaClientes[tel]) {
        const agendamentoDesseCliente = snapAgendamentos.docs.find(d => d.data().clienteTelefone === tel)
        if(agendamentoDesseCliente) {
          listaFinal.push({
            telefone: tel,
            nome: agendamentoDesseCliente.data().clienteNome,
            totalAtendimentos: statsAgendamentos[tel].total,
            primeiraVisita: statsAgendamentos[tel].primeiraVisita,
            planoId: '',
            planoNome: '',
            cortesRestantes: 0
          })
        }
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

  const abrirModalNovo = () => {
    setForm({ telefoneAntigo: null, nome: '', telefone: '', planoId: '', cortesRestantes: 0 })
    setModalAberto(true)
  }

  const abrirModalEditar = (cliente) => {
    setForm({
      telefoneAntigo: cliente.telefone,
      nome: cliente.nome,
      telefone: cliente.telefone,
      planoId: cliente.planoId || '',
      cortesRestantes: cliente.cortesRestantes || 0
    })
    setModalAberto(true)
  }

  const verHistorico = async (cliente) => {
    setClienteAtual(cliente)
    setModalHistoricoAberto(true)
    setCarregandoHistorico(true)
    try {
      const q = query(collection(db, "agendamentos"), where("clienteTelefone", "==", cliente.telefone))
      const snap = await getDocs(q)
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => new Date(b.data) - new Date(a.data) || b.hora.localeCompare(a.hora))
      setHistorico(lista)
    } catch (error) {
      alert("Erro ao carregar histórico.")
    }
    setCarregandoHistorico(false)
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome || !form.telefone) return
    setSalvando(true)
    
    try {
      let planoNome = ''
      if (form.planoId) {
        const planoEscolhido = planos.find(p => p.id === form.planoId)
        planoNome = planoEscolhido.nome
      }

      await setDoc(doc(db, "clientes", form.telefone), {
        nome: form.nome,
        telefone: form.telefone,
        planoId: form.planoId,
        planoNome: planoNome,
        cortesRestantes: form.cortesRestantes
      }, { merge: true })

      if (form.telefoneAntigo && form.telefone !== form.telefoneAntigo) {
        const q = query(collection(db, "agendamentos"), where("clienteTelefone", "==", form.telefoneAntigo))
        const snap = await getDocs(q)
        const promessas = snap.docs.map(d => updateDoc(doc(db, "agendamentos", d.id), { clienteNome: form.nome, clienteTelefone: form.telefone }))
        await Promise.all(promessas)
        await deleteDoc(doc(db, "clientes", form.telefoneAntigo))
      }

      setModalAberto(false)
      carregarDados()
    } catch (erro) {
      console.error(erro)
      alert("Erro ao salvar cliente.")
    }
    setSalvando(false)
  }

  const aoMudarPlano = (e) => {
    const idEscolhido = e.target.value
    if (!idEscolhido) {
      setForm({ ...form, planoId: '', cortesRestantes: 0 })
      return
    }
    const planoEncontrado = planos.find(p => p.id === idEscolhido)
    setForm({ ...form, planoId: idEscolhido, cortesRestantes: Number(planoEncontrado.cortes) })
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
  
  const formatarDataBR = (dataString) => {
    if (!dataString) return 'Sem visitas'
    const [ano, mes, dia] = dataString.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const clientesFiltrados = clientes.filter(c => 
    c.nome.toLowerCase().includes(termoBusca.toLowerCase()) || 
    c.telefone.includes(termoBusca)
  )

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--cor-texto-principal)]">
          Base de <span className="text-[var(--cor-primaria)]">Clientes</span>
        </h1>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          {/* BARRA DE BUSCA */}
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--cor-texto-secundario)]"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full bg-[var(--cor-card)] border border-[var(--cor-borda)] pl-10 pr-4 py-3 rounded-xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] font-bold transition-all shadow-lg"
            />
          </div>

          <button 
            onClick={abrirModalNovo} 
            className="bg-[var(--cor-primaria)] hover:opacity-90 text-[var(--cor-texto-principal)] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-[var(--cor-primaria)]/20 whitespace-nowrap"
          >
            + Novo Cliente
          </button>
        </div>
      </div>
      
      {/* TABELA */}
      <div className="bg-[var(--cor-card)] rounded-3xl border border-[var(--cor-borda)] overflow-hidden shadow-2xl w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[var(--cor-bg-geral)] border-b border-[var(--cor-borda)]">
              <th className="p-5 text-xs text-[var(--cor-texto-secundario)] uppercase font-black">Cliente</th>
              <th className="p-5 text-xs text-[var(--cor-texto-secundario)] uppercase font-black text-center">Plano Ativo</th>
              <th className="p-5 text-xs text-[var(--cor-texto-secundario)] uppercase font-black text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan="3" className="p-10 text-center text-[var(--cor-texto-secundario)] font-bold uppercase italic">
                  {termoBusca ? `Nenhum cliente encontrado para "${termoBusca}".` : "Nenhum cliente cadastrado."}
                </td>
              </tr>
            )}
            {clientesFiltrados.map((c, i) => (
              <tr key={i} className="border-b border-[var(--cor-borda)] hover:bg-[var(--cor-bg-geral)] transition-colors group text-[var(--cor-texto-principal)]">
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-lg uppercase tracking-tighter">{c.nome}</p>
                    {c.totalAtendimentos >= 3 && <span className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-widest border border-yellow-500/30">VIP</span>}
                  </div>
                  <p className="text-xs text-[var(--cor-texto-secundario)] mt-1 font-bold">
                    {c.telefone} <span className="mx-2">•</span> {c.totalAtendimentos} visitas <span className="mx-2">•</span> Cliente desde: <span className="opacity-70">{formatarDataBR(c.primeiraVisita)}</span>
                  </p>
                </td>
                
                <td className="p-5 text-center">
                  {c.planoId ? (
                    <div className="flex flex-col items-center">
                      <span className="bg-[var(--cor-primaria)]/20 text-[var(--cor-primaria)] text-[10px] px-3 py-1 rounded-t-lg font-black uppercase border border-[var(--cor-primaria)]/30 border-b-0 w-28 truncate">
                        {c.planoNome}
                      </span>
                      <button 
                        onClick={() => debitarCorte(c)}
                        className={`text-xs px-3 py-1 rounded-b-lg font-black uppercase border border-[var(--cor-primaria)]/30 w-28 transition-colors ${c.cortesRestantes > 0 ? 'bg-[var(--cor-primaria)] text-[var(--cor-texto-principal)] hover:opacity-80' : 'bg-[var(--cor-bg-geral)] text-[var(--cor-texto-secundario)]'}`}
                        title="Clique para debitar 1 corte"
                      >
                        {c.cortesRestantes} Cortes
                      </button>
                    </div>
                  ) : (
                    <span className="text-[var(--cor-texto-secundario)] text-xs font-bold uppercase italic">- Avulso -</span>
                  )}
                </td>
                
                <td className="p-5 text-right space-x-2 flex justify-end">
                  <a href={formatarWhatsApp(c.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-2 bg-[var(--cor-bg-geral)] rounded-lg hover:bg-green-600 text-[var(--cor-texto-principal)] transition-all w-10 h-10" title="Chamar no Zap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  </a>
                  
                  <button onClick={() => verHistorico(c)} className="inline-flex items-center justify-center p-2 bg-[var(--cor-bg-geral)] rounded-lg hover:bg-blue-600 text-[var(--cor-texto-principal)] transition-all w-10 h-10 ml-2" title="Ver Histórico">
                    📋
                  </button>

                  <button onClick={() => abrirModalEditar(c)} className="inline-flex items-center justify-center p-2 bg-[var(--cor-bg-geral)] rounded-lg hover:opacity-80 transition-all w-10 h-10 ml-2 border border-[var(--cor-borda)] hover:border-[var(--cor-texto-principal)]" title="Editar">
                    ✏️
                  </button>
                  <button onClick={() => excluirCliente(c)} className="inline-flex items-center justify-center p-2 bg-[var(--cor-bg-geral)] rounded-lg hover:bg-[var(--cor-primaria)] text-[var(--cor-texto-principal)] transition-all w-10 h-10 ml-2" title="Excluir">
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL CRIAR/EDITAR */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[var(--cor-card)] border border-[var(--cor-borda)] p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
            
            <button onClick={() => setModalAberto(false)} className="absolute top-6 right-6 text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <h2 className="text-2xl font-black mb-6 uppercase italic text-[var(--cor-texto-principal)]">
              {form.telefoneAntigo ? '✏️ Editar Cliente' : '+ Novo Cliente'}
            </h2>
            
            <form onSubmit={salvar} className="space-y-4">
              <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do Cliente" className="w-full bg-[var(--cor-bg-geral)] border border-[var(--cor-borda)] p-4 rounded-2xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] font-bold" />
              <input required value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="WhatsApp (53999999999)" className="w-full bg-[var(--cor-bg-geral)] border border-[var(--cor-borda)] p-4 rounded-2xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] font-bold" />

              <div className="p-5 bg-[var(--cor-bg-geral)] border border-[var(--cor-borda)] rounded-2xl mt-4">
                <label className="text-[10px] text-[var(--cor-texto-secundario)] uppercase font-black tracking-widest">Plano / Assinatura</label>
                
                <select value={form.planoId} onChange={aoMudarPlano} className="w-full bg-[var(--cor-card)] border border-[var(--cor-borda)] p-4 rounded-xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] font-bold mt-3">
                  <option value="">Sem plano (Avulso)</option>
                  {planos.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.cortes} cortes)</option>
                  ))}
                </select>

                {form.planoId && (
                  <div className="mt-4 flex items-center justify-between bg-[var(--cor-card)] p-3 rounded-xl border border-[var(--cor-borda)]">
                    <label className="text-xs text-[var(--cor-primaria)] uppercase font-black">Créditos:</label>
                    <input type="number" value={form.cortesRestantes} onChange={e => setForm({...form, cortesRestantes: Number(e.target.value)})} className="w-16 bg-transparent text-right font-black text-[var(--cor-texto-principal)] outline-none text-xl" />
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button type="submit" disabled={salvando} className="w-full bg-[var(--cor-primaria)] text-[var(--cor-texto-principal)] font-black py-4 rounded-2xl hover:opacity-90 uppercase tracking-widest disabled:opacity-50 transition-colors shadow-lg shadow-[var(--cor-primaria)]/20">
                  {salvando ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO */}
      {modalHistoricoAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[var(--cor-card)] border border-[var(--cor-borda)] p-8 rounded-3xl w-full max-w-lg shadow-2xl relative max-h-[85vh] flex flex-col">
            
            <button onClick={() => setModalHistoricoAberto(false)} className="absolute top-6 right-6 text-[var(--cor-texto-secundario)] hover:text-[var(--cor-texto-principal)] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="mb-6 pr-8">
              <h2 className="text-2xl font-black uppercase italic text-[var(--cor-texto-principal)] leading-none">
                Histórico de <span className="text-[var(--cor-primaria)]">{clienteAtual?.nome}</span>
              </h2>
              <p className="text-[var(--cor-texto-secundario)] text-xs font-bold mt-2">📱 {clienteAtual?.telefone}</p>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-3 flex-1 custom-scrollbar">
              {carregandoHistorico ? (
                <div className="text-center py-10">
                  <p className="text-[var(--cor-texto-secundario)] font-black uppercase tracking-widest animate-pulse text-xs">Buscando...</p>
                </div>
              ) : historico.length === 0 ? (
                <div className="text-center py-10 bg-[var(--cor-bg-geral)] rounded-2xl border border-[var(--cor-borda)]">
                  <p className="text-[var(--cor-texto-secundario)] font-bold text-sm">Nenhum agendamento encontrado.</p>
                </div>
              ) : (
                historico.map(ag => {
                  const isPendente = ag.status !== 'Concluído' && ag.status !== 'Cancelado'
                  return (
                    <div key={ag.id} className={`p-5 rounded-2xl border transition-all flex justify-between items-center gap-4 ${!isPendente ? 'bg-[var(--cor-bg-geral)] border-[var(--cor-borda)] opacity-60' : 'bg-[var(--cor-card)] border-[var(--cor-borda)] border-l-4 border-l-[var(--cor-primaria)]'}`}>
                      <div>
                        <p className="text-[var(--cor-texto-principal)] font-black uppercase italic text-lg">{ag.servico}</p>
                        <p className="text-xs text-[var(--cor-texto-secundario)] mt-1 font-bold">
                          {formatarDataBR(ag.data)} às {ag.hora}
                        </p>
                        <p className="text-[10px] text-[var(--cor-texto-secundario)] uppercase mt-1">Com {ag.barbeiro}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${isPendente ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : ag.status === 'Cancelado' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                          {ag.status || 'Pendente'}
                        </span>
                        <p className="text-[10px] font-black text-[var(--cor-texto-secundario)] mt-2">{ag.preco}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}