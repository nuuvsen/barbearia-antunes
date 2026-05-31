import React, { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, getDoc, addDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore'
import { 
  Banknote, CreditCard, QrCode, TrendingUp, 
  Scissors, User, Percent, Save, XCircle, CheckCircle2, Calendar, UserPlus, Trash2, Edit2, ShoppingBag, Wallet
} from 'lucide-react'
import AdminComissoes from './AdminComissoes' // <-- Importação do modal de comissões

export default function AdminGerencia() {
  // ==========================================
  // ESTADOS DO RELATÓRIO
  // ==========================================
  const [stats, setStats] = useState({ 
    faturamento: 0, 
    faturamentoMensal: 0, 
    total: 0,
    concluidos: 0,
    cancelados: 0,
    financeiro: {
      dinheiro: { valor: 0, qtd: 0 },
      pix: { valor: 0, qtd: 0 },
      cartao: { valor: 0, qtd: 0 }
    },
    barbeiros: {} 
  })
  
  const [cores, setCores] = useState({
    primaria: '#922020',
    fundo: '#bababa',
    card: '#ffffff',
    texto: '#171717',
    textoSecundario: '#2e2e2e',
    borda: '#000000'
  })

  const [carregando, setCarregando] = useState(true)

  // ==========================================
  // ESTADOS DO GERENCIADOR DE EQUIPE E COMISSÕES
  // ==========================================
  const [barbeiros, setBarbeiros] = useState([]);
  const [nome, setNome] = useState('');
  const [comissaoServico, setComissaoServico] = useState(50);
  const [comissaoProduto, setComissaoProduto] = useState(15);
  const [editandoId, setEditandoId] = useState(null);

  // Estado para controlar a exibição do Modal de Comissões
  const [mostrarComissoes, setMostrarComissoes] = useState(false);

  // ==========================================
  // FUNÇÕES UTILITÁRIAS
  // ==========================================
  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(0,0,0,${alpha})`
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ==========================================
  // BUSCA DE DADOS E RELATÓRIOS
  // ==========================================
  const carregarDadosIniciais = async () => {
    setCarregando(true)
    const docConfig = await getDoc(doc(db, "configuracoes", "personalizacao"))
    if (docConfig.exists() && docConfig.data().cores) {
      setCores(docConfig.data().cores)
    }
    await calcularRelatorios()
  }

  const calcularRelatorios = async () => {
    const snap = await getDocs(collection(db, "agendamentos"))
    
    const hojeStr = new Date().toLocaleDateString('pt-BR');
    const mesAtual = hojeStr.split('/')[1];
    const anoAtual = hojeStr.split('/')[2];

    let somaHoje = 0
    let somaMes = 0
    let totalConcluidos = 0
    let totalCancelados = 0
    let financeiroMap = {
      dinheiro: { valor: 0, qtd: 0 },
      pix: { valor: 0, qtd: 0 },
      cartao: { valor: 0, qtd: 0 }
    }
    let agrupamentoBarbeiros = {}

    snap.docs.forEach(d => {
      const data = d.data()
      const valStr = data.preco?.toString().replace(/\D/g, '') || '0'
      const valorReal = parseInt(valStr) / 100 
      
      const dataServico = data.data || ""; 
      const [diaDoc, mesDoc, anoDoc] = dataServico.split('/');

      if (data.status === 'Concluído') {
        if (dataServico === hojeStr) somaHoje += valorReal;
        if (mesDoc === mesAtual && anoDoc === anoAtual) somaMes += valorReal;
      }

      if (data.status === 'Cancelado') {
        totalCancelados++
      }

      if (data.status === 'Concluído') {
        totalConcluidos++
        
        const metodo = (data.formaPagamento || data.metodoPagamento || '').toLowerCase()
        if (metodo.includes('pix')) {
          financeiroMap.pix.valor += valorReal
          financeiroMap.pix.qtd++
        } else if (metodo.includes('dinheiro')) {
          financeiroMap.dinheiro.valor += valorReal
          financeiroMap.dinheiro.qtd++
        } else {
          financeiroMap.cartao.valor += valorReal
          financeiroMap.cartao.qtd++
        }

        const nomeBarbeiro = data.barbeiro || 'Sem Barbeiro'
        if (!agrupamentoBarbeiros[nomeBarbeiro]) {
          agrupamentoBarbeiros[nomeBarbeiro] = { quantidade: 0, valorGerado: 0 }
        }
        agrupamentoBarbeiros[nomeBarbeiro].quantidade += 1
        agrupamentoBarbeiros[nomeBarbeiro].valorGerado += valorReal
      }
    })

    setStats({ 
      faturamento: somaHoje, 
      faturamentoMensal: somaMes,
      total: snap.docs.length,
      concluidos: totalConcluidos,
      cancelados: totalCancelados,
      financeiro: financeiroMap,
      barbeiros: agrupamentoBarbeiros
    })
    setCarregando(false)
  }

  // Monitorar Barbeiros em Tempo Real
  useEffect(() => {
    carregarDadosIniciais()
    const unsubscribe = onSnapshot(collection(db, "barbeiros"), (snapshot) => {
      setBarbeiros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [])

  // ==========================================
  // FUNÇÕES DO GERENCIADOR DE EQUIPE (CRUD)
  // ==========================================
  const salvarBarbeiro = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return alert("O nome do barbeiro é obrigatório.");

    try {
      const dadosBarbeiro = {
        nome: nome,
        comissaoServico: Number(comissaoServico),
        comissaoProduto: Number(comissaoProduto)
      };

      if (editandoId) {
        await updateDoc(doc(db, "barbeiros", editandoId), dadosBarbeiro);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "barbeiros"), dadosBarbeiro);
      }

      setNome('');
      setComissaoServico(50);
      setComissaoProduto(15);
    } catch (error) {
      console.error("Erro ao salvar barbeiro:", error);
      alert("Erro ao salvar as configurações do barbeiro.");
    }
  };

  const excluirBarbeiro = async (id) => {
    if (window.confirm("Tem certeza que deseja remover este barbeiro?")) {
      try {
        await deleteDoc(doc(db, "barbeiros", id));
      } catch (error) {
        console.error("Erro ao excluir:", error);
      }
    }
  };

  const editarBarbeiro = (barbeiro) => {
    setEditandoId(barbeiro.id);
    setNome(barbeiro.nome);
    setComissaoServico(barbeiro.comissaoServico || 50);
    setComissaoProduto(barbeiro.comissaoProduto || 0);
  };

  if (carregando) return <div className="p-10 text-white font-black animate-pulse">CARREGANDO GERÊNCIA...</div>

  return (
    <div className="animate-in fade-in duration-500 pb-20 min-h-screen relative" style={{ color: cores.texto }}>
      
      {/* MODAL DE COMISSÕES (Renderiza por cima se ativo) */}
      {mostrarComissoes && (
        <AdminComissoes onClose={() => setMostrarComissoes(false)} />
      )}

      {/* HEADER GERAL */}
      <div className="mb-10 border-b pb-6" style={{ borderColor: hexToRgba(cores.borda, 0.2) }}>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">
          Relatórios de <span style={{ color: cores.primaria }}>Gerência</span>
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: cores.textoSecundario }}>
          Controle financeiro e gestão de equipe
        </p>
      </div>

      {/* BLOCO 1: RESUMO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div 
          className="p-8 rounded-3xl shadow-xl relative overflow-hidden group flex flex-col justify-between"
          style={{ backgroundColor: cores.primaria, color: '#fff' }}
        >
          <TrendingUp className="absolute -right-4 -top-4 w-32 h-32 text-black opacity-10 group-hover:scale-110 transition-transform duration-500" />
          
          <div>
            <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Faturamento Hoje</p>
            <p className="text-4xl font-black relative z-10">{formatarMoeda(stats.faturamento)}</p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/20 relative z-10">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="opacity-60" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase opacity-60">Total do Mês Atual</span>
                  <span className="text-lg font-black">{formatarMoeda(stats.faturamentoMensal)}</span>
                </div>
              </div>
          </div>
        </div>

        <div 
          className="border p-8 rounded-3xl flex flex-col justify-center"
          style={{ backgroundColor: cores.card, borderColor: cores.borda }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cores.textoSecundario }}>Total Agendados</p>
          <p className="text-5xl font-black" style={{ color: cores.texto }}>{stats.total}</p>
          
          <div className="flex gap-4 mt-4 pt-4 border-t" style={{ borderColor: hexToRgba(cores.borda, 0.1) }}>
              <div className="flex items-center gap-1.5">
                <XCircle size={12} className="text-red-500" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase opacity-50">Cancelados</span>
                  <span className="text-sm font-black text-red-500">{stats.cancelados}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-blue-500" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase opacity-50">Total Líquido</span>
                  <span className="text-sm font-black text-blue-500">{stats.total - stats.cancelados}</span>
                </div>
              </div>
          </div>
        </div>

        <div 
          className="border p-8 rounded-3xl flex flex-col justify-center border-b-4"
          style={{ 
            backgroundColor: cores.card, 
            borderColor: cores.borda, 
            borderBottomColor: '#22c55e' 
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cores.textoSecundario }}>Total Pagos</p>
          <p className="text-5xl font-black" style={{ color: '#22c55e' }}>{stats.concluidos}</p>
        </div>
      </div>

      {/* BLOCO 2: DIVISÃO DE RECEBIMENTO */}
      <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-center md:text-left" style={{ color: cores.textoSecundario }}>Divisão de Recebimento</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
        <div className="border p-6 rounded-3xl border-l-4 border-l-green-500" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Banknote size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.dinheiro.qtd}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cores.textoSecundario }}>Dinheiro</p>
          <p className="text-2xl font-black">{formatarMoeda(stats.financeiro.dinheiro.valor)}</p>
        </div>

        <div className="border p-6 rounded-3xl border-l-4 border-l-teal-400" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-teal-400/10 rounded-2xl text-teal-400"><QrCode size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.pix.qtd}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cores.textoSecundario }}>PIX</p>
          <p className="text-2xl font-black">{formatarMoeda(stats.financeiro.pix.valor)}</p>
        </div>

        <div className="border p-6 rounded-3xl border-l-4 border-l-blue-400" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-400/10 rounded-2xl text-blue-400"><CreditCard size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.cartao.qtd}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cores.textoSecundario }}>Cartão (Créd/Déb)</p>
          <p className="text-2xl font-black">{formatarMoeda(stats.financeiro.cartao.valor)}</p>
        </div>
      </div>

      {/* BLOCO 3: DESEMPENHO DOS BARBEIROS */}
      <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-center md:text-left" style={{ color: cores.textoSecundario }}>Desempenho da Equipe</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
        {Object.entries(stats.barbeiros).length === 0 ? (
            <p className="text-sm font-bold opacity-50 col-span-full">Nenhum atendimento concluído encontrado.</p>
        ) : (
          Object.entries(stats.barbeiros).map(([nomeBarbeiro, dados]) => {
            const barbeiroDb = barbeiros.find(b => b.nome.toLowerCase() === nomeBarbeiro.toLowerCase());
            const porcentagem = barbeiroDb ? barbeiroDb.comissaoServico : 50; 
            
            const valorComissao = (dados.valorGerado * porcentagem) / 100;
            const liquidoBarbearia = dados.valorGerado - valorComissao;

            return (
              <div 
                key={nomeBarbeiro} 
                className="border p-8 rounded-[2.5rem] transition-all group"
                style={{ backgroundColor: cores.card, borderColor: cores.borda }}
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: cores.borda }}>
                      <User size={28} style={{ color: cores.primaria }} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter">{nomeBarbeiro}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: cores.textoSecundario }}>
                        <Scissors size={12}/> {dados.quantidade} Atendimentos
                      </p>
                    </div>
                  </div>

                  <div className="border px-4 py-2 rounded-2xl text-center" style={{ backgroundColor: hexToRgba(cores.primaria, 0.05), borderColor: hexToRgba(cores.primaria, 0.2) }}>
                    <p className="text-[9px] font-black uppercase" style={{ color: cores.primaria }}>Taxa Retida</p>
                    <p className="text-xl font-black" style={{ color: cores.primaria }}>{porcentagem}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t pt-6 text-center md:text-left" style={{ borderColor: hexToRgba(cores.borda, 0.1) }}>
                  <div>
                    <p className="text-[9px] font-black uppercase mb-1" style={{ color: cores.textoSecundario }}>Bruto</p>
                    <p className="text-lg font-black">{formatarMoeda(dados.valorGerado)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase mb-1" style={{ color: cores.primaria }}>Comissão</p>
                    <p className="text-lg font-black" style={{ color: cores.primaria }}>{formatarMoeda(valorComissao)}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[9px] font-black uppercase mb-1" style={{ color: '#22c55e' }}>Líquido Loja</p>
                    <p className="text-lg font-black" style={{ color: '#22c55e' }}>{formatarMoeda(liquidoBarbearia)}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <hr className="my-10 border-t-2" style={{ borderColor: hexToRgba(cores.borda, 0.2) }} />

      {/* BLOCO 4: GERENCIAR EQUIPE E BOTÃO DE COMISSÕES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">
          Gerenciar <span style={{ color: cores.primaria }}>Equipe</span>
        </h2>

        {/* BOTÃO PARA ABRIR AS COMISSÕES DETALHADAS */}
        <button 
          onClick={() => setMostrarComissoes(true)}
          className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
          style={{ backgroundColor: cores.primaria, color: '#fff' }}
        >
          <Wallet size={16} /> Fechamento de Comissões
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULÁRIO DE CADASTRO/EDIÇÃO */}
        <div className="lg:col-span-1">
          <form onSubmit={salvarBarbeiro} className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
            <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-2">
              {editandoId ? <Edit2 size={18} /> : <UserPlus size={18} />}
              {editandoId ? 'Editar Barbeiro' : 'Novo Barbeiro'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase opacity-50 ml-2">Nome do Profissional</label>
                <input 
                  type="text" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full p-4 rounded-2xl border outline-none font-bold focus:brightness-95 transition-all"
                  style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: hexToRgba(cores.borda, 0.3), color: cores.texto }}
                  placeholder="Ex: Carlos Silva"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase opacity-50 ml-2 flex items-center gap-1"><Scissors size={10}/> % Serviço</label>
                  <input 
                    type="number" 
                    value={comissaoServico}
                    onChange={(e) => setComissaoServico(e.target.value)}
                    className="w-full p-4 rounded-2xl border outline-none font-black focus:brightness-95 transition-all"
                    style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: hexToRgba(cores.borda, 0.3), color: '#16a34a' }}
                    min="0" max="100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase opacity-50 ml-2 flex items-center gap-1"><ShoppingBag size={10}/> % Produto</label>
                  <input 
                    type="number" 
                    value={comissaoProduto}
                    onChange={(e) => setComissaoProduto(e.target.value)}
                    className="w-full p-4 rounded-2xl border outline-none font-black focus:brightness-95 transition-all"
                    style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: hexToRgba(cores.borda, 0.3), color: '#3b82f6' }}
                    min="0" max="100"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: cores.primaria }}
            >
              <Save size={18} /> {editandoId ? 'Atualizar Dados' : 'Cadastrar Barbeiro'}
            </button>

            {editandoId && (
              <button 
                type="button"
                onClick={() => { setEditandoId(null); setNome(''); setComissaoServico(50); setComissaoProduto(15); }}
                className="w-full mt-2 py-3 rounded-2xl font-bold text-xs uppercase opacity-60 hover:opacity-100 transition-all"
              >
                Cancelar Edição
              </button>
            )}
          </form>
        </div>

        {/* LISTA DE BARBEIROS CADASTRADOS */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {barbeiros.map(barbeiro => (
              <div key={barbeiro.id} className="p-5 rounded-[2rem] border shadow-sm flex flex-col justify-between" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-inner" style={{ backgroundColor: cores.primaria }}>
                      {barbeiro.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-black uppercase text-lg">{barbeiro.nome}</h4>
                      <p className="text-[10px] font-bold uppercase opacity-50">Equipe</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editarBarbeiro(barbeiro)} className="p-2 rounded-xl transition-colors hover:brightness-110" style={{ backgroundColor: hexToRgba('#3b82f6', 0.1), color: '#3b82f6' }}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => excluirBarbeiro(barbeiro.id)} className="p-2 rounded-xl transition-colors hover:brightness-110" style={{ backgroundColor: hexToRgba('#ef4444', 0.1), color: '#ef4444' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 border-t pt-4 mt-2" style={{ borderColor: hexToRgba(cores.borda, 0.1) }}>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-50 mb-1">Comissão Serviços</p>
                    <p className="font-black" style={{ color: '#16a34a' }}>{barbeiro.comissaoServico || 0}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-50 mb-1">Comissão Produtos</p>
                    <p className="font-black" style={{ color: '#3b82f6' }}>{barbeiro.comissaoProduto || 0}%</p>
                  </div>
                </div>
              </div>
            ))}
            
            {barbeiros.length === 0 && (
              <div className="col-span-full p-10 text-center border-2 border-dashed rounded-3xl opacity-50" style={{ borderColor: cores.borda }}>
                <p className="font-bold uppercase">Nenhum barbeiro cadastrado ainda.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}