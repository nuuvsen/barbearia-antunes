import { useState, useEffect, useMemo } from 'react'
import { db } from './firebase'
import { collection, doc, onSnapshot, setDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'
import { Wallet, Lock, Unlock, CheckCircle2, AlertTriangle, History, Banknote, QrCode, CreditCard } from 'lucide-react'
import Carregando from './Carregando'

const formatarDataISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatarDataBR = (iso) => (iso || '').split('-').reverse().join('/');
const formatarMoeda = (valor) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
const formatarHora = (iso) => {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const extrairNumeroDePreco = (preco) => {
  if (typeof preco === 'number') return preco;
  const valStr = preco?.toString().replace(/\D/g, '') || '0';
  return parseInt(valStr, 10) / 100;
};

export default function AdminCaixa() {
  const [configCores, setConfigCores] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [fiados, setFiados] = useState([]);
  const [caixaHoje, setCaixaHoje] = useState(undefined); // undefined = carregando, null = não existe ainda
  const [historico, setHistorico] = useState([]);
  const [processando, setProcessando] = useState(false);

  const hojeISO = formatarDataISO(new Date());
  const hojePtBR = new Date().toLocaleDateString('pt-BR');

  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (d) => {
      if (d.exists()) setConfigCores(d.data().cores);
    });
    const unsubAg = onSnapshot(collection(db, "agendamentos"), (snap) => {
      setAgendamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCom = onSnapshot(collection(db, "comandas"), (snap) => {
      setComandas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubFiado = onSnapshot(collection(db, "fiados"), (snap) => {
      setFiados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCaixa = onSnapshot(doc(db, "caixas", hojeISO), (d) => {
      setCaixaHoje(d.exists() ? { id: d.id, ...d.data() } : null);
    }, (erro) => {
      console.error("Erro ao carregar caixa de hoje:", erro);
      setCaixaHoje(null);
    });
    const qHist = query(collection(db, "caixas"), orderBy("data", "desc"), limit(15));
    const unsubHist = onSnapshot(qHist, (snap) => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (erro) => {
      console.error("Erro ao carregar histórico de caixa:", erro);
    });
    return () => { unsubCores(); unsubAg(); unsubCom(); unsubFiado(); unsubCaixa(); unsubHist(); };
  }, [hojeISO]);

  // Quanto o SISTEMA registrou hoje, agrupado por forma de pagamento — é isso que o
  // fechamento de caixa compara contra o que o admin conta fisicamente na gaveta.
  // Fiado e Plano VIP não entram aqui porque nenhum dinheiro físico troca de mãos no ato;
  // um recebimento de fiado feito HOJE (de uma dívida antiga) entra, porque aí sim o
  // dinheiro está de fato entrando no caixa agora.
  const valoresSistema = useMemo(() => {
    const totais = { dinheiro: 0, pix: 0, cartao: 0 };
    let qtd = 0;

    const somarPorForma = (forma, valor) => {
      const v = Number(valor) || 0;
      if (forma === 'Dinheiro') totais.dinheiro += v;
      else if (forma === 'Pix') totais.pix += v;
      else if (forma === 'Cartão') totais.cartao += v;
    };

    agendamentos
      .filter(a => a.data === hojeISO && a.status === 'Concluído')
      .forEach(a => {
        qtd++;
        const valor = typeof a.valorFinal === 'number' ? a.valorFinal
          : (typeof a.valorGerado === 'number' ? a.valorGerado : extrairNumeroDePreco(a.preco));
        somarPorForma(a.formaPagamento, valor);
      });

    comandas
      .filter(c => c.data === hojePtBR && c.status === 'Concluído')
      .forEach(c => {
        qtd++;
        const valor = typeof c.valorFinal === 'number' ? c.valorFinal : extrairNumeroDePreco(c.preco);
        somarPorForma(c.formaPagamento, valor);
      });

    let totalFiadoRecebidoHoje = 0;
    fiados.forEach(f => {
      (f.pagamentos || []).forEach(p => {
        if ((p.data || '').startsWith(hojeISO)) {
          totalFiadoRecebidoHoje += Number(p.valor || 0);
          somarPorForma(p.forma || 'Dinheiro', p.valor);
        }
      });
    });

    const total = totais.dinheiro + totais.pix + totais.cartao;
    return { ...totais, total, qtd, totalFiadoRecebidoHoje };
  }, [agendamentos, comandas, fiados, hojeISO, hojePtBR]);

  const abrirCaixa = async () => {
    const { value: valorStr } = await Swal.fire({
      title: 'Abrir Caixa',
      html: `<p style="font-size:12px;opacity:0.6;">Informe o valor inicial (troco) que está na gaveta agora.</p>`,
      input: 'number',
      inputLabel: 'Valor inicial (R$)',
      inputValue: '0',
      inputAttributes: { min: '0', step: '0.01' },
      showCancelButton: true,
      confirmButtonText: 'Abrir Caixa',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (value === '' || isNaN(Number(value)) || Number(value) < 0) return 'Digite um valor válido.';
      }
    });
    if (valorStr === undefined || valorStr === null) return;

    setProcessando(true);
    try {
      await setDoc(doc(db, "caixas", hojeISO), {
        data: hojeISO,
        status: 'aberto',
        abertura: { valorInicial: Number(valorStr), horario: new Date().toISOString() },
        fechamento: null,
      });
      toast.success('Caixa aberto!');
    } catch (erro) {
      console.error("Erro ao abrir caixa:", erro);
      toast.error('Erro ao abrir o caixa.');
    } finally {
      setProcessando(false);
    }
  };

  const fecharCaixa = async () => {
    const campoEstilo = "display:block; width:100%; box-sizing:border-box; margin:4px 0 0;";
    const rotuloEstilo = "display:block; font-size:11px; font-weight:bold; opacity:0.7;";
    const html = `
      <div style="text-align:left; font-size:13px;">
        <div style="display:block; width:100%; margin-bottom:14px;">
          <label style="${rotuloEstilo}">💵 Dinheiro contado (R$)</label>
          <input id="sw-dinheiro" type="number" step="0.01" min="0" class="swal2-input" value="${valoresSistema.dinheiro.toFixed(2)}" style="${campoEstilo}">
        </div>
        <div style="display:block; width:100%; margin-bottom:14px;">
          <label style="${rotuloEstilo}">📲 Pix contado (R$)</label>
          <input id="sw-pix" type="number" step="0.01" min="0" class="swal2-input" value="${valoresSistema.pix.toFixed(2)}" style="${campoEstilo}">
        </div>
        <div style="display:block; width:100%; margin-bottom:14px;">
          <label style="${rotuloEstilo}">💳 Cartão contado (R$)</label>
          <input id="sw-cartao" type="number" step="0.01" min="0" class="swal2-input" value="${valoresSistema.cartao.toFixed(2)}" style="${campoEstilo}">
        </div>
        <div style="display:block; width:100%;">
          <label style="${rotuloEstilo}">Observações</label>
          <textarea id="sw-obs" class="swal2-textarea" placeholder="Opcional" style="${campoEstilo}"></textarea>
        </div>
      </div>`;

    const { value: informado } = await Swal.fire({
      title: 'Fechar Caixa',
      html,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Conferir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const dinheiro = Number(document.getElementById('sw-dinheiro').value);
        const pix = Number(document.getElementById('sw-pix').value);
        const cartao = Number(document.getElementById('sw-cartao').value);
        const observacoes = document.getElementById('sw-obs').value || '';
        if ([dinheiro, pix, cartao].some(v => isNaN(v) || v < 0)) {
          Swal.showValidationMessage('Digite valores válidos em todos os campos.');
          return false;
        }
        return { dinheiro, pix, cartao, observacoes };
      }
    });
    if (!informado) return;

    const diferenca = {
      dinheiro: informado.dinheiro - valoresSistema.dinheiro,
      pix: informado.pix - valoresSistema.pix,
      cartao: informado.cartao - valoresSistema.cartao,
    };
    const totalInformado = informado.dinheiro + informado.pix + informado.cartao;
    const totalSistema = valoresSistema.total;
    const totalDiferenca = totalInformado - totalSistema;

    const corDif = (dif) => Math.abs(dif) < 0.01 ? '#16a34a' : (dif > 0 ? '#2563eb' : '#dc2626');
    const linha = (label, sis, inf, dif) => `
      <tr>
        <td style="padding:6px 10px; text-align:left;">${label}</td>
        <td style="padding:6px 10px; text-align:right;">${formatarMoeda(sis)}</td>
        <td style="padding:6px 10px; text-align:right;">${formatarMoeda(inf)}</td>
        <td style="padding:6px 10px; text-align:right; color:${corDif(dif)}; font-weight:bold;">${dif > 0 ? '+' : ''}${formatarMoeda(dif)}</td>
      </tr>`;

    const resumoHtml = `
      <table style="width:100%; font-size:12px; border-collapse:collapse;">
        <thead><tr style="opacity:0.6;">
          <th style="text-align:left; padding:6px 10px;">Forma</th>
          <th style="text-align:right; padding:6px 10px;">Sistema</th>
          <th style="text-align:right; padding:6px 10px;">Contado</th>
          <th style="text-align:right; padding:6px 10px;">Diferença</th>
        </tr></thead>
        <tbody>
          ${linha('Dinheiro', valoresSistema.dinheiro, informado.dinheiro, diferenca.dinheiro)}
          ${linha('Pix', valoresSistema.pix, informado.pix, diferenca.pix)}
          ${linha('Cartão', valoresSistema.cartao, informado.cartao, diferenca.cartao)}
          <tr style="border-top:1px solid rgba(120,120,120,0.3);">
            <td style="padding:8px 10px; font-weight:bold;">Total</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">${formatarMoeda(totalSistema)}</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">${formatarMoeda(totalInformado)}</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold; color:${corDif(totalDiferenca)};">${totalDiferenca > 0 ? '+' : ''}${formatarMoeda(totalDiferenca)}</td>
          </tr>
        </tbody>
      </table>`;

    const confirmacao = await Swal.fire({
      title: Math.abs(totalDiferenca) < 0.01 ? 'Caixa bate certinho! ✅' : '⚠️ Confirmar fechamento com diferença?',
      html: resumoHtml,
      width: 480,
      showCancelButton: true,
      confirmButtonText: 'Confirmar Fechamento',
      cancelButtonText: 'Voltar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
    });
    if (!confirmacao.isConfirmed) return;

    setProcessando(true);
    try {
      await updateDoc(doc(db, "caixas", hojeISO), {
        status: 'fechado',
        fechamento: {
          horario: new Date().toISOString(),
          valoresInformados: { dinheiro: informado.dinheiro, pix: informado.pix, cartao: informado.cartao },
          valoresSistema: { dinheiro: valoresSistema.dinheiro, pix: valoresSistema.pix, cartao: valoresSistema.cartao },
          diferenca,
          totalInformado,
          totalSistema,
          totalDiferenca,
          qtdAtendimentos: valoresSistema.qtd,
          observacoes: informado.observacoes,
        }
      });
      toast.success('Caixa fechado com sucesso!');
    } catch (erro) {
      console.error("Erro ao fechar caixa:", erro);
      toast.error('Erro ao fechar o caixa.');
    } finally {
      setProcessando(false);
    }
  };

  const reabrirCaixa = async () => {
    const resultado = await Swal.fire({
      title: 'Reabrir o caixa de hoje?',
      text: 'O último fechamento fica salvo no histórico, mas o caixa volta a ficar aberto para lançamentos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, reabrir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6b7280',
    });
    if (!resultado.isConfirmed) return;

    setProcessando(true);
    try {
      await updateDoc(doc(db, "caixas", hojeISO), { status: 'aberto' });
      toast.success('Caixa reaberto.');
    } catch (erro) {
      console.error("Erro ao reabrir caixa:", erro);
      toast.error('Erro ao reabrir o caixa.');
    } finally {
      setProcessando(false);
    }
  };

  const corTexto = configCores?.texto || 'var(--cor-texto-principal)';
  const corTextoSecundario = configCores?.textoSecundario || 'var(--cor-texto-secundario)';
  const corCard = configCores?.card || 'var(--cor-card)';
  const corBorda = configCores?.borda || 'var(--cor-borda)';
  const corPrimaria = configCores?.primaria || 'var(--cor-primaria)';
  const corFundo = configCores?.fundo || 'var(--cor-input-bg)';

  if (caixaHoje === undefined) {
    return <Carregando tela={false} label="Carregando caixa..." />;
  }

  const estaAberto = caixaHoje?.status === 'aberto';
  const estaFechado = caixaHoje?.status === 'fechado';

  const CardValor = ({ icone: Icone, label, valor }) => (
    <div className="p-6 rounded-3xl border shadow-sm relative overflow-hidden" style={{ backgroundColor: corCard, borderColor: corBorda }}>
      <div className="absolute -right-4 -top-4 opacity-5"><Icone size={100} /></div>
      <p className="text-xs uppercase font-black opacity-50 mb-2" style={{ color: corTextoSecundario }}>{label}</p>
      <h2 className="text-3xl font-black" style={{ color: corTexto }}>{formatarMoeda(valor)}</h2>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: corTexto }}>
          Controle de <span style={{ color: corPrimaria }}>Caixa</span>
        </h1>

        {caixaHoje === null && (
          <button onClick={abrirCaixa} disabled={processando}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all hover:opacity-90 shadow-lg disabled:opacity-50"
            style={{ backgroundColor: corPrimaria }}>
            <Unlock size={16} /> Abrir Caixa
          </button>
        )}
        {estaAberto && (
          <button onClick={fecharCaixa} disabled={processando}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all hover:opacity-90 shadow-lg disabled:opacity-50 bg-red-600">
            <Lock size={16} /> Fechar Caixa
          </button>
        )}
        {estaFechado && (
          <button onClick={reabrirCaixa} disabled={processando}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all hover:opacity-90 shadow-lg disabled:opacity-50 border"
            style={{ borderColor: corBorda, color: corTextoSecundario }}>
            <History size={16} /> Reabrir Caixa
          </button>
        )}
      </div>

      {caixaHoje === null && (
        <div className="p-10 rounded-3xl border text-center shadow-sm" style={{ backgroundColor: corCard, borderColor: corBorda }}>
          <Wallet size={40} className="mx-auto mb-4 opacity-30" style={{ color: corTexto }} />
          <p className="font-black uppercase italic" style={{ color: corTextoSecundario }}>
            O caixa de hoje ({formatarDataBR(hojeISO)}) ainda não foi aberto.
          </p>
        </div>
      )}

      {caixaHoje && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${estaAberto ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10'}`}
              style={estaFechado ? { color: corTextoSecundario } : undefined}>
              {estaAberto ? '● Caixa Aberto' : '● Caixa Fechado'}
            </span>
            <span className="text-xs font-bold opacity-50" style={{ color: corTextoSecundario }}>
              Aberto às {formatarHora(caixaHoje.abertura?.horario)} com troco inicial de {formatarMoeda(caixaHoje.abertura?.valorInicial)}
            </span>
          </div>

          <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: corTextoSecundario }}>
            {estaAberto ? 'Valores do sistema até agora (hoje)' : 'Valores do sistema no momento do fechamento'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <CardValor icone={Banknote} label="Dinheiro" valor={estaFechado ? caixaHoje.fechamento?.valoresSistema?.dinheiro : valoresSistema.dinheiro} />
            <CardValor icone={QrCode} label="Pix" valor={estaFechado ? caixaHoje.fechamento?.valoresSistema?.pix : valoresSistema.pix} />
            <CardValor icone={CreditCard} label="Cartão" valor={estaFechado ? caixaHoje.fechamento?.valoresSistema?.cartao : valoresSistema.cartao} />
          </div>

          {estaAberto && valoresSistema.totalFiadoRecebidoHoje > 0 && (
            <p className="text-xs font-bold opacity-60 mb-6" style={{ color: corTextoSecundario }}>
              Inclui {formatarMoeda(valoresSistema.totalFiadoRecebidoHoje)} recebidos hoje de fiados em aberto.
            </p>
          )}

          <div className="p-6 rounded-3xl border shadow-sm mb-10" style={{ backgroundColor: corCard, borderColor: corBorda }}>
            <p className="text-xs uppercase font-black opacity-50 mb-1" style={{ color: corTextoSecundario }}>
              {estaAberto ? 'Total (sistema)' : 'Total geral'}
            </p>
            <h2 className="text-4xl font-black" style={{ color: corPrimaria }}>
              {formatarMoeda(estaFechado ? caixaHoje.fechamento?.totalSistema : valoresSistema.total)}
            </h2>
            <p className="text-[10px] font-bold uppercase opacity-40 mt-2" style={{ color: corTextoSecundario }}>
              {estaFechado ? caixaHoje.fechamento?.qtdAtendimentos : valoresSistema.qtd} atendimento(s) concluído(s) hoje
            </p>
          </div>

          {estaFechado && caixaHoje.fechamento && (
            <div className="rounded-3xl border overflow-hidden shadow-xl mb-10" style={{ backgroundColor: corCard, borderColor: corBorda }}>
              <div className="p-6 border-b flex items-center gap-3" style={{ borderColor: corBorda }}>
                {Math.abs(caixaHoje.fechamento.totalDiferenca) < 0.01
                  ? <CheckCircle2 className="text-green-500" size={22} />
                  : <AlertTriangle className="text-red-500" size={22} />}
                <h3 className="font-black uppercase italic" style={{ color: corTexto }}>
                  Conferência do Fechamento ({formatarHora(caixaHoje.fechamento.horario)})
                </h3>
              </div>
              <table className="w-full text-left">
                <thead style={{ backgroundColor: corFundo }}>
                  <tr className="text-[10px] uppercase font-black" style={{ color: corTextoSecundario }}>
                    <th className="p-4">Forma</th>
                    <th className="p-4 text-right">Sistema</th>
                    <th className="p-4 text-right">Contado</th>
                    <th className="p-4 text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {['dinheiro', 'pix', 'cartao'].map(chave => {
                    const dif = caixaHoje.fechamento.diferenca?.[chave] || 0;
                    const cor = Math.abs(dif) < 0.01 ? 'text-green-500' : (dif > 0 ? 'text-blue-500' : 'text-red-500');
                    return (
                      <tr key={chave} className="border-b" style={{ borderColor: corBorda }}>
                        <td className="p-4 font-bold capitalize" style={{ color: corTexto }}>{chave === 'cartao' ? 'Cartão' : chave}</td>
                        <td className="p-4 text-right" style={{ color: corTexto }}>{formatarMoeda(caixaHoje.fechamento.valoresSistema?.[chave])}</td>
                        <td className="p-4 text-right" style={{ color: corTexto }}>{formatarMoeda(caixaHoje.fechamento.valoresInformados?.[chave])}</td>
                        <td className={`p-4 text-right font-black ${cor}`}>{dif > 0 ? '+' : ''}{formatarMoeda(dif)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="p-4 font-black" style={{ color: corTexto }}>Total</td>
                    <td className="p-4 text-right font-black" style={{ color: corTexto }}>{formatarMoeda(caixaHoje.fechamento.totalSistema)}</td>
                    <td className="p-4 text-right font-black" style={{ color: corTexto }}>{formatarMoeda(caixaHoje.fechamento.totalInformado)}</td>
                    <td className={`p-4 text-right font-black ${Math.abs(caixaHoje.fechamento.totalDiferenca) < 0.01 ? 'text-green-500' : (caixaHoje.fechamento.totalDiferenca > 0 ? 'text-blue-500' : 'text-red-500')}`}>
                      {caixaHoje.fechamento.totalDiferenca > 0 ? '+' : ''}{formatarMoeda(caixaHoje.fechamento.totalDiferenca)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {caixaHoje.fechamento.observacoes && (
                <div className="p-4 text-xs font-bold" style={{ color: corTextoSecundario, borderTop: `1px solid ${corBorda}` }}>
                  Obs: {caixaHoje.fechamento.observacoes}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* HISTÓRICO */}
      <h2 className="text-xl font-black mb-4 uppercase italic flex items-center gap-2" style={{ color: corTexto }}>
        <History size={20} style={{ color: corPrimaria }} /> Histórico de Fechamentos
      </h2>
      <div className="rounded-3xl border overflow-hidden shadow-xl" style={{ backgroundColor: corCard, borderColor: corBorda }}>
        {historico.length === 0 ? (
          <div className="p-10 text-center font-bold uppercase italic" style={{ color: corTextoSecundario }}>
            Nenhum caixa fechado ainda.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead style={{ backgroundColor: corFundo }}>
              <tr className="text-[10px] uppercase font-black" style={{ color: corTextoSecundario }}>
                <th className="p-4">Data</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Total Sistema</th>
                <th className="p-4 text-right">Total Contado</th>
                <th className="p-4 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {historico.map(c => {
                const fech = c.fechamento;
                const dif = fech?.totalDiferenca;
                const corDif = dif == null ? corTextoSecundario : (Math.abs(dif) < 0.01 ? '#16a34a' : (dif > 0 ? '#2563eb' : '#dc2626'));
                return (
                  <tr key={c.id} className="border-b" style={{ borderColor: corBorda }}>
                    <td className="p-4 font-bold" style={{ color: corTexto }}>{formatarDataBR(c.data)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${c.status === 'aberto' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10'}`}
                        style={c.status !== 'aberto' ? { color: corTextoSecundario } : undefined}>
                        {c.status === 'aberto' ? 'Aberto' : 'Fechado'}
                      </span>
                    </td>
                    <td className="p-4 text-right" style={{ color: corTexto }}>{fech ? formatarMoeda(fech.totalSistema) : '--'}</td>
                    <td className="p-4 text-right" style={{ color: corTexto }}>{fech ? formatarMoeda(fech.totalInformado) : '--'}</td>
                    <td className="p-4 text-right font-black" style={{ color: corDif }}>{fech ? `${dif > 0 ? '+' : ''}${formatarMoeda(dif)}` : '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
