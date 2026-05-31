import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore'

export default function AdminServicos({ servicos, aoMudar }) {
  const [form, setForm] = useState({ id: null, nome: '', preco: '', tempo: '' })
  const [carregando, setCarregando] = useState(false)
  const [configCores, setConfigCores] = useState(null)

  // 1. BUSCA PERSONALIZAÇÃO (CORES) DO FIREBASE EM TEMPO REAL
  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) {
        setConfigCores(docSnap.data().cores);
      }
    });
    return () => unsubCores();
  }, []);

  // --- FUNÇÕES DE MÁSCARA ---
  const handlePrecoChange = (e) => {
    // Remove tudo que não for número
    let valor = e.target.value.replace(/\D/g, "");
    if (!valor) {
      setForm({ ...form, preco: "" });
      return;
    }
    // Divide por 100 para criar os centavos e formata no padrão brasileiro
    const formatoMoeda = (Number(valor) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    setForm({ ...form, preco: `R$ ${formatoMoeda}` });
  };

  const handleTempoChange = (e) => {
    const valorOriginal = e.target.value;

    // Se o valor já tiver "h", permitimos que o usuário edite ou apague livremente.
    // Isso evita o bug de transformar "1h 30" em "130 minutos" ao apagar uma letra.
    if (valorOriginal.includes("h")) {
      setForm({ ...form, tempo: valorOriginal });
      return;
    }

    // Remove tudo que não for número
    const apenasNumeros = valorOriginal.replace(/\D/g, "");

    // Se não houver números (campo vazio), limpa o input
    if (!apenasNumeros) {
      setForm({ ...form, tempo: "" });
      return;
    }

    const minutosTotais = parseInt(apenasNumeros, 10);

    // Converte para horas se passar ou igualar a 60
    if (minutosTotais >= 60) {
      const horas = Math.floor(minutosTotais / 60);
      const minutosRestantes = minutosTotais % 60;

      if (minutosRestantes > 0) {
        setForm({ ...form, tempo: `${horas}h ${minutosRestantes}min` });
      } else {
        setForm({ ...form, tempo: `${horas}h` });
      }
    } else {
      setForm({ ...form, tempo: `${minutosTotais} min` });
    }
  };
  // --------------------------

  const salvarServico = async (e) => {
    e.preventDefault()
    setCarregando(true)
    try {
      if (form.id) {
        await updateDoc(doc(db, "servicos", form.id), { 
          nome: form.nome, 
          preco: form.preco, 
          tempo: form.tempo 
        })
      } else {
        await addDoc(collection(db, "servicos"), { 
          nome: form.nome, 
          preco: form.preco || "R$ 0,00", // Fallback padronizado
          tempo: form.tempo || "30 min"   // Fallback padronizado
        })
      }
      setForm({ id: null, nome: '', preco: '', tempo: '' })
      aoMudar()
    } catch (error) {
      console.error("Erro:", error)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10" 
          style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
        Gerenciar <span style={{ color: configCores?.primaria || 'var(--cor-primaria)' }}>Serviços</span>
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LISTA DE SERVIÇOS */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl border overflow-hidden shadow-xl" 
               style={{ 
                 backgroundColor: configCores?.card || 'var(--cor-card)', 
                 borderColor: configCores?.borda || 'var(--cor-borda)' 
               }}>
            <table className="w-full text-left">
              <thead style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)' }}>
                <tr className="text-[10px] uppercase font-black" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  <th className="p-5">Serviço</th>
                  <th className="p-5 text-center">Preço</th>
                  <th className="p-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map(s => (
                  <tr key={s.id} className="border-b transition-colors group" 
                      style={{ borderColor: configCores?.borda || 'var(--cor-borda)' }}>
                    <td className="p-5">
                      <p className="font-bold text-lg" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                        {s.nome}
                      </p>
                      <p className="text-xs" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                        {s.tempo}
                      </p>
                    </td>
                    <td className="p-5 text-center">
                      <span className="px-4 py-1.5 rounded-full text-xs font-black border"
                            style={{ 
                              backgroundColor: `${configCores?.primaria}1a` || 'rgba(var(--cor-primaria-rgb), 0.1)', 
                              color: configCores?.primaria || 'var(--cor-primaria)',
                              borderColor: `${configCores?.primaria}33` || 'rgba(var(--cor-primaria-rgb), 0.2)'
                            }}>
                        {s.preco}
                      </span>
                    </td>
                    <td className="p-5 text-right space-x-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setForm(s)} className="p-2 rounded-lg transition-all hover:scale-110"
                              style={{ backgroundColor: configCores?.fundo || 'var(--cor-bg-botao)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                        ✏️
                      </button>
                      <button onClick={async () => { if(confirm("Apagar?")) { await deleteDoc(doc(db, "servicos", s.id)); aoMudar(); } }} 
                              className="p-2 rounded-lg transition-all hover:scale-110"
                              style={{ backgroundColor: configCores?.fundo || 'var(--cor-bg-botao)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULÁRIO DINÂMICO */}
        <div className="p-8 rounded-3xl border h-fit sticky top-10 shadow-2xl"
             style={{ 
               backgroundColor: configCores?.card || 'var(--cor-card)', 
               borderColor: configCores?.borda || 'var(--cor-borda)' 
             }}>
          <h2 className="text-xl font-black mb-6 uppercase italic" style={{ color: configCores?.primaria || 'var(--cor-primaria)' }}>
            {form.id ? 'Editar Item' : 'Novo Serviço'}
          </h2>
          
          <form onSubmit={salvarServico} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest ml-2" 
                     style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                Nome
              </label>
              <input 
                required
                value={form.nome} 
                onChange={e => setForm({...form, nome: e.target.value})} 
                placeholder="Ex: Corte Masculino" 
                className="w-full border p-4 rounded-2xl outline-none transition-all focus:ring-2"
                style={{ 
                  backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', 
                  borderColor: configCores?.borda || 'var(--cor-borda)', 
                  color: configCores?.texto || 'var(--cor-texto-principal)' 
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-2" 
                       style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  Preço
                </label>
                <input 
                  required
                  value={form.preco} 
                  onChange={handlePrecoChange} 
                  placeholder="R$ 0,00" 
                  className="w-full border p-4 rounded-2xl outline-none transition-all focus:ring-2"
                  style={{ 
                    backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', 
                    borderColor: configCores?.borda || 'var(--cor-borda)', 
                    color: configCores?.texto || 'var(--cor-texto-principal)' 
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-2" 
                       style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  Tempo
                </label>
                <input 
                  value={form.tempo} 
                  onChange={handleTempoChange} 
                  placeholder="30 min" 
                  className="w-full border p-4 rounded-2xl outline-none transition-all focus:ring-2"
                  style={{ 
                    backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', 
                    borderColor: configCores?.borda || 'var(--cor-borda)', 
                    color: configCores?.texto || 'var(--cor-texto-principal)' 
                  }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={carregando}
              className="w-full font-black py-4 rounded-2xl hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
              style={{ 
                backgroundColor: configCores?.primaria || 'var(--cor-primaria)',
                color: '#ffffff' 
              }}
            >
              {carregando ? 'Processando...' : form.id ? 'Salvar Alterações' : 'Adicionar Serviço'}
            </button>

            {form.id && (
              <button type="button" onClick={() => setForm({id:null, nome:'', preco:'', tempo:''})} 
                      className="w-full text-xs font-bold mt-2 hover:underline"
                      style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                Cancelar Edição
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}