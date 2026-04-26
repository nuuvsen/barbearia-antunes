import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Clock, 
  Scissors, 
  UserCircle, 
  Users, 
  Gem, 
  BarChart3, 
  Menu, 
  X, 
  ChevronRight,
  LogOut,
  Settings // Novo ícone
} from 'lucide-react'

import AdminDashboard from './AdminDashboard'
import AdminServicos from './AdminServicos'
import AdminBarbeiros from './AdminBarbeiros'
import AdminClientes from './AdminClientes'
import AdminPlanos from './AdminPlanos'
import AdminGerencia from './AdminGerencia'
import AdminAgenda from './AdminAgenda'
import AdminConfiguracoes from './AdminConfiguracoes' // Novo componente

export default function Admin({ servicos, aoMudar }) {
  const [abaAtiva, setAbaAtiva] = useState('dashboard')
  const [sidebarAberta, setSidebarAberta] = useState(false)

  const navegarPara = (id) => {
    setAbaAtiva(id)
    setSidebarAberta(false)
  }

  const NavItem = ({ id, label, icon: Icon }) => (
    <button 
      onClick={() => navegarPara(id)} 
      className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
        abaAtiva === id 
        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
        : 'text-gray-500 hover:bg-[#1c1c1c] hover:text-gray-300'
      }`}
    >
      <Icon size={20} /> 
      <span className="flex-1 text-left">{label}</span>
      {abaAtiva === id && <ChevronRight size={14} className="opacity-50" />}
    </button>
  )

  return (
    <div className="flex min-h-screen bg-[#050505] text-white overflow-hidden">
      
      {sidebarAberta && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden transition-all duration-300"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-72 bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col p-6
        transform transition-transform duration-300 ease-in-out
        ${sidebarAberta ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">
            Antunes<span className="text-red-600">.OS</span>
          </h2>
          <button onClick={() => setSidebarAberta(false)} className="md:hidden text-gray-500 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
          <NavItem id="agenda" label="Agenda & Horários" icon={Clock} />
          <NavItem id="servicos" label="Serviços" icon={Scissors} />
          <NavItem id="barbeiros" label="Barbeiros" icon={UserCircle} />
          <NavItem id="clientes" label="Clientes" icon={Users} />
          <NavItem id="planos" label="Planos" icon={Gem} />
          <NavItem id="gerencia" label="Gerência" icon={BarChart3} />
          
          <div className="pt-4 mt-4 border-t border-[#1f1f1f]">
            <NavItem id="configuracoes" label="Configurações" icon={Settings} />
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-[#1f1f1f]">
          <Link to="/" className="flex items-center gap-3 p-3 text-xs font-black uppercase tracking-widest text-gray-600 hover:text-red-500 transition-colors">
            <LogOut size={16} /> Sair do Painel
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden p-4 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between">
          <button 
            onClick={() => setSidebarAberta(true)}
            className="p-3 bg-[#111] border border-[#1f1f1f] rounded-xl text-white"
          >
            <Menu size={24} />
          </button>
          <h2 className="text-sm font-black italic uppercase tracking-tighter">
            Antunes<span className="text-red-600">.OS</span>
          </h2>
          <div className="w-12"></div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar animate-in fade-in duration-500">
          {abaAtiva === 'dashboard' && <AdminDashboard totalServicos={servicos.length} />}
          {abaAtiva === 'agenda' && <AdminAgenda />}
          {abaAtiva === 'servicos' && <AdminServicos servicos={servicos} aoMudar={aoMudar} />}
          {abaAtiva === 'barbeiros' && <AdminBarbeiros />}
          {abaAtiva === 'clientes' && <AdminClientes />}
          {abaAtiva === 'planos' && <AdminPlanos />}
          {abaAtiva === 'gerencia' && <AdminGerencia />}
          {abaAtiva === 'configuracoes' && <AdminConfiguracoes />}
        </div>
      </main>

    </div>
  )
}