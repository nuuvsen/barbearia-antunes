import { useState, useEffect } from 'react'
import { db } from './firebase' 
import { 
  collection, addDoc, deleteDoc, 
  doc, updateDoc, onSnapshot, serverTimestamp 
} from 'firebase/firestore'
import { 
  Plus, X, Package, Search, 
  Trash2, Edit3, Layers, BarChart3, 
  Minus, ArrowDownUp, AlertCircle
} from 'lucide-react'

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('nome')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [menuAtivo, setMenuAtivo] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [configCores, setConfigCores] = useState(null)
  const [novaCat, setNovaCat] = useState('')
  
  const formInicial = { 
    id: null, nome: '', preco: '', estoque: '', categoria: '', foto: '' 
  }
  const [form, setForm] = useState(formInicial)

  // 1. BUSCA PERSONALIZAÇÃO
  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) setConfigCores(docSnap.data().cores);
    });
    return () => unsubCores();
  }, []);

  // 2. BUSCA PRODUTOS (CORRIGIDO: O id do firebase agora sempre sobrescreve qualquer bug no data)
  useEffect(() => {
    const unsubProd = onSnapshot(collection(db, "produtos"), (snap) => {
      setProdutos(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    })
    return () => unsubProd()
  }, [])

  // 3. BUSCA CATEGORIAS
  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, "categorias"), (snap) => {
      setCategorias(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    })
    return () => unsubCat()
  }, [])

  const fecharModal = () => {
    setIsModalOpen(false)
    setForm(formInicial)
  }

  const prepararEdicao = (p) => {
    setForm(p)
    setIsModalOpen(true)
  }

  // SALVAR NOVO OU EDITAR COMPLETO (CORRIGIDO)
  const salvarProduto = async (e) => {
    e.preventDefault()
    setCarregando(true)
    try {
      // Removemos o id do formulário antes de preparar os dados para evitar salvar 'id: null' no banco
      const { id, ...restoForm } = form;
      
      const dados = {
        ...restoForm,
        preco: parseFloat(form.preco || 0),
        estoque: parseInt(form.estoque || 0),
        atualizadoEm: serverTimestamp()
      }

      if (id) {
        // Se tem ID, é atualização
        await updateDoc(doc(db, "produtos", id), dados)
      } else {
        // Se não tem ID, é novo (e não enviamos a propriedade id junto)
        await addDoc(collection(db, "produtos"), { ...dados, criadoEm: serverTimestamp() })
      }
      fecharModal()
    } catch (error) { 
      alert("Erro ao salvar: " + error.message) 
    } finally { 
      setCarregando(false) 
    }
  }

  // EXCLUIR PRODUTO INTEIRO
  const excluirProduto = async (id) => {
    if(!id) {
      alert("Erro de referência: ID do produto não encontrado.");
      return;
    }
    
    if(window.confirm("Atenção: Deseja realmente EXCLUIR este produto permanentemente?")) {
      try {
        await deleteDoc(doc(db, "produtos", id))
      } catch (error) {
        alert("Erro ao excluir: " + error.message)
      }
    }
  }

  // AJUSTAR ESTOQUE INLINE (+ OU -)
  const ajustarEstoque = async (produto, variacao) => {
    if(!produto.id) return;
    
    const novoEstoque = parseInt(produto.estoque) + variacao;
    if (novoEstoque < 0) return; 
    
    try {
      await updateDoc(doc(db, "produtos", produto.id), { 
        estoque: novoEstoque,
        atualizadoEm: serverTimestamp()
      })
    } catch (error) {
      alert("Erro ao atualizar estoque: " + error.message)
    }
  }

  const addCategoria = async () => {
    if(!novaCat) return
    await addDoc(collection(db, "categorias"), { nome: novaCat })
    setNovaCat('')
  }

  const deleteCategoria = async (id) => {
    if(window.confirm("Excluir categoria?")) await deleteDoc(doc(db, "categorias", id))
  }

  const totalGeralEstoque = produtos.reduce((acc, p) => acc + (Number(p.preco || 0) * Number(p.estoque || 0)), 0)

  // LÓGICA DE FILTRO E ORDENAÇÃO
  let produtosExibicao = produtos.filter(p => 
    (p.nome || '').toLowerCase().includes(busca.toLowerCase()) || 
    (p.categoria || '').toLowerCase().includes(busca.toLowerCase())
  )

  switch (ordenacao) {
    case 'nome':
      produtosExibicao.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      break;
    case 'estoque-baixo':
      produtosExibicao.sort((a, b) => (a.estoque || 0) - (b.estoque || 0));
      break;
    case 'estoque-alto':
      produtosExibicao.sort((a, b) => (b.estoque || 0) - (a.estoque || 0));
      break;
    case 'preco-maior':
      produtosExibicao.sort((a, b) => (b.preco || 0) - (a.preco || 0));
      break;
    case 'preco-menor':
      produtosExibicao.sort((a, b) => (a.preco || 0) - (b.preco || 0));
      break;
    default:
      break;
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20 relative min-h-full">
      
      {/* HEADER E BUSCA */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-6 gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter" 
              style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
            Estoque <span style={{ color: configCores?.primaria || 'var(--cor-primaria)' }}>Antunes</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1" 
             style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
            Gerenciamento de itens e Controle de Lotes
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Ordenação */}
          <div className="relative flex items-center">
            <ArrowDownUp className="absolute left-4 opacity-30" size={16} style={{ color: configCores?.texto }} />
            <select 
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="w-full sm:w-48 pl-10 pr-4 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer"
              style={{ backgroundColor: configCores?.fundo || '#f3f4f6', borderColor: configCores?.borda, color: configCores?.texto }}
            >
              <option value="nome">A-Z</option>
              <option value="estoque-baixo">Menor Estoque</option>
              <option value="estoque-alto">Maior Estoque</option>
              <option value="preco-maior">Maior Preço</option>
              <option value="preco-menor">Menor Preço</option>
            </select>
          </div>

          <div className="relative flex-1 lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} style={{ color: configCores?.texto }} />
            <input 
              type="text" 
              placeholder="PESQUISAR..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] outline-none transition-all"
              style={{ backgroundColor: configCores?.fundo || '#f3f4f6', borderColor: configCores?.borda, color: configCores?.texto }}
            />
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-4 sm:py-0 rounded-2xl flex items-center justify-center transition-all hover:brightness-110 active:scale-95 shadow-lg"
            style={{ backgroundColor: configCores?.primaria || '#f97316', color: '#FFF' }}
          >
            <Plus size={20} className="mr-2" strokeWidth={3} />
            <span className="font-black uppercase text-[10px] tracking-widest">Novo</span>
          </button>
        </div>
      </div>

      {/* BOTÕES DE MENUS ADICIONAIS */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button 
          onClick={() => setMenuAtivo(menuAtivo === 'categorias' ? null : 'categorias')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest"
          style={{ 
            backgroundColor: menuAtivo === 'categorias' ? configCores?.primaria : 'transparent',
            color: menuAtivo === 'categorias' ? '#FFF' : configCores?.texto,
            borderColor: configCores?.borda 
          }}
        >
          <Layers size={14} /> Categorias
        </button>
        <button 
          onClick={() => setMenuAtivo(menuAtivo === 'estoque' ? null : 'estoque')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest"
          style={{ 
            backgroundColor: menuAtivo === 'estoque' ? configCores?.primaria : 'transparent',
            color: menuAtivo === 'estoque' ? '#FFF' : configCores?.texto,
            borderColor: configCores?.borda 
          }}
        >
          <BarChart3 size={14} /> Relatório de Valores
        </button>
      </div>

      {/* PAINEL DE CATEGORIAS */}
      {menuAtivo === 'categorias' && (
        <div className="mb-8 p-6 rounded-[2rem] border animate-in slide-in-from-top duration-300"
             style={{ backgroundColor: configCores?.card || '#FFF', borderColor: configCores?.borda }}>
          <h3 className="text-sm font-black uppercase italic mb-4" style={{ color: configCores?.primaria }}>Gerenciar Categorias</h3>
          <div className="flex gap-2 mb-4">
            <input 
              value={novaCat} onChange={e => setNovaCat(e.target.value)}
              placeholder="Nova categoria..."
              className="flex-1 p-3 rounded-xl border text-xs outline-none uppercase font-bold"
              style={{ backgroundColor: configCores?.fundo, borderColor: configCores?.borda, color: configCores?.texto }}
            />
            <button onClick={addCategoria} className="px-6 rounded-xl bg-green-500 text-white font-black hover:bg-green-600 transition-colors uppercase text-[10px] tracking-widest">Adicionar</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-6">
            {categorias.length === 0 && <span className="text-xs opacity-50 italic">Nenhuma categoria cadastrada.</span>}
            {categorias.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 px-4 py-2 rounded-lg border group" style={{ backgroundColor: configCores?.fundo, borderColor: configCores?.borda }}>
                <span className="text-[10px] font-bold uppercase" style={{ color: configCores?.texto }}>{cat.nome}</span>
                <button onClick={() => deleteCategoria(cat.id)} className="text-red-500 opacity-50 group-hover:opacity-100 hover:scale-110 transition-all ml-2"><X size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAINEL DE RELATÓRIO */}
      {menuAtivo === 'estoque' && (
        <div className="mb-8 p-6 rounded-[2rem] border animate-in slide-in-from-top duration-300 overflow-hidden"
             style={{ backgroundColor: configCores?.card || '#FFF', borderColor: configCores?.borda }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black uppercase italic" style={{ color: configCores?.primaria }}>Resumo Financeiro</h3>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase opacity-50" style={{ color: configCores?.texto }}>Capital Parado Estimado</p>
              <p className="text-2xl font-black italic" style={{ color: configCores?.primaria }}>R$ {totalGeralEstoque.toFixed(2)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px] uppercase font-bold" style={{ color: configCores?.texto }}>
              <thead>
                <tr className="border-b" style={{ borderColor: configCores?.borda }}>
                  <th className="py-3">Produto</th>
                  <th>Categoria</th>
                  <th>Qtd</th>
                  <th>Preço Venda</th>
                  <th className="text-right">Total Bruto</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 && (
                  <tr><td colSpan="5" className="py-4 text-center opacity-50">Nenhum produto cadastrado</td></tr>
                )}
                {produtos.map(p => (
                  <tr key={p.id} className="border-b border-dashed last:border-0 hover:bg-black/5" style={{ borderColor: configCores?.borda }}>
                    <td className="py-3">{p.nome}</td>
                    <td className="opacity-60">{p.categoria || '-'}</td>
                    <td>{p.estoque}</td>
                    <td>R$ {Number(p.preco || 0).toFixed(2)}</td>
                    <td className="text-right" style={{ color: configCores?.primaria }}>R$ {((p.preco || 0) * (p.estoque || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRID DE PRODUTOS */}
      {produtosExibicao.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-40">
          <Package size={64} className="mb-4" />
          <h2 className="text-xl font-black uppercase tracking-widest">Nenhum produto encontrado</h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {produtosExibicao.map(p => (
            <div key={p.id} className="group p-5 rounded-[2.5rem] border transition-all hover:scale-[1.02] shadow-sm flex flex-col relative"
                 style={{ backgroundColor: configCores?.card || '#FFF', borderColor: configCores?.borda }}>
              
              {/* STATUS BADGES */}
              {p.estoque === 0 && (
                <div className="absolute top-6 right-6 z-10 bg-red-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full tracking-widest flex items-center gap-1 shadow-lg shadow-red-500/30">
                  <AlertCircle size={10} /> Esgotado
                </div>
              )}
              {p.estoque > 0 && p.estoque <= 5 && (
                <div className="absolute top-6 right-6 z-10 bg-yellow-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full tracking-widest flex items-center gap-1 shadow-lg shadow-yellow-500/30">
                  <AlertCircle size={10} /> Baixo Estoque
                </div>
              )}

              <div className="aspect-square mb-5 overflow-hidden rounded-[2rem] relative" style={{ backgroundColor: configCores?.fundo || '#f3f4f6' }}>
                {p.foto ? (
                  <img src={p.foto} alt={p.nome} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20" style={{ color: configCores?.texto }}><Package size={48}/></div>
                )}
              </div>

              <div className="flex-1">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-2 inline-block" style={{ color: configCores?.primaria, backgroundColor: configCores?.fundo || '#f3f4f6' }}>
                  {p.categoria || 'Sem Categoria'}
                </span>
                <h3 className="font-black text-lg uppercase tracking-tighter leading-tight mb-1" style={{ color: configCores?.texto }}>{p.nome}</h3>
                <p className="text-2xl font-black italic tracking-tighter mb-4" style={{ color: configCores?.primaria }}>R$ {Number(p.preco || 0).toFixed(2)}</p>
                
                {/* CONTROLE RÁPIDO DE ESTOQUE */}
                <div className="flex items-center justify-between p-2 rounded-2xl border" style={{ borderColor: configCores?.borda, backgroundColor: configCores?.fundo || '#f3f4f6' }}>
                  <button 
                    onClick={() => ajustarEstoque(p, -1)}
                    disabled={p.estoque === 0}
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-white border shadow-sm hover:bg-gray-50 active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all text-gray-700"
                  >
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <div className="text-center">
                    <span className="block text-sm font-black" style={{ color: configCores?.texto }}>{p.estoque}</span>
                    <span className="block text-[8px] uppercase font-bold tracking-widest opacity-50" style={{ color: configCores?.texto }}>Em Estoque</span>
                  </div>
                  <button 
                    onClick={() => ajustarEstoque(p, 1)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-white border shadow-sm hover:bg-gray-50 active:scale-95 transition-all text-gray-700"
                  >
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-dashed" style={{ borderColor: configCores?.borda }}>
                <button 
                  onClick={() => prepararEdicao(p)} 
                  className="flex-1 py-3 rounded-xl flex justify-center items-center hover:opacity-70 transition-all"
                  style={{ backgroundColor: configCores?.fundo || '#f3f4f6', color: configCores?.texto }}
                  title="Editar informações completas"
                >
                  <Edit3 size={16}/>
                </button>
                <button 
                  onClick={() => excluirProduto(p.id)} 
                  className="flex-1 py-3 rounded-xl flex justify-center items-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                  title="Excluir produto do sistema"
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DRAWER LATERAL DE CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={fecharModal} />
          <div className="w-full max-w-md h-full relative shadow-2xl flex flex-col animate-in slide-in-from-right duration-500"
               style={{ backgroundColor: configCores?.card || '#FFF' }}>
            
            <div className="p-8 flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: configCores?.primaria }}>
                {form.id ? 'Editar Detalhes' : 'Novo Produto'}
              </h2>
              <button onClick={fecharModal} className="p-2 opacity-50 hover:opacity-100" style={{ color: configCores?.texto }}><X size={24} /></button>
            </div>

            <form onSubmit={salvarProduto} className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase italic ml-2" style={{ color: configCores?.primaria }}>Nome do Item</label>
                <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-4 rounded-2xl border outline-none text-sm font-bold uppercase" style={{ backgroundColor: configCores?.fundo, borderColor: configCores?.borda, color: configCores?.texto }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase italic ml-2" style={{ color: configCores?.primaria }}>Preço (R$)</label>
                  <input required type="number" step="0.01" value={form.preco} onChange={e => setForm({...form, preco: e.target.value})} className="w-full p-4 rounded-2xl border outline-none text-sm font-bold" style={{ backgroundColor: configCores?.fundo, borderColor: configCores?.borda, color: configCores?.texto }} />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase italic ml-2" style={{ color: configCores?.primaria }}>Qtd Estoque</label>
                  <input required type="number" min="0" value={form.estoque} onChange={e => setForm({...form, estoque: e.target.value})} className="w-full p-4 rounded-2xl border outline-none text-sm font-bold" style={{ backgroundColor: configCores?.fundo, borderColor: configCores?.borda, color: configCores?.texto }} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase italic ml-2" style={{ color: configCores?.primaria }}>Categoria</label>
                <select 
                  required
                  value={form.categoria} 
                  onChange={e => setForm({...form, categoria: e.target.value})}
                  className="w-full p-4 rounded-2xl border outline-none appearance-none text-sm font-bold uppercase cursor-pointer" 
                  style={{ backgroundColor: configCores?.fundo, borderColor: configCores?.borda, color: configCores?.texto }}
                >
                  <option value="">Selecione...</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase italic ml-2" style={{ color: configCores?.primaria }}>Link da Foto (URL)</label>
                <input value={form.foto} onChange={e => setForm({...form, foto: e.target.value})} className="w-full p-4 rounded-2xl border outline-none text-xs" style={{ backgroundColor: configCores?.fundo, borderColor: configCores?.borda, color: configCores?.texto }} placeholder="https://..." />
                {form.foto && (
                  <div className="mt-2 h-24 w-24 rounded-xl overflow-hidden border border-dashed">
                    <img src={form.foto} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <button type="submit" disabled={carregando} className="w-full font-black py-5 rounded-2xl uppercase tracking-widest text-white shadow-lg transition-all active:scale-95"
                      style={{ backgroundColor: configCores?.primaria }}>
                {carregando ? 'SALVANDO...' : 'SALVAR PRODUTO'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}