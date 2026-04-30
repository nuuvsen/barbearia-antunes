import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore' 
import { Search, X } from 'lucide-react'
import AdminPagamento from './AdminPagamento'

const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
const IconWhatsApp = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>

export default function AdminDashboard({ totalServicos }) {
  const [agendamentos, setAgendamentos] = useState([])
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false)
  const [agendamentoEmPagamento, setAgendamentoEmPagamento] = useState(null)
  const [busca, setBusca] = useState('')
  const [configCores, setConfigCores] = useState(null)

  // 1. BUSCA PERSONALIZAÇÃO (CORES) DO FIREBASE
  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) {
        setConfigCores(docSnap.data().cores); // Acessando o mapa 'cores' conforme imagem
      }
    });
    return () => unsubCores();
  }, []);

  // 2. BUSCA AGENDAMENTOS EM TEMPO REAL
  useEffect(() => {
    const q = query(collection(db, "agendamentos"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAgendamentos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const concluirAtendimentoFinal = async (id) => {
    try {
      await updateDoc(doc(db, "agendamentos", id), { status: "Concluído" });
      setAgendamentoEmPagamento(null);
    } catch (error) {
      console.error("Erro ao concluir:", error);
    }
  }

  const excluirAgendamento = async (id) => {
    if (window.confirm("Deseja marcar este agendamento como Cancelado?")) {
      try {
        await updateDoc(doc(db, "agendamentos", id), { status: "Cancelado" });
      } catch (error) {
        console.error("Erro ao cancelar:", error);
      }
    }
  }

  const formatarWhatsApp = (numero) => `https://wa.me/55${numero.replace(/\D/g, '')}`

  const proximosClientes = agendamentos
    .filter(ag => ag.status !== 'Concluído')
    .sort((a, b) => (a.data || "").localeCompare(b.data || "") || (a.hora || "").localeCompare(b.hora || ""))

  const atendimentosFinalizados = agendamentos
    .filter(ag => ag.status === 'Concluído')
    .filter(ag => 
      ag.clienteNome?.toLowerCase().includes(busca.toLowerCase()) || 
      ag.servico?.toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.hora || "").localeCompare(a.hora || ""))

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      {agendamentoEmPagamento && (
        <AdminPagamento 
          agendamento={agendamentoEmPagamento} 
          onClose={() => setAgendamentoEmPagamento(null)}
          onConfirm={concluirAtendimentoFinal}
        />
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex justify-between items-start mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter" 
            style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
          Minha <span style={{ color: configCores?.primaria || 'var(--cor-primaria)' }}>Agenda</span>
        </h1>
        <button 
          onClick={() => setMostrarFinalizados(true)}
          className="text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg hover:brightness-125 border"
          style={{ 
            backgroundColor: configCores?.card || 'var(--cor-card)', 
            borderColor: configCores?.borda || 'var(--cor-borda)', 
            color: configCores?.texto || 'var(--cor-texto-principal)' 
          }}
        >
          Atendimentos Finalizados
        </button>
      </div>
      
      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="p-6 rounded-2xl border" 
              style={{ backgroundColor: configCores?.card || 'var(--cor-card)', borderColor: configCores?.borda || 'var(--cor-borda)' }}>
            <p className="text-xs uppercase font-black mb-2" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>Total Visível</p>
            <p className="text-4xl font-black" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{proximosClientes.length}</p>
         </div>
         <div className="p-6 rounded-2xl border" 
              style={{ backgroundColor: configCores?.card || 'var(--cor-card)', borderColor: configCores?.borda || 'var(--cor-borda)' }}>
            <p className="text-xs uppercase font-black mb-2" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>Serviços Cadastrados</p>
            <p className="text-4xl font-black" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{totalServicos}</p>
         </div>
      </div>

      <h2 className="text-xl font-bold mb-4 uppercase tracking-widest" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
        Fila e Cancelados
      </h2>
      
      {/* LISTA DE AGENDAMENTOS ATIVOS */}
      <div className="grid gap-4">
        {proximosClientes.map(ag => {
          const isCancelado = ag.status === 'Cancelado';
          return (
            <div 
              key={ag.id} 
              className={`p-6 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-center gap-4 ${isCancelado ? 'opacity-60' : ''}`}
              style={{
                backgroundColor: isCancelado ? 'rgba(0,0,0,0.05)' : (configCores?.card || 'var(--cor-card)'),
                borderColor: isCancelado ? 'rgba(0,0,0,0.1)' : (configCores?.borda || 'var(--cor-borda)'),
                borderLeftWidth: isCancelado ? '1px' : '4px',
                borderLeftColor: isCancelado ? 'gray' : (configCores?.primaria || 'var(--cor-primaria)')
              }}
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                    <p className={`text-xl font-black uppercase ${isCancelado ? 'line-through' : ''}`} 
                       style={{ color: isCancelado ? 'gray' : (configCores?.texto || 'var(--cor-texto-principal)') }}>
                      {ag.clienteNome}
                    </p>
                    {isCancelado && (
                      <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase" 
                            style={{ backgroundColor: 'gray', color: '#ffffff' }}>
                        Cancelado
                      </span>
                    )}
                </div>
                <p className="text-sm mt-1" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  {ag.servico} com <span className="font-bold" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{ag.barbeiro}</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center px-4">
                  {ag.data && (
                    <p className="text-[11px] font-black uppercase tracking-widest mb-1" 
                       style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                      {ag.data}
                    </p>
                  )}
                  <p className="text-[10px] uppercase font-bold" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>Horário</p>
                  <p className="text-2xl font-black" 
                     style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                    {ag.hora}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={formatarWhatsApp(ag.clienteTelefone)} target="_blank" rel="noreferrer" 
                     className="p-3 rounded-xl hover:brightness-125 transition-all border"
                     style={{ backgroundColor: configCores?.card || 'var(--cor-bg-botao)', borderColor: configCores?.borda || 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                    <IconWhatsApp />
                  </a>
                  
                  {!isCancelado && (
                    <button 
                      onClick={() => setAgendamentoEmPagamento(ag)} 
                      className="p-3 rounded-xl hover:brightness-110 transition-all shadow-md"
                      style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
                    >
                      <IconCheck />
                    </button>
                  )}
                  
                  <button 
                    onClick={() => excluirAgendamento(ag.id)} 
                    className={`p-3 rounded-xl transition-all border ${isCancelado ? 'opacity-20 cursor-not-allowed' : 'hover:brightness-125'}`} 
                    disabled={isCancelado}
                    style={{ backgroundColor: configCores?.card || 'var(--cor-bg-botao)', borderColor: configCores?.borda || 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL DE HISTÓRICO - TOTALMENTE DINÂMICO */}
      {mostrarFinalizados && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300"
             style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border"
               style={{ 
                 backgroundColor: configCores?.fundo || 'var(--cor-fundo)', 
                 borderColor: configCores?.borda || 'var(--cor-borda)' 
               }}>
            
            <div className="p-6 border-b flex justify-between items-center" 
                 style={{ borderColor: configCores?.borda || 'var(--cor-borda)' }}>
              <div>
                <h2 className="text-2xl font-black uppercase italic" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                  Histórico <span style={{ color: configCores?.primaria || '#16a34a' }}>Finalizados</span>
                </h2>
              </div>
              <button onClick={() => setMostrarFinalizados(false)} className="p-2 rounded-full transition-all hover:scale-110"
                      style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6" style={{ backgroundColor: configCores?.card || 'var(--cor-card)' }}>
                <input 
                  type="text" 
                  placeholder="Pesquisar cliente ou serviço..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full rounded-2xl py-4 px-6 outline-none transition-all font-bold border focus:brightness-110"
                  style={{ 
                    backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', 
                    borderColor: configCores?.borda || 'var(--cor-borda)', 
                    color: configCores?.texto || 'var(--cor-texto-principal)' 
                  }}
                />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {atendimentosFinalizados.map(ag => (
                <div key={ag.id} className="p-4 rounded-2xl border flex justify-between items-center opacity-80"
                     style={{ 
                       backgroundColor: configCores?.card || 'var(--cor-card)', 
                       borderColor: configCores?.borda || 'var(--cor-borda)' 
                     }}>
                  <div className="text-left">
                    <p className="text-lg font-black uppercase" 
                       style={{ color: configCores?.primaria || '#16a34a' }}>
                      {ag.clienteNome}
                    </p>
                    <p className="text-[10px] font-bold uppercase" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                      {ag.servico} com <span style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{ag.barbeiro}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>{ag.data}</p>
                    <p className="text-xl font-black" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>{ag.hora}</p>
                  </div>
                </div>
              ))}
              
              {atendimentosFinalizados.length === 0 && (
                <p className="text-center font-bold text-sm" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  Nenhum atendimento finalizado encontrado.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}