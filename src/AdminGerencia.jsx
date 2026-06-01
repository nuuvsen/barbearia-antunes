import React, { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, getDoc, onSnapshot, updateDoc, query, where } from 'firebase/firestore'
import { 
  Banknote, CreditCard, QrCode, TrendingUp, 
  Scissors, User, Save, XCircle, CheckCircle2, Calendar, Edit2, ShoppingBag, Wallet,
  DollarSign, Receipt, TrendingDown, Eye, Activity
} from 'lucide-react'
import AdminComissoes from './AdminComissoes' 
import TicketMedio from './TicketMedio'
import AdminDespesas from './AdminDespesas'
import Swal from 'sweetalert2'

export default function AdminGerencia() {
  // ==========================================
  // ESTADOS DO RELATÓRIO
  // ==========================================
  const [stats, setStats] = useState({ 
    faturamento: 0, 
    faturamentoMensal: 0, 
    ticketMedioHoje: 0,
    ticketMedioMes: 0,
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

  // ESTADOS DA VISÃO GERAL DO MÊS E PREVIEW
  const [visaoGeral, setVisaoGeral] = useState({
    faturamentoBruto: 0,
    totalDespesas: 0,
    lucroReal: 0,
    servicosRanking: [],
    comandasMes: [],
    despesasMes: []
  });
  
  const [previewInfo, setPreviewInfo] = useState(null); 
  const [mostrarTicketMedio, setMostrarTicketMedio] = useState(false); 
  const [mostrarDespesas, setMostrarDespesas] = useState(false); 
  const [agendamentosDados, setAgendamentosDados] = useState([]); 

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
    await calcularVisaoGeralDoMes()
    setCarregando(false)
  }

  const calcularVisaoGeralDoMes = async () => {
    try {
      const dataAtual = new Date();
      const mesAtual = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;

      // 1. Busca TODAS as comandas do mês
      const qComandas = query(collection(db, "comandas"), where("mesReferencia", "==", mesAtual));
      const snapshotComandas = await getDocs(qComandas);
      
      const comandas = [];
      let somaLucroBarbearia = 0; 
      let faturamentoBruto = 0;

      snapshotComandas.forEach((doc) => {
        const dados = doc.data();
        comandas.push({ id: doc.id, ...dados });
        somaLucroBarbearia += Number(dados.lucroBarbearia || 0); 
        faturamentoBruto += (dados.valorTotal || 0);
      });

      // 2. Busca TODAS as despesas do mês
      const qDespesas = query(collection(db, "despesas"), where("mesReferencia", "==", mesAtual));
      const snapshotDespesas = await getDocs(qDespesas);
      
      const despesas = [];
      let somaDespesas = 0;
      snapshotDespesas.forEach((doc) => {
        const dados = doc.data();
        despesas.push({ id: doc.id, ...dados });
        somaDespesas += Number(dados.valor || 0);
      });

      // 3. Ranking de Serviços
      const contagemServicos = {};
      comandas.forEach(comanda => {
        if (comanda.servicos && Array.isArray(comanda.servicos)) {
          comanda.servicos.forEach(servico => {
            contagemServicos[servico] = (contagemServicos[servico] || 0) + 1;
          });
        }
      });

      const ranking = Object.entries(contagemServicos)
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade);

      setVisaoGeral({
        faturamentoBruto,
        totalDespesas: somaDespesas,
        lucroReal: somaLucroBarbearia - somaDespesas,
        servicosRanking: ranking,
        comandasMes: comandas,
        despesasMes: despesas
      });
    } catch (error) {
      console.error("Erro ao buscar visão geral:", error);
    }
  }

  const calcularRelatorios = async () => {
    const snap = await getDocs(collection(db, "agendamentos"))
    
    const todosAgendamentos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAgendamentosDados(todosAgendamentos);

    const hojeStr = new Date().toLocaleDateString('pt-BR');
    const mesAtual = hojeStr.split('/')[1];
    const anoAtual = hojeStr.split('/')[2];

    let somaHoje = 0
    let somaMes = 0
    let qtdHoje = 0
    let qtdMes = 0

    let totalConcluidos = 0
    let totalCancelados = 0
    let financeiroMap = {
      dinheiro: { valor: 0, qtd: 0 },
      pix: { valor: 0, qtd: 0 },
      cartao: { valor: 0, qtd: 0 }
    }
    let agrupamentoBarbeiros = {}

    todosAgendamentos.forEach(data => {
      const valStr = data.preco?.toString().replace(/\D/g, '') || '0'
      const valorReal = parseInt(valStr) / 100 
      
      const dataServico = data.data || ""; 
      const [diaDoc, mesDoc, anoDoc] = dataServico.split('/');

      if (data.status === 'Cancelado') {
        totalCancelados++
      }

      if (data.status === 'Concluído') {
        totalConcluidos++
        
        if (dataServico === hojeStr) {
          somaHoje += valorReal;
          qtdHoje++;
        }
        if (mesDoc === mesAtual && anoDoc === anoAtual) {
          somaMes += valorReal;
          qtdMes++;
        }

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

    const ticketHoje = qtdHoje > 0 ? somaHoje / qtdHoje : 0;
    const ticketMes = qtdMes > 0 ? somaMes / qtdMes : 0;

    setStats({ 
      faturamento: somaHoje, 
      faturamentoMensal: somaMes,
      ticketMedioHoje: ticketHoje,
      ticketMedioMes: ticketMes,
      total: snap.docs.length,
      concluidos: totalConcluidos,
      cancelados: totalCancelados,
      financeiro: financeiroMap,
      barbeiros: agrupamentoBarbeiros
    })
  }

  useEffect(() => {
    carregarDadosIniciais()
    const unsubscribe = onSnapshot(collection(db, "barbeiros"), (snapshot) => {
      setBarbeiros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [])

  // ==========================================
  // FUNÇÕES DO GERENCIADOR DE EQUIPE (APENAS EDIÇÃO DE COMISSÕES)
  // ==========================================
  const salvarBarbeiro = async (e) => {
    e.preventDefault();
    if (!editandoId) return; // Segurança para garantir que é apenas edição

    try {
      const dadosBarbeiro = {
        nome: nome,
        comissaoServico: Number(comissaoServico),
        comissaoProduto: Number(comissaoProduto)
      };

      await updateDoc(doc(db, "barbeiros", editandoId), dadosBarbeiro);

      Swal.fire({
        icon: 'success',
        title: 'Comissões Atualizadas!',
        text: 'As informações do barbeiro foram salvas com sucesso.',
        timer: 2000,
        showConfirmButton: false
      });

      setEditandoId(null);
      setNome('');
      setComissaoServico(50);
      setComissaoProduto(15);
    } catch (error) {
      console.error("Erro ao salvar barbeiro:", error);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Erro ao salvar as configurações do barbeiro.'
      });
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
      
      {/* ========================================================= */}
      {/* COMPONENTES MODAIS */}
      {/* ========================================================= */}
      {mostrarTicketMedio && (
        <TicketMedio 
          onClose={() => setMostrarTicketMedio(false)} 
          agendamentos={agendamentosDados} 
          cores={cores} 
        />
      )}

      {mostrarComissoes && (
        <AdminComissoes onClose={() => setMostrarComissoes(false)} />
      )}

      {/* MODAL DE DESPESAS */}
      {mostrarDespesas && (
        <AdminDespesas onClose={() => {
          setMostrarDespesas(false);
          // Recarrega os dados da visão geral ao fechar as despesas para atualizar o "Lucro Líquido Real"
          calcularVisaoGeralDoMes(); 
        }} />
      )}

      {/* MODAL DE PREVIEW FINANCEIRO */}
      {previewInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200">
          <div className="rounded-[2rem] p-6 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative" 
                style={{ backgroundColor: cores.card, borderColor: cores.borda, borderWidth: '1px' }}>
            
            <div className="flex justify-between items-center mb-6 pb-4 border-b" style={{ borderColor: hexToRgba(cores.borda, 0.1) }}>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter" style={{ color: cores.texto }}>
                  {previewInfo === 'receitas' && 'Prévia de Receitas do Mês'}
                  {previewInfo === 'despesas' && 'Prévia de Despesas do Mês'}
                  {previewInfo === 'lucro' && 'Resumo do Lucro Líquido'}
                </h2>
                <p className="text-[10px] uppercase font-bold opacity-60">Detalhamento dos registros atuais</p>
              </div>
              <button onClick={() => setPreviewInfo(null)} className="p-2 rounded-full hover:bg-black/5 transition-colors">
                <XCircle size={28} className="text-red-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {/* RENDERIZAR RECEITAS (COMANDAS) */}
              {previewInfo === 'receitas' && (
                visaoGeral.comandasMes.length > 0 ? visaoGeral.comandasMes.map((comanda, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 rounded-2xl border" style={{ backgroundColor: hexToRgba(cores.fundo, 0.1), borderColor: hexToRgba(cores.borda, 0.1) }}>
                    <div>
                      <p className="font-bold text-sm uppercase">{comanda.nomeCliente || 'Cliente Avulso'}</p>
                      <p className="text-[10px] opacity-60 uppercase">{comanda.data} - {comanda.barbeiro}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-500">{formatarMoeda(comanda.valorTotal || 0)}</p>
                      <p className="text-[10px] font-bold text-green-500 uppercase">Retido: {formatarMoeda(comanda.lucroBarbearia || 0)}</p>
                    </div>
                  </div>
                )) : <p className="text-center font-bold opacity-50 py-10">Nenhuma receita registrada neste mês.</p>
              )}

              {/* RENDERIZAR DESPESAS */}
              {previewInfo === 'despesas' && (
                visaoGeral.despesasMes.length > 0 ? visaoGeral.despesasMes.map((despesa, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 rounded-2xl border" style={{ backgroundColor: hexToRgba(cores.fundo, 0.1), borderColor: hexToRgba(cores.borda, 0.1) }}>
                    <div>
                      <p className="font-bold text-sm uppercase">{despesa.descricao}</p>
                      <p className="text-[10px] opacity-60 uppercase">{despesa.dataPagamento || despesa.data}</p>
                    </div>
                    <div>
                      <p className="font-black text-red-500">- {formatarMoeda(despesa.valor || 0)}</p>
                    </div>
                  </div>
                )) : <p className="text-center font-bold opacity-50 py-10">Nenhuma despesa registrada neste mês.</p>
              )}

              {/* RENDERIZAR RESUMO DE LUCRO */}
              {previewInfo === 'lucro' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <span className="font-black uppercase text-sm text-blue-600">Total Faturado (Bruto)</span>
                    <span className="font-black text-xl text-blue-600">{formatarMoeda(visaoGeral.faturamentoBruto)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                    <div>
                      <span className="font-black uppercase text-sm text-orange-600">Total Retido p/ Barbearia</span>
                      <p className="text-[10px] text-orange-600/70 font-bold uppercase">Após pagamento de comissões</p>
                    </div>
                    <span className="font-black text-xl text-orange-600">{formatarMoeda(visaoGeral.lucroReal + visaoGeral.totalDespesas)}</span>
                  </div>

                  <div className="flex justify-between items-center p-5 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <span className="font-black uppercase text-sm text-red-600">Total de Despesas</span>
                    <span className="font-black text-xl text-red-600">- {formatarMoeda(visaoGeral.totalDespesas)}</span>
                  </div>

                  <hr style={{ borderColor: hexToRgba(cores.borda, 0.1) }} className="my-4"/>

                  <div className="flex justify-between items-center p-6 rounded-3xl" style={{ backgroundColor: cores.primaria }}>
                    <span className="font-black uppercase text-white">Lucro Líquido Real</span>
                    <span className="font-black text-3xl text-white">{formatarMoeda(visaoGeral.lucroReal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER GERAL (ATUALIZADO COM O BOTÃO DE DESPESAS) */}
      <div className="mb-10 border-b pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4" style={{ borderColor: hexToRgba(cores.borda, 0.2) }}>
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">
            Relatórios de <span style={{ color: cores.primaria }}>Gerência</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: cores.textoSecundario }}>
            Controle financeiro e gestão de equipe
          </p>
        </div>

        {/* BOTÃO PARA ABRIR AS DESPESAS */}
        <button 
          onClick={() => setMostrarDespesas(true)}
          className="px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2 bg-red-500 text-white"
        >
          <TrendingDown size={16} /> Lançar Despesas
        </button>
      </div>

      {/* ========================================================= */}
      {/* VISÃO GERAL FINANCEIRA */}
      {/* ========================================================= */}
      <div className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2" 
            style={{ color: cores.textoSecundario }}>
          <TrendingUp size={16} /> Visão Geral Financeira (Mês Atual)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            onClick={() => setPreviewInfo('receitas')}
            className="p-6 rounded-3xl border flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all relative group" 
            style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] uppercase font-black opacity-50" style={{ color: cores.textoSecundario }}>Faturamento Bruto</p>
              <DollarSign size={18} className="text-blue-500" />
            </div>
            <h2 className="text-3xl font-black text-blue-500 truncate">
              {formatarMoeda(visaoGeral.faturamentoBruto)}
            </h2>
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center z-20">
              <span className="bg-white/90 text-blue-600 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm"><Eye size={12}/> Ver Detalhes</span>
            </div>
          </div>

          <div 
            onClick={() => setPreviewInfo('despesas')}
            className="p-6 rounded-3xl border flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all relative group" 
            style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] uppercase font-black opacity-50" style={{ color: cores.textoSecundario }}>Despesas no Mês</p>
              <TrendingDown size={18} className="text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-red-500 truncate">
              {formatarMoeda(visaoGeral.totalDespesas)}
            </h2>
            <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center z-20">
               <span className="bg-white/90 text-red-600 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm"><Eye size={12}/> Ver Detalhes</span>
            </div>
          </div>

          <div 
            onClick={() => setPreviewInfo('lucro')}
            className="p-6 rounded-3xl border flex flex-col justify-between relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all group" 
            style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
            <div className="flex justify-between items-start mb-2 z-10">
              <p className="text-[10px] uppercase font-black opacity-50" style={{ color: cores.textoSecundario }}>Lucro Líquido Real</p>
              <Receipt size={18} className="text-green-500" />
            </div>
            <h2 className="text-3xl font-black text-green-500 truncate z-10">
              {formatarMoeda(visaoGeral.lucroReal)}
            </h2>
            {visaoGeral.lucroReal < 0 && <span className="absolute bottom-2 right-4 text-[8px] font-black text-red-500 uppercase z-10">Prejuízo</span>}
            <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center z-20">
               <span className="bg-white/90 text-green-600 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm"><Eye size={12}/> Ver Resumo</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl border overflow-hidden flex flex-col" 
                style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
            <p className="text-[10px] uppercase font-black opacity-50 mb-3" style={{ color: cores.textoSecundario }}>Top Serviços</p>
            {visaoGeral.servicosRanking.length === 0 ? (
              <p className="text-xs font-bold opacity-50 flex-1 flex items-center" style={{ color: cores.texto }}>Sem dados.</p>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {visaoGeral.servicosRanking.slice(0, 3).map((servico, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-bold truncate pr-2" style={{ color: cores.texto }}>{idx + 1}. {servico.nome}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded font-black" style={{ backgroundColor: hexToRgba(cores.fundo, 0.5), color: cores.textoSecundario }}>{servico.quantidade}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ========================================================= */}


      {/* BLOCO 1: ATIVIDADE, DESEMPENHO E TICKET MÉDIO */}
      <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-center md:text-left mt-8 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
        <Activity size={14}/> Atividade e Desempenho
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* CARD TICKET MÉDIO CLICÁVEL */}
        <div 
          onClick={() => setMostrarTicketMedio(true)}
          className="p-8 rounded-3xl shadow-xl relative overflow-hidden group flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
          style={{ backgroundColor: cores.primaria, color: '#fff' }}
        >
          <TrendingUp className="absolute -right-4 -top-4 w-32 h-32 text-black opacity-10 group-hover:scale-110 transition-transform duration-500" />
          
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2 relative z-10 flex items-center gap-2">Ticket Médio (Hoje)</p>
            <p className="text-4xl font-black relative z-10">{formatarMoeda(stats.ticketMedioHoje)}</p>
            <p className="text-[10px] font-bold opacity-60 mt-1 relative z-10">Média de gasto por cliente no dia</p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/20 relative z-10">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="opacity-60" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase opacity-60">Ticket Médio do Mês Atual</span>
                  <span className="text-lg font-black">{formatarMoeda(stats.ticketMedioMes)}</span>
                </div>
              </div>
          </div>
          
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center z-20">
            <span className="bg-white text-[10px] font-black uppercase px-4 py-2 rounded-full flex items-center gap-2 shadow-xl" style={{ color: cores.primaria }}>
              <Eye size={14}/> Análise de Ticket Completa
            </span>
          </div>
        </div>

        {/* CARD: TOTAL AGENDADOS E TAXA DE CANCELAMENTO */}
        <div 
          className="border p-8 rounded-3xl flex flex-col justify-center"
          style={{ backgroundColor: cores.card, borderColor: cores.borda }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cores.textoSecundario }}>Volume de Agendamentos</p>
          <p className="text-5xl font-black" style={{ color: cores.texto }}>{stats.total}</p>
          
          <div className="flex gap-4 mt-4 pt-4 border-t" style={{ borderColor: hexToRgba(cores.borda, 0.1) }}>
              <div className="flex items-center gap-1.5 w-full">
                <XCircle size={14} className="text-red-500" />
                <div className="flex flex-col flex-1">
                  <span className="text-[8px] font-black uppercase opacity-50">Cancelados</span>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-red-500">{stats.cancelados}</span>
                    <span className="text-[9px] font-bold text-red-500/70">{stats.total > 0 ? Math.round((stats.cancelados / stats.total) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* CARD: TOTAL PAGOS E TAXA DE SUCESSO */}
        <div 
          className="border p-8 rounded-3xl flex flex-col justify-center border-b-4"
          style={{ 
            backgroundColor: cores.card, 
            borderColor: cores.borda, 
            borderBottomColor: '#22c55e' 
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cores.textoSecundario }}>Atendimentos Pagos</p>
          <p className="text-5xl font-black" style={{ color: '#22c55e' }}>{stats.concluidos}</p>

          <div className="flex gap-4 mt-4 pt-4 border-t" style={{ borderColor: hexToRgba(cores.borda, 0.1) }}>
              <div className="flex items-center gap-1.5 w-full">
                <CheckCircle2 size={14} className="text-green-500" />
                <div className="flex flex-col flex-1">
                  <span className="text-[8px] font-black uppercase opacity-50">Taxa de Conversão</span>
                  <span className="text-sm font-black text-green-500">{stats.total > 0 ? Math.round((stats.concluidos / stats.total) * 100) : 0}% Sucesso</span>
                </div>
              </div>
          </div>
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

        <button 
          onClick={() => setMostrarComissoes(true)}
          className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
          style={{ backgroundColor: cores.primaria, color: '#fff' }}
        >
          <Wallet size={16} /> Fechamento de Comissões
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORMULÁRIO DE EDIÇÃO (APARECE APENAS QUANDO UM BARBEIRO É SELECIONADO) */}
        <div className="lg:col-span-1">
          {editandoId ? (
            <form onSubmit={salvarBarbeiro} className="p-6 rounded-3xl border shadow-sm animate-in fade-in" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-2">
                <Edit2 size={18} />
                Editar Comissões
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase opacity-50 ml-2">Nome do Profissional</label>
                  <input 
                    type="text" 
                    value={nome}
                    readOnly
                    className="w-full p-4 rounded-2xl border outline-none font-bold opacity-60 cursor-not-allowed"
                    style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: hexToRgba(cores.borda, 0.3), color: cores.texto }}
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
                <Save size={18} /> Atualizar Comissões
              </button>

              <button 
                type="button"
                onClick={() => { setEditandoId(null); setNome(''); setComissaoServico(50); setComissaoProduto(15); }}
                className="w-full mt-2 py-3 rounded-2xl font-bold text-xs uppercase opacity-60 hover:opacity-100 transition-all text-center"
              >
                Cancelar Edição
              </button>
            </form>
          ) : (
            <div className="p-8 rounded-3xl border shadow-sm flex flex-col items-center justify-center h-full text-center" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
              <User size={48} className="mb-4 opacity-20" style={{ color: cores.texto }} />
              <p className="text-sm font-bold opacity-50 uppercase" style={{ color: cores.texto }}>
                Selecione um barbeiro na lista ao lado para editar suas comissões.
              </p>
            </div>
          )}
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
                    <button 
                      onClick={() => editarBarbeiro(barbeiro)} 
                      className="p-2 rounded-xl transition-colors hover:brightness-110 flex items-center gap-2 px-3" 
                      style={{ backgroundColor: hexToRgba('#3b82f6', 0.1), color: '#3b82f6' }}
                    >
                      <Edit2 size={16} /> <span className="text-[10px] font-black uppercase">Editar</span>
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