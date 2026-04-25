import { useState } from 'react'
import { Link } from 'react-router-dom'

import AdminDashboard from './AdminDashboard'
import AdminServicos from './AdminServicos'
import AdminBarbeiros from './AdminBarbeiros'
import AdminClientes from './AdminClientes'
import AdminPlanos from './AdminPlanos'
import AdminGerencia from './AdminGerencia'
// 1. IMPORTANDO A NOVA TELA
import AdminAgenda from './AdminAgenda'

const IconCorte = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
const IconDash = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
const IconUser = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
const IconStats = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
const IconPlanos = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M3 10a2 2 0 0 1 0 4"></path><path d="M21 10a2 2 0 0 0 0 4"></path><path d="M12 6v12" strokeDasharray="2 2"></path></svg>
// 2. NOVO ÍCONE DE RELÓGIO PARA A AGENDA
const IconRelogio = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>


export default function Admin({ servicos, aoMudar }) {
  const [abaAtiva, setAbaAtiva] = useState('dashboard')

  const NavItem = ({ id, label, icon: Icon }) => (
    <button 
      onClick={() => setAbaAtiva(id)} 
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${abaAtiva === id ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:bg-[#1c1c1c]'}`}
    >
      <Icon /> <span className="font-bold text-sm">{label}</span>
    </button>
  )

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      
      <aside className="w-64 bg-[#111111] border-r border-[#1f1f1f] flex flex-col p-6 sticky top-0 h-screen">
        <div className="mb-10">
          <h2 className="text-xl font-black italic text-red-600 uppercase tracking-tighter">Admin Panel</h2>
        </div>
        
        <nav className="flex-1 space-y-2">
          <NavItem id="dashboard" label="Dashboard" icon={IconDash} />
          {/* BOTÃO DA AGENDA AQUI */}
          <NavItem id="agenda" label="Agenda & Horários" icon={IconRelogio} />
          <NavItem id="servicos" label="Serviços" icon={IconCorte} />
          <NavItem id="barbeiros" label="Barbeiros" icon={IconUser} />
          <NavItem id="clientes" label="Clientes" icon={IconUser} />
          <NavItem id="planos" label="Planos" icon={IconPlanos} />
          <NavItem id="gerencia" label="Gerência" icon={IconStats} />
        </nav>

        <div className="mt-auto pt-6 border-t border-[#1f1f1f]">
          <Link to="/" className="text-sm font-bold text-gray-500 hover:text-white transition-colors">← Sair do Painel</Link>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        {abaAtiva === 'dashboard' && <AdminDashboard totalServicos={servicos.length} />}
        {/* EXIBIÇÃO DA TELA DE AGENDA AQUI */}
        {abaAtiva === 'agenda' && <AdminAgenda />}
        {abaAtiva === 'servicos' && <AdminServicos servicos={servicos} aoMudar={aoMudar} />}
        {abaAtiva === 'barbeiros' && <AdminBarbeiros />}
        {abaAtiva === 'clientes' && <AdminClientes />}
        {abaAtiva === 'planos' && <AdminPlanos />}
        {abaAtiva === 'gerencia' && <AdminGerencia />}
      </main>

    </div>
  )
}