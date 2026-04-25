import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'

const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
const IconWhatsApp = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>

export default function AdminDashboard({ totalServicos }) {
  const [agendamentos, setAgendamentos] = useState([])

  const carregarAgendamentos = async () => {
    const snap = await getDocs(collection(db, "agendamentos"))
    setAgendamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { carregarAgendamentos() }, [])

  const concluirAgendamento = async (id) => {
    await updateDoc(doc(db, "agendamentos", id), { status: "Concluído" })
    carregarAgendamentos()
  }

  const excluirAgendamento = async (id) => {
    if (window.confirm("Deseja remover este agendamento da lista?")) {
      await deleteDoc(doc(db, "agendamentos", id))
      carregarAgendamentos()
    }
  }

  const formatarWhatsApp = (numero) => `https://wa.me/55${numero.replace(/\D/g, '')}`

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10">Minha <span className="text-red-600">Agenda</span></h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-[#111111] border border-[#1f1f1f] p-6 rounded-2xl">
            <p className="text-xs text-gray-500 uppercase font-black mb-2">Total de Agendamentos</p>
            <p className="text-4xl font-black">{agendamentos.length}</p>
         </div>
         <div className="bg-[#111111] border border-[#1f1f1f] p-6 rounded-2xl">
            <p className="text-xs text-gray-500 uppercase font-black mb-2">Serviços Cadastrados</p>
            <p className="text-4xl font-black">{totalServicos}</p>
         </div>
      </div>

      <h2 className="text-xl font-bold text-gray-500 mb-4 uppercase tracking-widest">Próximos Clientes</h2>
      
      <div className="grid gap-4">
        {agendamentos.length === 0 && <p className="text-gray-600 italic">Nenhum cliente agendado ainda...</p>}
        {agendamentos.map(ag => (
          <div key={ag.id} className={`p-6 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-center gap-4 ${ag.status === 'Concluído' ? 'bg-green-900/10 border-green-900/30 opacity-60' : 'bg-[#111111] border-[#1f1f1f] border-l-4 border-l-red-600'}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-xl font-black uppercase ${ag.status === 'Concluído' ? 'text-green-500 line-through' : 'text-white'}`}>{ag.clienteNome}</p>
                {ag.status === 'Concluído' && <span className="bg-green-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">Finalizado</span>}
              </div>
              <p className="text-sm text-gray-400 mt-1">{ag.servico} com <span className="font-bold text-white">{ag.barbeiro}</span></p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center px-4">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Horário</p>
                <p className={`text-2xl font-black ${ag.status === 'Concluído' ? 'text-gray-600' : 'text-red-500'}`}>{ag.hora}</p>
              </div>
              <div className="flex gap-2">
                <a href={formatarWhatsApp(ag.clienteTelefone)} target="_blank" rel="noreferrer" className="bg-[#1c1c1c] border border-[#2a2a2a] p-3 rounded-xl hover:bg-green-600 transition-all"><IconWhatsApp /></a>
                {ag.status !== 'Concluído' && <button onClick={() => concluirAgendamento(ag.id)} className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-500 transition-all"><IconCheck /></button>}
                <button onClick={() => excluirAgendamento(ag.id)} className="bg-[#1c1c1c] border border-[#2a2a2a] p-3 rounded-xl hover:bg-red-600 transition-all">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}