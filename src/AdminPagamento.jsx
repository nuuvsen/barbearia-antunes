import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Smartphone, Receipt, Percent, CheckCircle, ExternalLink } from 'lucide-react';

export default function AdminPagamento({ agendamento, onClose, onConfirm }) {
  const [metodo, setMetodo] = useState('Pix');
  const [desconto, setDesconto] = useState(0);
  const [valorFinal, setValorFinal] = useState(0);

  const isPlano = agendamento.preco === 'PLANO ATIVO' || agendamento.preco === 'INCLUSO NO PLANO';

  const converterPrecoParaNumero = (precoStr) => {
    if (isPlano) return 0;
    return parseFloat(precoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  };

  const valorOriginal = converterPrecoParaNumero(agendamento.preco);

  useEffect(() => {
    if (isPlano) {
      setValorFinal(0);
      setMetodo('Plano VIP');
    } else {
      setValorFinal(Math.max(0, valorOriginal - desconto));
    }
  }, [desconto, valorOriginal, isPlano]);

  const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // ==========================================
  // FUNÇÃO DO PULO DO GATO (DEEP LINK)
  // ==========================================
  const abrirMaquininha = () => {
    // Formata o valor para o padrão que as APIs aceitam (ex: 50.00)
    const valorFormatado = valorFinal.toFixed(2);
    const descricao = `Corte: ${agendamento.servico}`;
    
    // URL para integração com Mercado Pago Point (via App)
    // Nota: Essa é uma URL padrão de Intent para Android
    const urlMP = `mercadopago://payment?amount=${valorFormatado}&description=${descricao}&external_id=${agendamento.id}`;

    // Tenta abrir o app
    window.location.href = urlMP;

    // Caso o app não abra em 2 segundos, você pode avisar o usuário
    setTimeout(() => {
        console.log("Se o app não abriu, verifique se o Mercado Pago está instalado.");
    }, 2000);
  };

  const enviarReciboWhatsApp = () => {
    const textoValor = isPlano ? "Coberto pelo Plano VIP" : formatarMoeda(valorFinal);
    const mensagem = encodeURIComponent(
      `*RECIBO - ANTUNES BARBEARIA*\n\n` +
      `Olá, *${agendamento.clienteNome}*!\n` +
      `Confirmamos o seu atendimento:\n\n` +
      `✂️ *Serviço:* ${agendamento.servico}\n` +
      `💰 *Valor:* ${textoValor}\n` +
      `📅 *Data:* ${agendamento.data}\n\n` +
      `Obrigado pela preferência! Até a próxima.`
    );
    window.open(`https://wa.me/55${agendamento.clienteTelefone.replace(/\D/g, '')}?text=${mensagem}`, '_blank');
  };

  if (!agendamento) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
        
        {/* Lado Esquerdo: Resumo */}
        <div className="p-8 bg-[#111] md:w-5/12 border-b md:border-b-0 md:border-r border-[#1f1f1f] flex flex-col justify-center items-center text-center">
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">Resumo do Cliente</p>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${isPlano ? 'bg-green-600/10 border-green-600/20' : 'bg-red-600/10 border-red-600/20'}`}>
                {isPlano ? <CheckCircle className="text-green-500" size={30} /> : <Receipt className="text-red-600" size={30} />}
            </div>
            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter truncate w-full px-2">{agendamento.clienteNome}</h3>
            <p className="text-xs text-gray-400 mt-1 uppercase font-bold">{agendamento.servico}</p>
            <div className="mt-8 pt-6 border-t border-[#1f1f1f] w-full">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Valor do Serviço</p>
                <p className={`text-xl font-bold ${isPlano ? 'text-green-500' : 'text-gray-300'}`}>
                  {isPlano ? 'COBERTO PELO PLANO' : agendamento.preco}
                </p>
            </div>
        </div>

        {/* Lado Direito: Ações de Pagamento */}
        <div className="p-8 md:w-7/12 flex flex-col space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black uppercase italic text-white">Fluxo de <span className="text-red-600">Caixa</span></h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={24} /></button>
          </div>

          {!isPlano ? (
            <>
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black mb-3 block">Forma de Recebimento</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Pix', 'Dinheiro', 'Cartão'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetodo(m)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all font-black uppercase text-[10px] ${
                        metodo === m 
                        ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20 scale-105' 
                        : 'bg-[#161616] border-[#222] text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      {m === 'Pix' && <Smartphone size={18} />}
                      {m === 'Dinheiro' && <DollarSign size={18} />}
                      {m === 'Cartão' && <CreditCard size={18} />}
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <label className="text-[10px] text-gray-500 uppercase font-black mb-2 block">Dar Desconto (R$)</label>
                <div className="relative">
                    <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <input 
                        type="number"
                        value={desconto}
                        onChange={(e) => setDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#161616] border border-[#222] rounded-2xl py-4 pl-12 pr-4 text-white font-black outline-none focus:border-red-600 transition-all placeholder:text-gray-800"
                        placeholder="0,00"
                    />
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 bg-green-600/5 border border-green-600/10 rounded-3xl flex flex-col items-center justify-center text-center">
               <CheckCircle className="text-green-500 mb-2" size={24} />
               <p className="text-white font-black uppercase italic text-lg tracking-tighter">Cliente VIP</p>
               <p className="text-[10px] text-gray-500 uppercase font-bold">O crédito será debitado do plano</p>
            </div>
          )}

          <div className={`${isPlano ? 'bg-green-600/10' : 'bg-green-600/5'} border border-green-600/20 p-5 rounded-3xl text-center`}>
            <p className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">
              {isPlano ? 'Status' : 'Total a Receber'}
            </p>
            <p className="text-3xl font-black text-white tracking-tighter uppercase italic">
              {isPlano ? 'Liberado' : formatarMoeda(valorFinal)}
            </p>
          </div>

          {/* AÇÕES DE FINALIZAÇÃO */}
          <div className="space-y-2 pt-2">
            
            {/* BOTÃO MÁGICO: Só aparece para Cartão ou Pix e se não for plano */}
            {!isPlano && (metodo === 'Cartão' || metodo === 'Pix') && (
                <button 
                    onClick={abrirMaquininha}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-blue-900/20"
                >
                    <ExternalLink size={16} /> Abrir na Maquininha (MP)
                </button>
            )}

            <button 
              onClick={() => onConfirm(agendamento.id, { metodo, desconto, valorFinal, isPlano })}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest transition-all shadow-xl shadow-red-900/20 active:scale-95"
            >
              Finalizar no Sistema
            </button>
            
            <button 
              onClick={enviarReciboWhatsApp}
              className="w-full bg-transparent border border-green-600/30 text-green-500 font-black py-3 rounded-2xl uppercase tracking-widest hover:bg-green-600/10 transition-all text-[10px] flex items-center justify-center gap-2"
            >
              <Smartphone size={14} /> Enviar Comprovante (Whats)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}