import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore'

export default function AdminPlanos() {
  const [planos, setPlanos] = useState([])
  const [servicosDisponiveis, setServicosDisponiveis] = useState([])
  const [carregando, setCarregando] = useState(true) // Estado para evitar o flash
  
  // Inicializa tentando pegar do localStorage (Síncrono - resolve o flash)
  const [cores, setCores] = useState(() => {
    const salvo = localStorage.getItem('tema_customizado')
    return salvo ? JSON.parse(salvo) : {
      primaria: '#922020',
      fundo: '#bababa',
      card: '#ffffff',
      texto: '#171717',
      textoSecundario: '#2e2e2e',
      borda: '#000000'
    }
  })

  const [form, setForm] = useState({ 
    id: null, 
    nome: '', 
    valor: '', 
    cortes: '', 
    status: 'Ativo', 
    servicosInclusos: [], 
    combos: [] 
  })
  
  const [novoCombo, setNovoCombo] = useState({ nome: '', tempo: '' })

  const carregarDados = async () => {
    try {
      // 1. Busca a personalização primeiro para garantir as cores
      const docConfig = await getDoc(doc(db, "configuracoes", "personalizacao"))
      if (docConfig.exists() && docConfig.data().cores) {
        const novasCores = docConfig.data().cores;
        setCores(novasCores);
        // Atualiza o cache local para a próxima visita ser instantânea
        localStorage.setItem('tema_customizado', JSON.stringify(novasCores));
      }

      // 2. Busca o restante dos dados
      const [snapPlanos, snapServicos] = await Promise.all([
        getDocs(collection(db, "planos")),
        getDocs(collection(db, "servicos"))
      ]);

      setPlanos(snapPlanos.docs.map(d => ({ id: d.id, ...d.data() })))
      setServicosDisponiveis(snapServicos.docs.map(d => d.data().nome))
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false); // Libera a tela após carregar tudo
    }
  }

  useEffect(() => { carregarDados() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome || !form.valor) return

    const dadosPlanos = {
      nome: form.nome,
      valor: form.valor,
      cortes: form.cortes,
      status: form.status,
      servicosInclusos: form.servicosInclusos,
      combos: form.combos 
    }

    if (form.id) {
      await updateDoc(doc(db, "planos", form.id), dadosPlanos)
    } else {
      await addDoc(collection(db, "planos"), dadosPlanos)
    }

    setForm({ id: null, nome: '', valor: '', cortes: '', status: 'Ativo', servicosInclusos: [], combos: [] })
    carregarDados()
  }

  const alternarStatus = async (plano) => {
    const novoStatus = plano.status === 'Ativo' ? 'Inativo' : 'Ativo'
    await updateDoc(doc(db, "planos", plano.id), { status: novoStatus })
    carregarDados()
  }

  const toggleServico = (nome) => {
    if (form.servicosInclusos.includes(nome)) {
      setForm({ ...form, servicosInclusos: form.servicosInclusos.filter(s => s !== nome) })
    } else {
      setForm({ ...form, servicosInclusos: [...form.servicosInclusos, nome] })
    }
  }

  const adicionarCombo = () => {
    if (novoCombo.nome && novoCombo.tempo) {
      setForm({ ...form, combos: [...form.combos, novoCombo] })
      setNovoCombo({ nome: '', tempo: '' })
    }
  }

  const removerCombo = (index) => {
    const novaLista = form.combos.filter((_, i) => i !== index)
    setForm({ ...form, combos: novaLista })
  }

  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Enquanto estiver carregando os dados do Firebase pela primeira vez, 
  // mostramos uma tela vazia ou um loader com a cor de fundo já aplicada
  if (carregando) {
    return <div className="min-h-screen w-full" style={{ backgroundColor: cores.fundo }} />;
  }

  return (
    <div className="animate-in fade-in duration-500 min-h-screen p-4 md:p-10" style={{ backgroundColor: cores.fundo }}>
      <h1 
        className="text-4xl font-black uppercase italic tracking-tighter mb-10"
        style={{ color: cores.texto }}
      >
        Gestão de <span style={{ color: cores.primaria }}>Planos</span>
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LISTA DE PLANOS */}
        <div className="lg:col-span-2 space-y-4">
          {planos.map(p => (
            <div 
              key={p.id} 
              className="p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all"
              style={{ 
                backgroundColor: cores.card, 
                borderColor: p.status === 'Ativo' ? cores.borda : hexToRgba(cores.borda, 0.2),
                opacity: p.status === 'Ativo' ? 1 : 0.6
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-black text-2xl uppercase tracking-tighter" style={{ color: cores.texto }}>{p.nome}</p>
                  <span 
                    className="text-[10px] px-2 py-1 rounded-full font-black uppercase text-white"
                    style={{ backgroundColor: p.status === 'Ativo' ? '#16a34a' : cores.primaria }}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="text-sm font-bold mt-1" style={{ color: cores.primaria }}>
                  R$ {p.valor} <span className="font-normal" style={{ color: cores.textoSecundario }}>/ mês</span>
                </p>
                <p 
                  className="text-xs mt-2 italic border-b pb-2" 
                  style={{ color: cores.textoSecundario, borderColor: hexToRgba(cores.borda, 0.1) }}
                >
                  Limite de {p.cortes} agendamentos
                </p>
                
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.servicosInclusos || []).length > 0 && p.servicosInclusos.map(s => (
                    <span 
                      key={s} 
                      className="text-[10px] px-2 py-1 rounded-md uppercase font-bold"
                      style={{ backgroundColor: hexToRgba(cores.borda, 0.05), color: cores.textoSecundario }}
                    >
                      {s}
                    </span>
                  ))}
                  {(p.combos || []).length > 0 && p.combos.map((c, idx) => (
                    <span 
                      key={'c'+idx} 
                      className="border text-[10px] px-2 py-1 rounded-md uppercase font-black"
                      style={{ 
                        backgroundColor: hexToRgba(cores.primaria, 0.1), 
                        color: cores.primaria, 
                        borderColor: hexToRgba(cores.primaria, 0.2) 
                      }}
                    >
                      ⭐ {c.nome}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => alternarStatus(p)} className="p-3 rounded-xl hover:opacity-80 transition-all text-white" style={{ backgroundColor: cores.textoSecundario }}>👁️</button>
                <button onClick={() => setForm(p)} className="p-3 rounded-xl hover:opacity-80 transition-all text-white" style={{ backgroundColor: cores.texto }}>✏️</button>
                <button onClick={async () => { if(window.confirm("Apagar plano?")) { await deleteDoc(doc(db, "planos", p.id)); carregarDados(); } }} className="p-3 rounded-xl hover:opacity-80 transition-all text-white" style={{ backgroundColor: cores.primaria }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* FORMULÁRIO */}
        <div 
          className="p-8 rounded-3xl border h-fit sticky top-10 shadow-2xl"
          style={{ backgroundColor: cores.card, borderColor: cores.borda }}
        >
          <h2 className="text-xl font-black mb-6 uppercase italic" style={{ color: cores.primaria }}>
            {form.id ? 'Editar Plano' : 'Criar Novo Plano'}
          </h2>
          <form onSubmit={salvar} className="space-y-4">
            <input 
              value={form.nome} 
              onChange={e => setForm({...form, nome: e.target.value})} 
              placeholder="Nome do Plano" 
              className="w-full border p-4 rounded-2xl outline-none transition-all"
              style={{ 
                backgroundColor: hexToRgba(cores.fundo, 0.3), 
                borderColor: cores.borda, 
                color: cores.texto 
              }} 
            />
            
            <div className="grid grid-cols-2 gap-4">
              <input 
                value={form.valor} 
                onChange={e => setForm({...form, valor: e.target.value})} 
                placeholder="Valor" 
                className="w-full border p-4 rounded-2xl outline-none"
                style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda, color: cores.texto }} 
              />
              <input 
                value={form.cortes} 
                onChange={e => setForm({...form, cortes: e.target.value})} 
                placeholder="Qtd Cortes" 
                className="w-full border p-4 rounded-2xl outline-none"
                style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda, color: cores.texto }} 
              />
            </div>

            {/* SELEÇÃO DE SERVIÇOS */}
            <div className="border p-4 rounded-2xl" style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: cores.borda }}>
              <p className="text-[10px] uppercase font-black mb-3" style={{ color: cores.textoSecundario }}>Serviços Base Cobertos:</p>
              <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 mb-2">
                {servicosDisponiveis.map(s => (
                  <label key={s} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={form.servicosInclusos.includes(s)} 
                      onChange={() => toggleServico(s)} 
                      className="w-4 h-4" 
                      style={{ accentColor: cores.primaria }}
                    />
                    <span 
                      className="text-sm font-bold uppercase transition-colors"
                      style={{ color: form.servicosInclusos.includes(s) ? cores.texto : cores.textoSecundario }}
                    >
                      {s}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* CRIAÇÃO DE COMBOS */}
            <div className="border p-4 rounded-2xl" style={{ backgroundColor: hexToRgba(cores.primaria, 0.05), borderColor: hexToRgba(cores.primaria, 0.2) }}>
              <p className="text-[10px] uppercase font-black mb-3" style={{ color: cores.primaria }}>Combos Exclusivos:</p>
              
              <div className="flex gap-2 mb-3">
                <input 
                  value={novoCombo.nome} 
                  onChange={e => setNovoCombo({...novoCombo, nome: e.target.value})} 
                  placeholder="Nome do Combo" 
                  className="w-full border p-3 rounded-xl outline-none text-xs"
                  style={{ backgroundColor: cores.card, borderColor: cores.borda, color: cores.texto }} 
                />
                <input 
                  value={novoCombo.tempo} 
                  onChange={e => setNovoCombo({...novoCombo, tempo: e.target.value})} 
                  placeholder="Min" 
                  className="w-20 border p-3 rounded-xl outline-none text-xs"
                  style={{ backgroundColor: cores.card, borderColor: cores.borda, color: cores.texto }} 
                />
                <button 
                  type="button" 
                  onClick={adicionarCombo} 
                  className="text-white font-black px-4 rounded-xl hover:opacity-80"
                  style={{ backgroundColor: cores.primaria }}
                >+</button>
              </div>

              {form.combos && form.combos.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t" style={{ borderColor: hexToRgba(cores.primaria, 0.2) }}>
                  {form.combos.map((c, index) => (
                    <div key={index} className="flex justify-between items-center border p-2 px-3 rounded-xl" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
                      <div>
                        <p className="text-xs font-bold uppercase" style={{ color: cores.texto }}>{c.nome}</p>
                        <p className="text-[10px]" style={{ color: cores.textoSecundario }}>{c.tempo}</p>
                      </div>
                      <button type="button" onClick={() => removerCombo(index)} className="text-xs font-black" style={{ color: cores.primaria }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="w-full text-white font-black py-4 rounded-2xl hover:opacity-90 uppercase tracking-widest mt-4 transition-all shadow-lg"
              style={{ backgroundColor: cores.primaria }}
            >
              {form.id ? 'Salvar Mudanças' : 'Lançar Plano'}
            </button>
            
            {form.id && (
              <button 
                type="button" 
                onClick={() => setForm({id:null, nome:'', valor:'', cortes:'', status:'Ativo', servicosInclusos: [], combos: []})} 
                className="w-full text-xs font-bold mt-2 hover:opacity-70 transition-colors"
                style={{ color: cores.textoSecundario }}
              >
                Cancelar Edição
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}