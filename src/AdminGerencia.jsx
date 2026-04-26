import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs } from 'firebase/firestore'
import { Banknote, CreditCard, QrCode, Wallet, TrendingUp, Scissors, User } from 'lucide-react'

export default function AdminGerencia() {
  const [stats, setStats] = useState({ 
    faturamento: 0, 
    total: 0,
    concluidos: 0,
    metodos: {},
    barbeiros: {} // Novo estado para controlar os barbeiros
  })

  useEffect(() => {
    const calcular = async () => {
      const snap = await getDocs(collection(db, "agendamentos"))
      
      let somaTotal = 0
      let totalConcluidos = 0
      let agrupamentoPagamentos = {}
      let agrupamentoBarbeiros = {} // Objeto temporário para os barbeiros

      snap.docs.forEach(d => {
        const data = d.data()
        
        // Formata o preço para número (trata valores como "R$ 50,00" ou apenas "5000" centavos)
        const valStr = data.preco?.toString().replace(/\D/g, '') || '0'
        const valorReal = parseInt(valStr) / 100 
        
        somaTotal += valorReal

        // Se o status for "Concluído", contabilizamos nas estatísticas financeiras
        if (data.status === 'Concluído') {
          totalConcluidos++
          
          // 1. Agrupamento por Forma de Pagamento
          const metodo = data.formaPagamento || data.metodoPagamento || 'Não Informado'
          if (!agrupamentoPagamentos[metodo]) {
            agrupamentoPagamentos[metodo] = { quantidade: 0, valor: 0 }
          }
          agrupamentoPagamentos[metodo].quantidade += 1
          agrupamentoPagamentos[metodo].valor += valorReal

          // 2. Agrupamento por Barbeiro (NOVO)
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
        metodos: agrupamentoPagamentos,
        barbeiros: agrupamentoBarbeiros // Salvando no state
      })
    }
    
    calcular()
  }, [])

  // Função para retornar o ícone correto baseado no nome do método de pagamento
  const getMetodoIcon = (metodo) => {
    const m = metodo.toLowerCase()
    if (m.includes('pix')) return <QrCode size={24} className="text-teal-400" />
    if (m.includes('cartão') || m.includes('credito') || m.includes('debito')) return <CreditCard size={24} className="text-blue-400" />
    if (m.includes('dinheiro')) return <Banknote size={24} className="text-green-500" />
    return <Wallet size={24} className="text-gray-400" />
  }

  // Formatador de Moeda
  const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">
          Relatórios de <span className="text-red-600">Gerência</span>
        </h1>
      </div>

      {/* BLOCO 1: RESUMO GERAL */}
      <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Visão Geral</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        <div className="bg-red-600 p-8 rounded-3xl shadow-xl shadow-red-900/20 relative overflow-hidden group">
          <TrendingUp className="absolute -right-4 -top-4 w-32 h-32 text-black opacity-10 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Faturamento Previsto</p>
          <p className="text-4xl md:text-5xl font-black relative z-10">{formatarMoeda(stats.faturamento)}</p>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] p-8 rounded-3xl flex flex-col justify-center">
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Volume Total de Atendimentos</p>
          <div className="flex items-end gap-3">
            <p className="text-5xl font-black">{stats.total}</p>
            <span className="text-sm font-bold text-gray-600 mb-1 tracking-wide uppercase">Agendados</span>
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] border-b-4 border-b-green-500 p-8 rounded-3xl flex flex-col justify-center">
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Atendimentos Pagos</p>
          <div className="flex items-end gap-3">
            <p className="text-5xl font-black text-green-500">{stats.concluidos}</p>
            <span className="text-sm font-bold text-gray-600 mb-1 tracking-wide uppercase">Concluídos</span>
          </div>
        </div>

      </div>

      {/* BLOCO 2: DETALHAMENTO DE PAGAMENTOS */}
      <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Como foram pagos</h2>
      
      {Object.keys(stats.metodos).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {Object.entries(stats.metodos).map(([metodo, dados]) => (
            <div key={metodo} className="bg-[#0a0a0a] border border-[#1f1f1f] p-6 rounded-3xl flex flex-col justify-between hover:border-[#333] transition-colors">
              
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-[#161616] rounded-2xl">
                  {getMetodoIcon(metodo)}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{dados.quantidade}</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase">Qtd.</p>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">{metodo}</p>
                <p className="text-xl font-black text-white">{formatarMoeda(dados.valor)}</p>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111] border border-[#1f1f1f] border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center text-gray-500 mb-10">
          <Wallet size={40} className="mb-4 opacity-50" />
          <p className="font-bold uppercase tracking-widest text-xs">Nenhum pagamento registrado ainda</p>
          <p className="text-[10px] mt-2 max-w-sm">Quando você finalizar um agendamento na aba "Agenda", os métodos de pagamento aparecerão listados aqui.</p>
        </div>
      )}

      {/* BLOCO 3: DESEMPENHO POR BARBEIRO */}
      <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Desempenho por Barbeiro</h2>
      
      {Object.keys(stats.barbeiros).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(stats.barbeiros).map(([nome, dados]) => (
            <div key={nome} className="bg-[#111111] border border-[#1f1f1f] p-6 rounded-3xl flex items-center justify-between hover:border-red-600/50 transition-colors group">
              
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#1c1c1c] rounded-full flex items-center justify-center group-hover:bg-red-600/10 transition-colors">
                  <User size={24} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                </div>
                <div>
                  <p className="text-xl font-black uppercase text-white tracking-tighter">{nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Scissors size={12} className="text-gray-500" />
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{dados.quantidade} Cortes concluídos</p>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Gerou para o caixa</p>
                <p className="text-2xl font-black text-white">{formatarMoeda(dados.valorGerado)}</p>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111] border border-[#1f1f1f] border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center text-gray-500">
          <Scissors size={40} className="mb-4 opacity-50" />
          <p className="font-bold uppercase tracking-widest text-xs">Nenhum barbeiro pontuou ainda</p>
        </div>
      )}

    </div>
  )
}