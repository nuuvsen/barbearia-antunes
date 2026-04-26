import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore' 
import { Search, X } from 'lucide-react'
import AdminPagamento from './AdminPagamento' // Importando a nova tela

const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
const IconWhatsApp = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>

export default function AdminDashboard({ totalServicos }) {
  const [agendamentos, setAgendamentos] = useState([])
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false)
  const [agendamentoEmPagamento, setAgendamentoEmPagamento] = useState(null) // Novo estado para o pagamento
  const [busca, setBusca] = useState('')

  const carregarAgendamentos = async () => {
    const snap = await getDocs(collection(db, "agendamentos"))
    setAgendamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { carregarAgendamentos() }, [])

  // Esta função agora é chamada DEPOIS da tela de pagamento
  const concluirAtendimentoFinal = async (id) => {
    await updateDoc(doc(db, "agendamentos", id), { status: "Concluído" })
    setAgendamentoEmPagamento(null)
    carregarAgendamentos()
  }

  const excluirAgendamento = async (id) => {
    if (window.confirm("Deseja marcar este agendamento como Cancelado?")) {
      await updateDoc(doc(db, "agendamentos", id), { status: "Cancelado" })
      carregarAgendamentos()
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
      
      {/* Pop-up de Pagamento */}
      {agendamentoEmPagamento && (
        <AdminPagamento 
          agendamento={agendamentoEmPagamento} 
          onClose={() => setAgendamentoEmPagamento(null)}
          onConfirm={concluirAtendimentoFinal}
        />
      )}

      <div className="flex justify-between items-start mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">Minha <span className="text-red-600">Agenda</span></h1>
        <button 
          onClick={() => setMostrarFinalizados(true)}
          className="bg-[#111] border border-[#1f1f1f] hover:border-red-600 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg"
        >
          Atendimentos Finalizados
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-[#111111] border border-[#1f1f1f] p-6 rounded-2xl">
            <p className="text-xs text-gray-500 uppercase font-black mb-2">Total Visível</p>
            <p className="text-4xl font-black">{proximosClientes.length}</p>
         </div>
         <div className="bg-[#111111] border border-[#1f1f1f] p-6 rounded-2xl">
            <p className="text-xs text-gray-500 uppercase font-black mb-2">Serviços Cadastrados</p>
            <p className="text-4xl font-black">{totalServicos}</p>
         </div>
      </div>

      <h2 className="text-xl font-bold text-gray-500 mb-4 uppercase tracking-widest">Fila e Cancelados</h2>
      
      <div className="grid gap-4">
        {proximosClientes.map(ag => {
          const isCancelado = ag.status === 'Cancelado';
          return (
            <div key={ag.id} className={`p-6 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-center gap-4 ${isCancelado ? 'bg-red-950/10 border-red-900/20 opacity-60' : 'bg-[#111111] border-[#1f1f1f] border-l-4 border-l-red-600'}`}>
              <div className="flex-1 text-left"> {/* Alinhamento à esquerda garantido */}
                <div className="flex items-center gap-2">
                    <p className={`text-xl font-black uppercase ${isCancelado ? 'text-red-500 line-through' : 'text-white'}`}>{ag.clienteNome}</p>
                    {isCancelado && <span className="bg-red-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase text-white">Cancelado</span>}
                </div>
                <p className="text-sm text-gray-400 mt-1">{ag.servico} com <span className="font-bold text-white">{ag.barbeiro}</span></p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center px-4">
                  {ag.data && <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${isCancelado ? 'text-gray-600' : 'text-white'}`}>{ag.data}</p>}
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Horário</p>
                  <p className={`text-2xl font-black ${isCancelado ? 'text-gray-600' : 'text-white'}`}>{ag.hora}</p>
                </div>
                <div className="flex gap-2">
                  <a href={formatarWhatsApp(ag.clienteTelefone)} target="_blank" rel="noreferrer" className="bg-[#1c1c1c] border border-[#2a2a2a] p-3 rounded-xl hover:bg-green-600 transition-all"><IconWhatsApp /></a>
                  
                  {/* ALTERADO: Agora ao clicar no check, ele define o agendamento para pagamento */}
                  {!isCancelado && (
                    <button 
                      onClick={() => setAgendamentoEmPagamento(ag)} 
                      className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-500 transition-all"
                    >
                      <IconCheck />
                    </button>
                  )}
                  
                  <button onClick={() => excluirAgendamento(ag.id)} className={`bg-[#1c1c1c] border border-[#2a2a2a] p-3 rounded-xl transition-all ${isCancelado ? 'opacity-20 cursor-not-allowed' : 'hover:bg-red-600'}`} disabled={isCancelado}>🗑️</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL DE HISTÓRICO (CÓDIGO ORIGINAL MANTIDO) */}
      {mostrarFinalizados && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-[#1f1f1f] flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase italic text-white">Histórico <span className="text-green-500">Finalizados</span></h2>
              </div>
              <button onClick={() => setMostrarFinalizados(false)} className="p-2 hover:bg-red-600/10 rounded-full text-gray-500 hover:text-red-500 transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 bg-[#111]/50">
                <input 
                  type="text" 
                  placeholder="Pesquisar..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl py-4 px-6 text-white outline-none focus:border-green-500 transition-all font-bold"
                />
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {atendimentosFinalizados.map(ag => (
                <div key={ag.id} className="p-4 rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] flex justify-between items-center opacity-80">
                  <div className="text-left"> {/* Garante alinhamento nos finalizados */}
                    <p className="text-lg font-black uppercase text-green-500 line-through decoration-white/20">{ag.clienteNome}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{ag.servico} com <span className="text-white">{ag.barbeiro}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-white">{ag.data}</p>
                    <p className="text-xl font-black text-gray-600">{ag.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}