import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { 
  Banknote, CreditCard, QrCode, Wallet, TrendingUp, 
  Scissors, User, Percent, Settings2, Save 
} from 'lucide-react'

export default function AdminGerencia() {
  const [stats, setStats] = useState({ 
    faturamento: 0, 
    total: 0,
    concluidos: 0,
    financeiro: {
      dinheiro: { valor: 0, qtd: 0 },
      pix: { valor: 0, qtd: 0 },
      cartao: { valor: 0, qtd: 0 }
    },
    barbeiros: {} 
  })
  
  // Estado para as cores dinâmicas
  const [cores, setCores] = useState({
    primaria: '#922020',
    fundo: '#bababa',
    card: '#ffffff',
    texto: '#171717',
    textoSecundario: '#2e2e2e',
    borda: '#000000'
  })

  const [comissoes, setComissoes] = useState({}) 
  const [editandoComissao, setEditandoComissao] = useState(false)
  const [carregando, setCarregando] = useState(true)

  // Função auxiliar para transparência
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const carregarDadosIniciais = async () => {
    setCarregando(true)
    
    // 1. Carrega Personalização de Cores
    const docConfig = await getDoc(doc(db, "configuracoes", "personalizacao"))
    if (docConfig.exists() && docConfig.data().cores) {
      setCores(docConfig.data().cores)
    }

    // 2. Carrega Comissões
    const docComissao = await getDoc(doc(db, "configuracoes", "comissoes"))
    if (docComissao.exists()) {
      setComissoes(docComissao.data())
    }

    // 3. Calcula Relatórios
    await calcularRelatorios()
  }

  const salvarComissoes = async () => {
    await setDoc(doc(db, "configuracoes", "comissoes"), comissoes)
    setEditandoComissao(false)
    calcularRelatorios()
  }

  const calcularRelatorios = async () => {
    const snap = await getDocs(collection(db, "agendamentos"))
    
    let somaTotal = 0
    let totalConcluidos = 0
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
      
      somaTotal += valorReal

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
      faturamento: somaTotal, 
      total: snap.docs.length,
      concluidos: totalConcluidos,
      financeiro: financeiroMap,
      barbeiros: agrupamentoBarbeiros
    })
    setCarregando(false)
  }

  useEffect(() => {
    carregarDadosIniciais()
  }, [])

  const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (carregando) return <div className="p-10 text-white font-black animate-pulse">CARREGANDO GERÊNCIA...</div>

  return (
    <div className="animate-in fade-in duration-500 pb-20 min-h-screen" style={{ color: cores.texto }}>
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">
          Relatórios de <span style={{ color: cores.primaria }}>Gerência</span>
        </h1>
        
        <button 
          onClick={() => editandoComissao ? salvarComissoes() : setEditandoComissao(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg"
          style={{ 
            backgroundColor: editandoComissao ? '#16a34a' : cores.card, 
            color: editandoComissao ? '#fff' : cores.texto,
            border: `1px solid ${cores.borda}`
          }}
        >
          {editandoComissao ? <><Save size={16}/> Salvar Porcentagens</> : <><Settings2 size={16}/> Ajustar Comissões</>}
        </button>
      </div>

      {/* BLOCO 1: RESUMO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div 
          className="p-8 rounded-3xl shadow-xl relative overflow-hidden group"
          style={{ backgroundColor: cores.primaria, color: '#fff' }}
        >
          <TrendingUp className="absolute -right-4 -top-4 w-32 h-32 text-black opacity-10 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Faturamento Previsto</p>
          <p className="text-4xl font-black relative z-10">{formatarMoeda(stats.faturamento)}</p>
        </div>

        <div 
          className="border p-8 rounded-3xl flex flex-col justify-center"
          style={{ backgroundColor: cores.card, borderColor: cores.borda }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cores.textoSecundario }}>Total Agendados</p>
          <p className="text-5xl font-black" style={{ color: cores.texto }}>{stats.total}</p>
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
        
        {/* DINHEIRO */}
        <div className="border p-6 rounded-3xl border-l-4 border-l-green-500" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Banknote size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.dinheiro.qtd}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cores.textoSecundario }}>Dinheiro</p>
          <p className="text-2xl font-black">{formatarMoeda(stats.financeiro.dinheiro.valor)}</p>
        </div>

        {/* PIX */}
        <div className="border p-6 rounded-3xl border-l-4 border-l-teal-400" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-teal-400/10 rounded-2xl text-teal-400"><QrCode size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.pix.qtd}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cores.textoSecundario }}>PIX</p>
          <p className="text-2xl font-black">{formatarMoeda(stats.financeiro.pix.valor)}</p>
        </div>

        {/* CARTÃO */}
        <div className="border p-6 rounded-3xl border-l-4 border-l-blue-400" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-400/10 rounded-2xl text-blue-400"><CreditCard size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.cartao.qtd}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cores.textoSecundario }}>Cartão (Créd/Déb)</p>
          <p className="text-2xl font-black">{formatarMoeda(stats.financeiro.cartao.valor)}</p>
        </div>

      </div>

      {/* BLOCO 3: BARBEIROS E COMISSÕES */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: cores.textoSecundario }}>Desempenho e Comissões</h2>
        {editandoComissao && (
          <span 
            className="text-[9px] px-3 py-1 rounded-full font-black uppercase animate-pulse"
            style={{ backgroundColor: hexToRgba(cores.primaria, 0.2), color: cores.primaria }}
          >
            Editando Porcentagens
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(stats.barbeiros).map(([nome, dados]) => {
          const porcentagem = comissoes[nome] || 50;
          const valorComissao = (dados.valorGerado * porcentagem) / 100;
          const liquidoBarbearia = dados.valorGerado - valorComissao;

          return (
            <div 
              key={nome} 
              className="border p-8 rounded-[2.5rem] transition-all group"
              style={{ backgroundColor: cores.card, borderColor: cores.borda }}
            >
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: cores.borda }}>
                    <User size={28} style={{ color: cores.primaria }} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">{nome}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: cores.textoSecundario }}>
                      <Scissors size={12}/> {dados.quantidade} Atendimentos
                    </p>
                  </div>
                </div>

                {editandoComissao ? (
                  <div className="flex flex-col items-end">
                    <label className="text-[9px] font-black uppercase mb-1" style={{ color: cores.primaria }}>Comissão %</label>
                    <div className="flex items-center border rounded-xl px-3 py-2" style={{ backgroundColor: hexToRgba(cores.fundo, 0.1), borderColor: cores.primaria }}>
                      <input 
                        type="number" 
                        value={porcentagem}
                        onChange={(e) => setComissoes({...comissoes, [nome]: parseInt(e.target.value) || 0})}
                        className="bg-transparent w-12 text-center font-black text-lg focus:outline-none"
                        style={{ color: cores.texto }}
                      />
                      <Percent size={14} style={{ color: cores.primaria }} />
                    </div>
                  </div>
                ) : (
                  <div className="border px-4 py-2 rounded-2xl" style={{ backgroundColor: hexToRgba(cores.primaria, 0.05), borderColor: hexToRgba(cores.primaria, 0.2) }}>
                    <p className="text-[9px] font-black uppercase text-center" style={{ color: cores.primaria }}>Taxa</p>
                    <p className="text-xl font-black" style={{ color: cores.primaria }}>{porcentagem}%</p>
                  </div>
                )}
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
        })}
      </div>

    </div>
  )
}