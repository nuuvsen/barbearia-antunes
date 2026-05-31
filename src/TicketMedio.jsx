import React, { useMemo } from 'react';
import { XCircle, TrendingUp, Users, Scissors, CreditCard, CalendarDays } from 'lucide-react';

export default function TicketMedio({ onClose, agendamentos, cores }) {
  // Função para converter hex para rgba (para o background das divs)
  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Pega apenas agendamentos pagos para não deturpar a média
  const atendimentosValidos = useMemo(() => {
    return agendamentos.filter(a => a.status === 'Concluído' && a.preco);
  }, [agendamentos]);

  // ==========================================
  // CÁLCULOS DOS TICKETS MÉDIOS
  // ==========================================
  const relatorios = useMemo(() => {
    let stats = {
      porBarbeiro: {},
      porCliente: {},
      porPagamento: {},
      porDiaSemana: {
        'Domingo': { valor: 0, qtd: 0 }, 'Segunda-feira': { valor: 0, qtd: 0 },
        'Terça-feira': { valor: 0, qtd: 0 }, 'Quarta-feira': { valor: 0, qtd: 0 },
        'Quinta-feira': { valor: 0, qtd: 0 }, 'Sexta-feira': { valor: 0, qtd: 0 },
        'Sábado': { valor: 0, qtd: 0 }
      }
    };

    atendimentosValidos.forEach(item => {
      const valStr = item.preco.toString().replace(/\D/g, '');
      const valor = parseInt(valStr) / 100;
      
      const barbeiro = item.barbeiro || 'Sem Barbeiro';
      const cliente = item.nome || item.cliente || 'Avulso';
      const pagamento = item.formaPagamento || item.metodoPagamento || 'Outro';
      
      // Data para descobrir o dia da semana
      let diaSemana = 'Indefinido';
      if (item.data) {
        const [dia, mes, ano] = item.data.split('/');
        if (dia && mes && ano) {
          const dataObj = new Date(`${ano}-${mes}-${dia}T12:00:00`);
          const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          diaSemana = dias[dataObj.getDay()];
        }
      }

      // Preenche Barbeiro
      if (!stats.porBarbeiro[barbeiro]) stats.porBarbeiro[barbeiro] = { valor: 0, qtd: 0 };
      stats.porBarbeiro[barbeiro].valor += valor;
      stats.porBarbeiro[barbeiro].qtd += 1;

      // Preenche Cliente
      if (!stats.porCliente[cliente]) stats.porCliente[cliente] = { valor: 0, qtd: 0 };
      stats.porCliente[cliente].valor += valor;
      stats.porCliente[cliente].qtd += 1;

      // Preenche Pagamento
      if (!stats.porPagamento[pagamento]) stats.porPagamento[pagamento] = { valor: 0, qtd: 0 };
      stats.porPagamento[pagamento].valor += valor;
      stats.porPagamento[pagamento].qtd += 1;

      // Preenche Dia da Semana
      if (stats.porDiaSemana[diaSemana]) {
        stats.porDiaSemana[diaSemana].valor += valor;
        stats.porDiaSemana[diaSemana].qtd += 1;
      }
    });

    return stats;
  }, [atendimentosValidos]);

  // Helper para formatar objetos em Arrays fáceis de dar 'map'
  const gerarArrayRanking = (obj) => {
    return Object.entries(obj)
      .map(([nome, dados]) => ({
        nome,
        qtd: dados.qtd,
        ticket: dados.qtd > 0 ? dados.valor / dados.qtd : 0,
        total: dados.valor
      }))
      .sort((a, b) => b.ticket - a.ticket); // Maior ticket primeiro
  };

  const barbeirosRanking = gerarArrayRanking(relatorios.porBarbeiro);
  const clientesRanking = gerarArrayRanking(relatorios.porCliente).slice(0, 10); // Top 10 clientes
  const pagamentosRanking = gerarArrayRanking(relatorios.porPagamento);
  const diasRanking = gerarArrayRanking(relatorios.porDiaSemana).filter(d => d.qtd > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-300">
      <div 
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl relative overflow-hidden"
        style={{ backgroundColor: cores.fundo, color: cores.texto }}
      >
        {/* HEADER */}
        <div className="p-8 border-b shrink-0 flex justify-between items-center" style={{ backgroundColor: cores.card, borderColor: hexToRgba(cores.borda, 0.1) }}>
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <TrendingUp style={{ color: cores.primaria }} /> Análise de Ticket Médio
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">
              Indicadores baseados no histórico total
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors group">
            <XCircle size={32} className="text-red-500 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* CONTEÚDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* TICKET POR BARBEIRO */}
            <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: cores.card, borderColor: hexToRgba(cores.borda, 0.1) }}>
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
                <Scissors size={16}/> Por Barbeiro
              </h3>
              <div className="space-y-3">
                {barbeirosRanking.map((b, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3) }}>
                    <div>
                      <p className="font-bold uppercase text-sm">{b.nome}</p>
                      <p className="text-[9px] font-bold opacity-50 uppercase">{b.qtd} Atendimentos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black" style={{ color: cores.primaria }}>{formatarMoeda(b.ticket)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TICKET POR DIA DA SEMANA */}
            <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: cores.card, borderColor: hexToRgba(cores.borda, 0.1) }}>
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
                <CalendarDays size={16}/> Por Dia da Semana
              </h3>
              <div className="space-y-3">
                {diasRanking.map((d, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3) }}>
                    <div>
                      <p className="font-bold uppercase text-sm">{d.nome}</p>
                      <p className="text-[9px] font-bold opacity-50 uppercase">{d.qtd} Atendimentos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-600">{formatarMoeda(d.ticket)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TICKET POR FORMA DE PAGAMENTO */}
            <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: cores.card, borderColor: hexToRgba(cores.borda, 0.1) }}>
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
                <CreditCard size={16}/> Por Pagamento
              </h3>
              <div className="space-y-3">
                {pagamentosRanking.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3) }}>
                    <div>
                      <p className="font-bold uppercase text-sm">{p.nome}</p>
                      <p className="text-[9px] font-bold opacity-50 uppercase">{p.qtd} Transações</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-green-600">{formatarMoeda(p.ticket)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TICKET DOS TOP CLIENTES */}
            <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: cores.card, borderColor: hexToRgba(cores.borda, 0.1) }}>
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: cores.textoSecundario }}>
                <Users size={16}/> Top Clientes (Maior Ticket)
              </h3>
              <div className="space-y-3">
                {clientesRanking.map((c, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: hexToRgba(cores.fundo, 0.3) }}>
                    <div className="flex-1 truncate pr-2">
                      <p className="font-bold uppercase text-sm truncate">{i + 1}. {c.nome}</p>
                      <p className="text-[9px] font-bold opacity-50 uppercase">{c.qtd} Visitas</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-orange-500">{formatarMoeda(c.ticket)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}