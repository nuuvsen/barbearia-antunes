import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { X, Plus, Trash2, ShoppingBag, Scissors, User } from 'lucide-react';

export default function Comanda({ onClose, onAbrirPagamento, configCores }) {
  const [barbeiros, setBarbeiros] = useState([]);
  const [servicosDisponiveis, setServicosDisponiveis] = useState([]);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);

  // Estado da Comanda
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [itensSelecionados, setItensSelecionados] = useState([]);

  // 1. Carregar dados do Firebase
  useEffect(() => {
    const unsubB = onSnapshot(query(collection(db, "barbeiros")), (snap) => {
      setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubS = onSnapshot(query(collection(db, "servicos")), (snap) => {
      setServicosDisponiveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubP = onSnapshot(query(collection(db, "produtos")), (snap) => {
      setProdutosDisponiveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubB(); unsubS(); unsubP(); };
  }, []);

  const adicionarItem = (item, tipo) => {
    setItensSelecionados([...itensSelecionados, { ...item, tipo, idInstancia: Date.now() }]);
  };

  const removerItem = (idInstancia) => {
    setItensSelecionados(itensSelecionados.filter(item => item.idInstancia !== idInstancia));
  };

  // Cálculo do total com tratamento de erros
  const totalGeral = itensSelecionados.reduce((acc, item) => {
    let valorItem = item.preco || 0;

    if (typeof valorItem === 'string') {
      valorItem = valorItem.replace(',', '.'); 
      valorItem = valorItem.replace(/[^0-9.]/g, ''); 
    }

    return acc + (Number(valorItem) || 0);
  }, 0);

  const handleFinalizarComanda = () => {
    // Validação básica
    if (!clienteNome.trim()) {
      alert("Por favor, digite o nome do cliente.");
      return;
    }
    if (!barbeiroSelecionado) {
      alert("Por favor, selecione um barbeiro.");
      return;
    }
    if (itensSelecionados.length === 0) {
      alert("Adicione pelo menos um serviço ou produto.");
      return;
    }

    try {
      // Prepara o objeto garantindo que campos de texto não sejam undefined
      // e o preço seja enviado como String caso o AdminPagamento tente usar .replace()
      const dadosPagamento = {
        clienteNome: clienteNome,
        barbeiro: barbeiroSelecionado,
        servico: itensSelecionados.filter(i => i.tipo === 'servico').map(i => i.nome).join(', ') || 'Nenhum',
        produtos: itensSelecionados.filter(i => i.tipo === 'produto').map(i => i.nome).join(', ') || 'Nenhum',
        valorTotal: totalGeral, // Mantém o número para cálculos
        preco: totalGeral.toFixed(2).replace('.', ','), // Envia formatado para evitar erro de .replace no próximo componente
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'Pendente'
      };

      // Chama a função passada por prop
      onAbrirPagamento(dadosPagamento);
    } catch (error) {
      console.error("Erro ao processar comanda:", error);
      alert("Ocorreu um erro ao avançar para o pagamento.");
    }
  };

  return (
    // Aqui foi adicionado o zoom-in-95 para a animação de entrada suave
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
      <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[600px]"
           style={{ backgroundColor: configCores?.fundo || '#ffffff' }}>
        
        {/* LADO ESQUERDO: SELEÇÃO */}
        <div className="flex-1 p-6 overflow-y-auto border-r custom-scrollbar" style={{ borderColor: configCores?.borda || '#eeeeee' }}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black uppercase italic" style={{ color: configCores?.texto || '#000' }}>
              Nova <span style={{ color: configCores?.primaria || '#16a34a' }}>Comanda</span>
            </h2>
          </div>

          {/* INPUTS BÁSICOS */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="text-[10px] font-black uppercase opacity-50 ml-2">Nome do Cliente</label>
              <input 
                type="text" 
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full p-4 rounded-2xl border outline-none font-bold focus:ring-2 transition-all"
                style={{ borderColor: configCores?.borda, ringColor: configCores?.primaria }}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase opacity-50 ml-2">Selecione o Barbeiro</label>
              <select 
                value={barbeiroSelecionado}
                onChange={(e) => setBarbeiroSelecionado(e.target.value)}
                className="w-full p-4 rounded-2xl border outline-none font-bold appearance-none bg-white transition-all"
                style={{ borderColor: configCores?.borda }}
              >
                <option value="">Escolha um profissional...</option>
                {barbeiros.map(b => <option key={b.id} value={b.nome}>{b.nome}</option>)}
              </select>
            </div>
          </div>

          {/* SELEÇÃO DE SERVIÇOS */}
          <h3 className="flex items-center gap-2 text-sm font-black uppercase mb-3 opacity-70">
            <Scissors size={16} /> Serviços
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {servicosDisponiveis.map(s => (
              <button key={s.id} onClick={() => adicionarItem(s, 'servico')}
                className="p-3 text-left border rounded-xl hover:brightness-90 active:scale-95 transition-all group">
                <p className="text-xs font-black truncate">{s.nome}</p>
                <p className="text-[10px] font-bold text-green-600">R$ {s.preco}</p>
              </button>
            ))}
          </div>

          {/* SELEÇÃO DE PRODUTOS */}
          <h3 className="flex items-center gap-2 text-sm font-black uppercase mb-3 opacity-70">
            <ShoppingBag size={16} /> Produtos
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {produtosDisponiveis.map(p => (
              <button key={p.id} onClick={() => adicionarItem(p, 'produto')}
                className="p-3 text-left border rounded-xl hover:brightness-90 active:scale-95 transition-all">
                <p className="text-xs font-black truncate">{p.nome}</p>
                <p className="text-[10px] font-bold text-blue-600">R$ {p.preco}</p>
              </button>
            ))}
          </div>
        </div>

        {/* LADO DIREITO: RESUMO E FINALIZAÇÃO */}
        <div className="w-full md:w-[350px] p-6 flex flex-col" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-black uppercase tracking-widest">Resumo</span>
            <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-full text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar">
            {itensSelecionados.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <ShoppingBag size={48} className="mb-2" />
                <p className="text-xs font-bold uppercase">Nenhum item<br/>adicionado</p>
              </div>
            )}
            {itensSelecionados.map((item) => (
              <div key={item.idInstancia} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-black/5 animate-in slide-in-from-right-4">
                <div className="overflow-hidden">
                  <p className="text-[10px] font-black uppercase truncate">{item.nome}</p>
                  <p className="text-[9px] font-bold opacity-50">R$ {item.preco}</p>
                </div>
                <button onClick={() => removerItem(item.idInstancia)} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t pt-4" style={{ borderColor: configCores?.borda }}>
            <div className="flex justify-between items-end mb-4">
              <span className="text-[10px] font-black uppercase opacity-50">Total a Pagar</span>
              <span className="text-3xl font-black transition-all" style={{ color: configCores?.primaria }}>
                R$ {totalGeral.toFixed(2)}
              </span>
            </div>

            <button 
              onClick={handleFinalizarComanda}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-tighter text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: configCores?.primaria || '#16a34a' }}
            >
              Ir para Pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}