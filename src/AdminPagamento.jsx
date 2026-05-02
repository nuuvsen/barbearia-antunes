import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { doc, getDoc } from 'firebase/firestore';
import { X, DollarSign, CreditCard, Smartphone, Receipt, Percent, CheckCircle, ExternalLink } from 'lucide-react';

export default function AdminPagamento({ agendamento, onClose, onConfirm }) {
  const [metodo, setMetodo] = useState('Pix');
  const [desconto, setDesconto] = useState(0);
  const [valorFinal, setValorFinal] = useState(0);
  
  // Inicializamos como null para evitar o flash das cores padrão
  const [cores, setCores] = useState(null);

  const isPlano = agendamento?.preco === 'PLANO ATIVO' || agendamento?.preco === 'INCLUSO NO PLANO';

  useEffect(() => {
    const buscarCores = async () => {
      try {
        const docRef = doc(db, "configuracoes", "personalizacao");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const dados = docSnap.data();
          if (dados.cores) {
            setCores(dados.cores);
          }
        } else {
          // Fallback silencioso caso o documento não exista no Firebase
          // para o sistema não travar, mas você pode remover se quiser rigor total
          console.warn("Configurações de cores não encontradas no Firebase.");
        }
      } catch (error) {
        console.error("Erro ao buscar cores:", error);
      }
    };

    buscarCores();
  }, []);

  const converterPrecoParaNumero = (precoStr) => {
    if (isPlano) return 0;
    if (typeof precoStr === 'number') return precoStr;
    if (!precoStr) return 0;
    return parseFloat(precoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  };

  const valorOriginal = converterPrecoParaNumero(agendamento?.preco);

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

  const abrirMaquininha = () => {
    const valorFormatado = valorFinal.toFixed(2);
    const descricao = `Corte: ${agendamento.servico}`;
    const urlMP = `mercadopago://payment?amount=${valorFormatado}&description=${descricao}&external_id=${agendamento.id}`;
    window.location.href = urlMP;
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
    window.open(`https://wa.me/55${agendamento.clienteTelefone?.replace(/\D/g, '')}?text=${mensagem}`, '_blank');
  };

  // Se as cores ainda não carregaram ou não há agendamento, não renderiza nada
  // Isso impede que o usuário veja as cores "antigas" ou componentes sem estilo
  if (!cores || !agendamento) return null;

  return (
    // ANIMAÇÃO AQUI: z-[70], slide-in-from-bottom-12, zoom-in-95 e ease-out
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in slide-in-from-bottom-12 zoom-in-95 duration-300 ease-out">
      <div 
        className="border w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
        style={{ backgroundColor: cores.fundo, borderColor: cores.borda }}
      >
        
        {/* Lado Esquerdo: Resumo */}
        <div 
          className="p-8 md:w-5/12 border-b md:border-b-0 md:border-r flex flex-col justify-center items-center text-center"
          style={{ backgroundColor: cores.card, borderColor: cores.borda }}
        >
            <p className="text-[10px] uppercase font-black tracking-widest mb-4" style={{ color: cores.textoSecundario }}>Resumo do Cliente</p>
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border"
              style={{ 
                backgroundColor: isPlano ? 'rgba(34, 197, 94, 0.1)' : `${cores.primaria}1a`, 
                borderColor: isPlano ? 'rgba(34, 197, 94, 0.2)' : `${cores.primaria}33` 
              }}
            >
                {isPlano ? <CheckCircle className="text-green-500" size={30} /> : <Receipt style={{ color: cores.primaria }} size={30} />}
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter truncate w-full px-2" style={{ color: cores.texto }}>
              {agendamento.clienteNome}
            </h3>
            <p className="text-xs mt-1 uppercase font-bold" style={{ color: cores.textoSecundario }}>{agendamento.servico}</p>
            
            <div className="mt-8 pt-6 border-t w-full" style={{ borderColor: cores.borda }}>
                <p className="text-[10px] uppercase font-black mb-1" style={{ color: cores.textoSecundario }}>Valor do Serviço</p>
                <p className="text-xl font-bold" style={{ color: isPlano ? '#22c55e' : cores.texto }}>
                  {isPlano ? 'COBERTO PELO PLANO' : formatarMoeda(valorOriginal)}
                </p>
            </div>
        </div>

        {/* Lado Direito: Ações de Pagamento */}
        <div className="p-8 md:w-7/12 flex flex-col space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black uppercase italic" style={{ color: cores.texto }}>
              Fluxo de <span style={{ color: cores.primaria }}>Caixa</span>
            </h2>
            <button onClick={onClose} className="hover:opacity-70 transition-opacity" style={{ color: cores.textoSecundario }}>
              <X size={24} />
            </button>
          </div>

          {!isPlano ? (
            <>
              <div>
                <label className="text-[10px] uppercase font-black mb-3 block" style={{ color: cores.textoSecundario }}>Forma de Recebimento</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Pix', 'Dinheiro', 'Cartão'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetodo(m)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all font-black uppercase text-[10px] ${
                        metodo === m ? 'text-white shadow-lg scale-105' : 'hover:border-gray-600'
                      }`}
                      style={{ 
                        backgroundColor: metodo === m ? cores.primaria : 'rgba(255,255,255,0.05)',
                        borderColor: metodo === m ? cores.primaria : cores.borda,
                        color: metodo === m ? '#fff' : cores.textoSecundario
                      }}
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
                <label className="text-[10px] uppercase font-black mb-2 block" style={{ color: cores.textoSecundario }}>Dar Desconto (R$)</label>
                <div className="relative">
                    <Percent className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: cores.textoSecundario }} size={16} />
                    <input 
                        type="number"
                        value={desconto}
                        onChange={(e) => setDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full rounded-2xl py-4 pl-12 pr-4 font-black outline-none transition-all"
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${cores.borda}`, color: cores.texto }}
                        placeholder="0,00"
                    />
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 bg-green-600/5 border border-green-600/10 rounded-3xl flex flex-col items-center justify-center text-center">
               <CheckCircle className="text-green-500 mb-2" size={24} />
               <p className="font-black uppercase italic text-lg tracking-tighter" style={{ color: cores.texto }}>Cliente VIP</p>
               <p className="text-[10px] uppercase font-bold" style={{ color: cores.textoSecundario }}>O crédito será debitado do plano</p>
            </div>
          )}

          <div 
            className="border p-5 rounded-3xl text-center"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.2)' }}
          >
            <p className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">
              {isPlano ? 'Status' : 'Total a Receber'}
            </p>
            <p className="text-3xl font-black tracking-tighter uppercase italic" style={{ color: cores.texto }}>
              {isPlano ? 'Liberado' : formatarMoeda(valorFinal)}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            {!isPlano && (metodo === 'Cartão' || metodo === 'Pix') && (
                <button 
                    onClick={abrirMaquininha}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-xs"
                >
                    <ExternalLink size={16} /> Abrir na Maquininha (MP)
                </button>
            )}

            <button 
              onClick={() => onConfirm(agendamento.id, { 
                metodo, 
                desconto, 
                valorFinal, 
                isPlano 
              })}
              className="w-full text-white font-black py-5 rounded-2xl uppercase tracking-widest transition-all shadow-xl active:scale-95"
              style={{ backgroundColor: cores.primaria }}
            >
              Finalizar no Sistema
            </button>
            
            <button 
              onClick={enviarReciboWhatsApp}
              className="w-full bg-transparent border text-green-500 font-black py-3 rounded-2xl uppercase tracking-widest hover:bg-green-600/10 transition-all text-[10px] flex items-center justify-center gap-2"
              style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}
            >
              <Smartphone size={14} /> Enviar Comprovante (Whats)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}