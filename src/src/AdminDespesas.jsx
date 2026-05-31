import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Trash2, Calendar, TrendingDown, DollarSign } from 'lucide-react';

export default function AdminDespesas() {
  const [configCores, setConfigCores] = useState(null);
  
  // Controle de datas e formulário
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const dataAtual = new Date();
    return `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataDespesa, setDataDespesa] = useState(new Date().toISOString().split('T')[0]);
  
  const [despesas, setDespesas] = useState([]);
  const [totalDespesas, setTotalDespesas] = useState(0);

  // 1. Busca Cores
  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) setConfigCores(docSnap.data().cores);
    });
    return () => unsubCores();
  }, []);

  // 2. Busca Despesas do Mês Selecionado
  useEffect(() => {
    const q = query(collection(db, "despesas"), where("mesReferencia", "==", mesSelecionado));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaDespesas = [];
      let soma = 0;
      
      snapshot.forEach((documento) => {
        const dados = documento.data();
        listaDespesas.push({ id: documento.id, ...dados });
        soma += Number(dados.valor || 0);
      });
      
      // Ordena da mais recente para a mais antiga
      listaDespesas.sort((a, b) => b.data.localeCompare(a.data));
      
      setDespesas(listaDespesas);
      setTotalDespesas(soma);
    });

    return () => unsubscribe();
  }, [mesSelecionado]);

  // 3. Adicionar Nova Despesa
  const salvarDespesa = async (e) => {
    e.preventDefault();
    if (!descricao.trim() || !valor) return alert("Preencha a descrição e o valor.");

    try {
      // Extrai o ano e o mês da data selecionada para o filtro (YYYY-MM)
      const mesReferencia = dataDespesa.substring(0, 7); 
      
      const novaDespesa = {
        descricao,
        valor: Number(valor),
        data: dataDespesa,
        mesReferencia: mesReferencia,
        dataCriacao: new Date().toISOString()
      };

      await addDoc(collection(db, "despesas"), novaDespesa);
      
      setDescricao('');
      setValor('');
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      alert("Erro ao registrar a despesa.");
    }
  };

  // 4. Excluir Despesa
  const excluirDespesa = async (id) => {
    if (window.confirm("Deseja realmente apagar este lançamento?")) {
      try {
        await deleteDoc(doc(db, "despesas", id));
      } catch (error) {
        console.error("Erro ao excluir despesa:", error);
      }
    }
  };

  return (
    <div className="p-6 md:p-10 animate-in fade-in duration-500">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic" style={{ color: configCores?.texto || '#000' }}>
            Controle de <span className="text-red-500">Despesas</span>
          </h1>
          <p className="text-sm font-bold opacity-50 mt-1" style={{ color: configCores?.textoSecundario || '#666' }}>
            Registre contas fixas, insumos e saídas de caixa.
          </p>
        </div>
        
        <div className="flex items-center gap-3 p-3 rounded-2xl border shadow-sm" style={{ backgroundColor: configCores?.card || '#fff', borderColor: configCores?.borda || '#eee' }}>
          <Calendar className="opacity-50" size={20} style={{ color: configCores?.texto || '#000' }} />
          <input 
            type="month" 
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="outline-none font-black bg-transparent uppercase text-sm"
            style={{ color: configCores?.texto || '#000' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORMULÁRIO DE LANÇAMENTO */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-3xl border shadow-sm mb-6 bg-red-50/50" style={{ borderColor: configCores?.borda || '#eee' }}>
            <p className="text-xs uppercase font-black text-red-400 mb-1">Total de Saídas no Mês</p>
            <h2 className="text-4xl font-black text-red-500 flex items-center gap-2">
              <TrendingDown size={32} /> R$ {totalDespesas.toFixed(2).replace('.', ',')}
            </h2>
          </div>

          <form onSubmit={salvarDespesa} className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: configCores?.card || '#fff', borderColor: configCores?.borda || '#eee' }}>
            <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-2" style={{ color: configCores?.texto || '#000' }}>
              <Plus size={18} /> Nova Saída
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase opacity-50 ml-2" style={{ color: configCores?.texto || '#000' }}>Descrição</label>
                <input 
                  type="text" 
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full p-4 rounded-2xl border outline-none font-bold focus:brightness-95 transition-all"
                  style={{ backgroundColor: configCores?.fundo || '#f9fafb', borderColor: configCores?.borda || '#eee', color: configCores?.texto || '#000' }}
                  placeholder="Ex: Conta de Luz, Pomadas..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase opacity-50 ml-2" style={{ color: configCores?.texto || '#000' }}>Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full p-4 rounded-2xl border outline-none font-bold text-red-500 focus:brightness-95 transition-all"
                    style={{ backgroundColor: configCores?.fundo || '#f9fafb', borderColor: configCores?.borda || '#eee' }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase opacity-50 ml-2" style={{ color: configCores?.texto || '#000' }}>Data</label>
                  <input 
                    type="date" 
                    value={dataDespesa}
                    onChange={(e) => setDataDespesa(e.target.value)}
                    className="w-full p-4 rounded-2xl border outline-none font-bold focus:brightness-95 transition-all"
                    style={{ backgroundColor: configCores?.fundo || '#f9fafb', borderColor: configCores?.borda || '#eee', color: configCores?.texto || '#000' }}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest text-white shadow-lg bg-red-500 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Registrar Despesa
            </button>
          </form>
        </div>

        {/* LISTA DE DESPESAS */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden" style={{ backgroundColor: configCores?.card || '#fff', borderColor: configCores?.borda || '#eee' }}>
            <div className="p-6 border-b" style={{ borderColor: configCores?.borda || '#eee' }}>
              <h3 className="text-lg font-black uppercase" style={{ color: configCores?.texto || '#000' }}>Histórico do Mês</h3>
            </div>
            
            <div className="p-4 flex flex-col gap-3 max-h-[600px] overflow-y-auto custom-scrollbar">
              {despesas.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed rounded-2xl opacity-50" style={{ borderColor: configCores?.borda || '#eee' }}>
                  <p className="font-bold uppercase" style={{ color: configCores?.texto || '#000' }}>Nenhuma despesa registrada neste mês.</p>
                </div>
              ) : (
                despesas.map(item => {
                  // Converte a data de YYYY-MM-DD para DD/MM/YYYY
                  const dataFormatada = item.data.split('-').reverse().join('/');
                  
                  return (
                    <div key={item.id} className="flex justify-between items-center p-4 rounded-2xl border hover:shadow-md transition-all" style={{ backgroundColor: configCores?.fundo || '#f9fafb', borderColor: configCores?.borda || '#eee' }}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                          <DollarSign size={20} />
                        </div>
                        <div>
                          <p className="font-black uppercase text-sm" style={{ color: configCores?.texto || '#000' }}>{item.descricao}</p>
                          <p className="text-[10px] font-bold opacity-50 flex items-center gap-1 mt-1" style={{ color: configCores?.textoSecundario || '#666' }}>
                            <Calendar size={10}/> {dataFormatada}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-red-500 text-lg">R$ {Number(item.valor).toFixed(2).replace('.', ',')}</span>
                        <button onClick={() => excluirDespesa(item.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}