import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { Wallet, Search, CheckCircle2, Clock } from 'lucide-react';
import Carregando from './Carregando';

export default function AdminFiado() {
  const [fiados, setFiados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [mostrarQuitados, setMostrarQuitados] = useState(false);

  useEffect(() => {
    setCarregando(true);
    const q = query(collection(db, "fiados"));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (b.dataCriacao || '').localeCompare(a.dataCriacao || ''));
      setFiados(lista);
      setCarregando(false);
    }, (erro) => {
      console.error("Erro ao carregar fiados:", erro);
      toast.error("Erro ao carregar contas a receber.");
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  const formatarMoeda = (valor) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

  const formatarDataHora = (iso) => {
    if (!iso) return '--';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--';
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Registra um pagamento (total ou parcial) contra o saldo devedor de um fiado.
  // Nunca deixa o saldo passar de zero, e marca "Quitado" quando ele zera.
  const registrarPagamento = async (item) => {
    const saldoAtual = Number(item.saldo || 0);

    // Também perguntamos a FORMA do recebimento (Dinheiro/Pix/Cartão) — sem isso, o
    // Controle de Caixa não tem como saber em qual "gaveta" esse dinheiro entrou hoje.
    const { value: dadosPagamento } = await Swal.fire({
      title: 'Registrar pagamento',
      html: `<p style="font-size:13px;opacity:0.7;margin-bottom:4px;">${item.clienteNome}</p>
             <p style="font-size:12px;opacity:0.5;margin-bottom:14px;">Saldo devedor: <b>${formatarMoeda(saldoAtual)}</b></p>
             <div style="text-align:left;">
               <div style="display:block; width:100%; margin-bottom:14px;">
                 <label style="display:block; font-size:11px; font-weight:bold; opacity:0.7;">Valor recebido agora (R$)</label>
                 <input id="sw-valor-fiado" type="number" min="0.01" step="0.01" class="swal2-input" value="${saldoAtual.toFixed(2)}" style="display:block; width:100%; box-sizing:border-box; margin:4px 0 0;">
               </div>
               <div style="display:block; width:100%;">
                 <label style="display:block; font-size:11px; font-weight:bold; opacity:0.7;">Forma de recebimento</label>
                 <select id="sw-forma-fiado" class="swal2-select" style="display:block; width:100%; box-sizing:border-box; margin:4px 0 0;">
                   <option value="Dinheiro">Dinheiro</option>
                   <option value="Pix">Pix</option>
                   <option value="Cartão">Cartão</option>
                 </select>
               </div>
             </div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const valorInput = document.getElementById('sw-valor-fiado');
        const formaSelect = document.getElementById('sw-forma-fiado');
        const num = Number(valorInput?.value);
        if (!valorInput?.value || isNaN(num) || num <= 0) {
          Swal.showValidationMessage('Digite um valor válido maior que zero.');
          return false;
        }
        if (num > saldoAtual + 0.001) {
          Swal.showValidationMessage(`O valor não pode ser maior que o saldo devedor (${formatarMoeda(saldoAtual)}).`);
          return false;
        }
        return { valor: num, forma: formaSelect?.value || 'Dinheiro' };
      }
    });

    if (!dadosPagamento) return;

    const valorPagoAgora = dadosPagamento.valor;
    const novoValorPago = Number(item.valorPago || 0) + valorPagoAgora;
    const novoSaldo = Math.max(0, saldoAtual - valorPagoAgora);
    const novoStatus = novoSaldo <= 0.005 ? 'Quitado' : 'Aberto';

    try {
      await updateDoc(doc(db, "fiados", item.id), {
        valorPago: novoValorPago,
        saldo: novoSaldo,
        status: novoStatus,
        pagamentos: [...(item.pagamentos || []), {
          valor: valorPagoAgora,
          forma: dadosPagamento.forma,
          data: new Date().toISOString()
        }],
        ...(novoStatus === 'Quitado' && { dataQuitacao: new Date().toISOString() })
      });
      toast.success(novoStatus === 'Quitado' ? `Fiado de ${item.clienteNome} quitado!` : 'Pagamento registrado!');
    } catch (erro) {
      console.error("Erro ao registrar pagamento:", erro);
      toast.error("Erro ao registrar o pagamento.");
    }
  };

  const fiadosFiltrados = fiados
    .filter(f => mostrarQuitados ? true : f.status !== 'Quitado')
    .filter(f => (f.clienteNome || '').toLowerCase().includes(busca.toLowerCase()));

  const emAberto = fiados.filter(f => f.status !== 'Quitado');
  const totalEmAberto = emAberto.reduce((acc, f) => acc + Number(f.saldo || 0), 0);
  const clientesComDivida = new Set(emAberto.map(f => f.clienteTelefone || f.clienteNome)).size;

  return (
    <div className="animate-in fade-in duration-500 pb-20">

      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--cor-texto-principal)]">
          Contas a <span className="text-[var(--cor-primaria)]">Receber</span>
        </h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="p-6 rounded-3xl border shadow-sm bg-[var(--cor-card)] border-[var(--cor-borda)] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Wallet size={100} />
          </div>
          <p className="text-xs uppercase font-black opacity-50 mb-2 text-[var(--cor-texto-secundario)]">Total em Aberto (Fiado)</p>
          <h2 className="text-4xl font-black text-orange-500">{formatarMoeda(totalEmAberto)}</h2>
        </div>

        <div className="p-6 rounded-3xl border shadow-sm bg-[var(--cor-card)] border-[var(--cor-borda)]">
          <p className="text-xs uppercase font-black opacity-50 mb-2 text-[var(--cor-texto-secundario)]">Clientes Devendo</p>
          <h2 className="text-4xl font-black text-[var(--cor-texto-principal)]">{clientesComDivida}</h2>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-[var(--cor-texto-secundario)]" />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-[var(--cor-card)] border border-[var(--cor-borda)] pl-11 pr-4 py-3 rounded-xl text-[var(--cor-texto-principal)] outline-none focus:border-[var(--cor-primaria)] font-bold transition-all shadow-lg"
          />
        </div>

        <button
          onClick={() => setMostrarQuitados(!mostrarQuitados)}
          className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap"
          style={{
            backgroundColor: mostrarQuitados ? 'var(--cor-primaria)' : 'transparent',
            borderColor: mostrarQuitados ? 'var(--cor-primaria)' : 'var(--cor-borda)',
            color: mostrarQuitados ? '#fff' : 'var(--cor-texto-secundario)'
          }}
        >
          {mostrarQuitados ? '✓ Mostrando Quitados' : 'Mostrar Quitados'}
        </button>
      </div>

      {/* LISTA */}
      <div className="bg-[var(--cor-card)] rounded-3xl border border-[var(--cor-borda)] overflow-hidden shadow-2xl">
        {carregando ? (
          <Carregando tela={false} label="Carregando contas a receber..." />
        ) : fiadosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-[var(--cor-texto-secundario)] font-bold uppercase italic">
            {busca
              ? `Nenhum resultado para "${busca}".`
              : mostrarQuitados
                ? 'Nenhum fiado registrado ainda.'
                : 'Nenhuma conta em aberto. 🎉'}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--cor-borda)' }}>
            {fiadosFiltrados.map(item => {
              const quitado = item.status === 'Quitado';
              const qtdPagamentos = (item.pagamentos || []).length;
              return (
                <div key={item.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--cor-bg-geral)] transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: quitado ? 'rgba(34, 197, 94, 0.1)' : 'rgba(249, 115, 22, 0.1)' }}
                    >
                      {quitado ? <CheckCircle2 className="text-green-500" size={20} /> : <Clock className="text-orange-500" size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black uppercase text-sm tracking-tighter truncate text-[var(--cor-texto-principal)]">{item.clienteNome}</p>
                      <p className="text-[10px] font-bold uppercase opacity-50 truncate text-[var(--cor-texto-secundario)]">
                        {item.servico || 'Atendimento'} • {item.barbeiro} • {formatarDataHora(item.dataCriacao)}
                      </p>
                      {qtdPagamentos > 0 && (
                        <p className="text-[9px] font-bold uppercase opacity-40 mt-0.5 text-[var(--cor-texto-secundario)]">
                          {qtdPagamentos} {qtdPagamentos === 1 ? 'pagamento registrado' : 'pagamentos registrados'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase opacity-40 text-[var(--cor-texto-secundario)]">Total</p>
                      <p className="font-bold text-sm text-[var(--cor-texto-principal)]">{formatarMoeda(item.valor)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase opacity-40 text-[var(--cor-texto-secundario)]">Saldo Devedor</p>
                      <p className={`font-black text-lg ${quitado ? 'text-green-500' : 'text-orange-500'}`}>
                        {quitado ? 'Quitado' : formatarMoeda(item.saldo)}
                      </p>
                    </div>
                    {!quitado && (
                      <button
                        onClick={() => registrarPagamento(item)}
                        className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all hover:opacity-90 shadow-lg whitespace-nowrap"
                        style={{ backgroundColor: 'var(--cor-primaria)' }}
                      >
                        Registrar Pagamento
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
