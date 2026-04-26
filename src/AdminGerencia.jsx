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
    // Categorias fixas para facilitar a visualização lado a lado
    financeiro: {
      dinheiro: { valor: 0, qtd: 0 },
      pix: { valor: 0, qtd: 0 },
      cartao: { valor: 0, qtd: 0 }
    },
    barbeiros: {} 
  })
  
  const [comissoes, setComissoes] = useState({}) 
  const [editandoComissao, setEditandoComissao] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregarConfiguracoes = async () => {
    const docRef = doc(db, "configuracoes", "comissoes")
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      setComissoes(docSnap.data())
    }
  }

  const salvarComissoes = async () => {
    await setDoc(doc(db, "configuracoes", "comissoes"), comissoes)
    setEditandoComissao(false)
    calcularRelatorios()
  }

  const calcularRelatorios = async () => {
    setCarregando(true)
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
        
        // Separação por tipo de recebimento
        const metodo = (data.formaPagamento || data.metodoPagamento || '').toLowerCase()
        
        if (metodo.includes('pix')) {
          financeiroMap.pix.valor += valorReal
          financeiroMap.pix.qtd++
        } else if (metodo.includes('dinheiro')) {
          financeiroMap.dinheiro.valor += valorReal
          financeiroMap.dinheiro.qtd++
        } else {
          // Tudo que não é Pix ou Dinheiro cai em Cartão (Crédito/Débito)
          financeiroMap.cartao.valor += valorReal
          financeiroMap.cartao.qtd++
        }

        // Agrupamento Barbeiros
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
    carregarConfiguracoes()
    calcularRelatorios()
  }, [])

  const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">
          Relatórios de <span className="text-red-600">Gerência</span>
        </h1>
        
        <button 
          onClick={() => editandoComissao ? salvarComissoes() : setEditandoComissao(true)}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
            editandoComissao ? 'bg-green-600 text-white animate-pulse' : 'bg-[#111] border border-[#1f1f1f] text-gray-400 hover:text-white'
          }`}
        >
          {editandoComissao ? <><Save size={16}/> Salvar Porcentagens</> : <><Settings2 size={16}/> Ajustar Comissões</>}
        </button>
      </div>

      {/* BLOCO 1: RESUMO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-red-600 p-8 rounded-3xl shadow-xl shadow-red-900/20 relative overflow-hidden group">
          <TrendingUp className="absolute -right-4 -top-4 w-32 h-32 text-black opacity-10 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Faturamento Previsto</p>
          <p className="text-4xl font-black relative z-10">{formatarMoeda(stats.faturamento)}</p>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] p-8 rounded-3xl flex flex-col justify-center">
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Agendados</p>
          <p className="text-5xl font-black">{stats.total}</p>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] border-b-4 border-b-green-500 p-8 rounded-3xl flex flex-col justify-center text-green-500">
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Pagos</p>
          <p className="text-5xl font-black">{stats.concluidos}</p>
        </div>
      </div>

      {/* BLOCO 2: DIVISÃO DE RECEBIMENTO (LADO A LADO) */}
      <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4 text-center md:text-left">Divisão de Recebimento</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
        
        {/* DINHEIRO */}
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] p-6 rounded-3xl border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Banknote size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.dinheiro.qtd}</p>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Dinheiro</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(stats.financeiro.dinheiro.valor)}</p>
        </div>

        {/* PIX */}
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] p-6 rounded-3xl border-l-4 border-l-teal-400">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-teal-400/10 rounded-2xl text-teal-400"><QrCode size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.pix.qtd}</p>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">PIX</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(stats.financeiro.pix.valor)}</p>
        </div>

        {/* CARTÃO */}
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] p-6 rounded-3xl border-l-4 border-l-blue-400">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-400/10 rounded-2xl text-blue-400"><CreditCard size={24} /></div>
            <p className="text-xl font-black">{stats.financeiro.cartao.qtd}</p>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Cartão (Créd/Déb)</p>
          <p className="text-2xl font-black text-white">{formatarMoeda(stats.financeiro.cartao.valor)}</p>
        </div>

      </div>

      {/* BLOCO 3: BARBEIROS E COMISSÕES */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Desempenho e Comissões</h2>
        {editandoComissao && <span className="text-[9px] bg-red-600/20 text-red-500 px-3 py-1 rounded-full font-black uppercase animate-pulse">Editando Porcentagens</span>}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(stats.barbeiros).map(([nome, dados]) => {
          const porcentagem = comissoes[nome] || 50;
          const valorComissao = (dados.valorGerado * porcentagem) / 100;
          const liquidoBarbearia = dados.valorGerado - valorComissao;

          return (
            <div key={nome} className="bg-[#111] border border-[#1f1f1f] p-8 rounded-[2.5rem] hover:border-red-600/30 transition-all group">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#0a0a0a] border border-[#1f1f1f] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User size={28} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">{nome}</h3>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <Scissors size={12}/> {dados.quantidade} Atendimentos
                    </p>
                  </div>
                </div>

                {editandoComissao ? (
                  <div className="flex flex-col items-end">
                    <label className="text-[9px] font-black uppercase text-red-600 mb-1">Comissão %</label>
                    <div className="flex items-center bg-[#0a0a0a] border border-red-600/50 rounded-xl px-3 py-2">
                      <input 
                        type="number" 
                        value={porcentagem}
                        onChange={(e) => setComissoes({...comissoes, [nome]: parseInt(e.target.value) || 0})}
                        className="bg-transparent w-12 text-center font-black text-lg focus:outline-none"
                      />
                      <Percent size={14} className="text-red-600" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-600/10 border border-red-600/20 px-4 py-2 rounded-2xl">
                    <p className="text-[9px] font-black text-red-600 uppercase text-center">Taxa</p>
                    <p className="text-xl font-black text-red-600">{porcentagem}%</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-[#1f1f1f] pt-6 text-center md:text-left">
                <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase mb-1">Bruto</p>
                  <p className="text-lg font-black">{formatarMoeda(dados.valorGerado)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-red-500 font-black uppercase mb-1">Comissão</p>
                  <p className="text-lg font-black text-red-500">{formatarMoeda(valorComissao)}</p>
                </div>
                <div className="md:text-right">
                  <p className="text-[9px] text-green-500 font-black uppercase mb-1">Líquido Loja</p>
                  <p className="text-lg font-black text-green-500">{formatarMoeda(liquidoBarbearia)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}