import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { Wallet, Scissors, TrendingUp, Calendar, CheckCircle2, X } from "lucide-react";

export default function AdminComissoes({ onClose }) {
  const [configCores, setConfigCores] = useState(null);
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const dataAtual = new Date();
    return `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [dadosEquipe, setDadosEquipe] = useState([]);
  const [totais, setTotais] = useState({ comissoes: 0, lucroBarbearia: 0, faturamentoBruto: 0 });
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) setConfigCores(docSnap.data().cores);
    });
    return () => unsubCores();
  }, []);

  useEffect(() => {
    const buscarDadosFinanceiros = async () => {
      setCarregando(true);
      try {
        const q = query(collection(db, "comandas"), where("mesReferencia", "==", mesSelecionado));
        const querySnapshot = await getDocs(q);
        
        const agrupadoPorBarbeiro = {};
        let totalComissoesGeral = 0;
        let totalLucroGeral = 0;
        let totalFaturamento = 0;

        querySnapshot.forEach((documento) => {
          const comanda = documento.data();
          const nomeBarbeiro = comanda.barbeiro || "Não Identificado";

          if (!agrupadoPorBarbeiro[nomeBarbeiro]) {
            agrupadoPorBarbeiro[nomeBarbeiro] = {
              nome: nomeBarbeiro,
              totalGerado: 0,
              comissaoReceber: 0,
              lucroDeixado: 0,
              qtdAtendimentos: 0
            };
          }

          const valorTotal = Number(comanda.valorTotal || 0);
          const comissao = Number(comanda.comissaoBarbeiro || 0);
          const lucro = Number(comanda.lucroBarbearia || 0);

          agrupadoPorBarbeiro[nomeBarbeiro].totalGerado += valorTotal;
          agrupadoPorBarbeiro[nomeBarbeiro].comissaoReceber += comissao;
          agrupadoPorBarbeiro[nomeBarbeiro].lucroDeixado += lucro;
          agrupadoPorBarbeiro[nomeBarbeiro].qtdAtendimentos += 1;

          totalFaturamento += valorTotal;
          totalComissoesGeral += comissao;
          totalLucroGeral += lucro;
        });

        const rankingEquipe = Object.values(agrupadoPorBarbeiro).sort((a, b) => b.totalGerado - a.totalGerado);

        setDadosEquipe(rankingEquipe);
        setTotais({
          comissoes: totalComissoesGeral,
          lucroBarbearia: totalLucroGeral,
          faturamentoBruto: totalFaturamento
        });

      } catch (error) {
        console.error("Erro ao buscar comissões:", error);
      } finally {
        setCarregando(false);
      }
    };

    buscarDadosFinanceiros();
  }, [mesSelecionado]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
      <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[90vh]"
           style={{ backgroundColor: configCores?.fundo || '#ffffff' }}>
        
        {/* CABEÇALHO DO MODAL */}
        <div className="p-6 md:p-8 flex justify-between items-center border-b" style={{ borderColor: configCores?.borda || '#eeeeee' }}>
          <div>
            <h1 className="text-3xl font-black uppercase italic" style={{ color: configCores?.texto || '#000' }}>
              Fechamento e <span style={{ color: configCores?.primaria || '#16a34a' }}>Comissões</span>
            </h1>
            <p className="text-sm font-bold opacity-50 mt-1" style={{ color: configCores?.textoSecundario || '#666' }}>
              Acompanhe o desempenho da equipe e os repasses.
            </p>
          </div>

          <div className="flex items-center gap-4">
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
            
            <button onClick={onClose} className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* CONTEÚDO ROLÁVEL */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
          {/* CARDS DE TOTALIZADORES GLOBAIS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 rounded-3xl border shadow-sm relative overflow-hidden" style={{ backgroundColor: configCores?.card || '#fff', borderColor: configCores?.borda || '#eee' }}>
              <div className="absolute -right-4 -top-4 opacity-5">
                <TrendingUp size={100} />
              </div>
              <p className="text-xs uppercase font-black opacity-50 mb-2" style={{ color: configCores?.textoSecundario || '#666' }}>Faturamento Bruto (Equipe)</p>
              <h2 className="text-4xl font-black" style={{ color: configCores?.texto || '#000' }}>
                R$ {totais.faturamentoBruto.toFixed(2).replace('.', ',')}
              </h2>
            </div>

            <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: configCores?.card || '#fff', borderColor: configCores?.borda || '#eee' }}>
              <p className="text-xs uppercase font-black opacity-50 mb-2" style={{ color: configCores?.textoSecundario || '#666' }}>Total a Pagar (Comissões)</p>
              <h2 className="text-4xl font-black text-orange-500">
                R$ {totais.comissoes.toFixed(2).replace('.', ',')}
              </h2>
            </div>

            <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: configCores?.card || '#fff', borderColor: configCores?.borda || '#eee' }}>
              <p className="text-xs uppercase font-black opacity-50 mb-2" style={{ color: configCores?.textoSecundario || '#666' }}>Lucro Bruto (Barbearia)</p>
              <h2 className="text-4xl font-black text-green-600">
                R$ {totais.lucroBarbearia.toFixed(2).replace('.', ',')}
              </h2>
            </div>
          </div>

          <h2 className="text-xl font-bold uppercase tracking-widest mb-6" style={{ color: configCores?.textoSecundario || '#666' }}>
            Desempenho Individual
          </h2>

          {carregando ? (
            <div className="p-10 text-center font-bold opacity-50">Calculando repasses...</div>
          ) : dadosEquipe.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed rounded-3xl opacity-50" style={{ borderColor: configCores?.borda || '#eee' }}>
              <p className="font-bold uppercase">Nenhum atendimento finalizado neste mês.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dadosEquipe.map((barbeiro, index) => (
                <div key={index} className="p-6 rounded-[2rem] border shadow-sm flex flex-col" style={{ backgroundColor: configCores?.card || '#fff', borderColor: configCores?.borda || '#eee' }}>
                  
                  <div className="flex items-center gap-4 mb-6 border-b pb-4" style={{ borderColor: configCores?.borda || '#eee' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-inner" style={{ backgroundColor: configCores?.primaria || '#16a34a' }}>
                      {barbeiro.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black uppercase text-xl" style={{ color: configCores?.texto || '#000' }}>{barbeiro.nome}</h3>
                      <p className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-1 mt-1">
                        <Scissors size={10} /> {barbeiro.qtdAtendimentos} Atendimentos
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase opacity-50">Gerou no Mês</span>
                      <span className="font-bold text-sm" style={{ color: configCores?.texto || '#000' }}>R$ {barbeiro.totalGerado.toFixed(2).replace('.', ',')}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase opacity-50">Lucro p/ Barbearia</span>
                      <span className="font-bold text-sm text-green-600">R$ {barbeiro.lucroDeixado.toFixed(2).replace('.', ',')}</span>
                    </div>

                    <div className="p-4 rounded-xl mt-4 border border-orange-100 bg-orange-50 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-black uppercase text-orange-600/70 block mb-1">A Receber</span>
                        <span className="text-2xl font-black text-orange-500">R$ {barbeiro.comissaoReceber.toFixed(2).replace('.', ',')}</span>
                      </div>
                      <Wallet className="text-orange-300" size={32} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}