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
  Settings,
  Package // Importado para representar Produtos
} from 'lucide-react'

import AdminDashboard from './AdminDashboard'
import AdminServicos from './AdminServicos'
import AdminBarbeiros from './AdminBarbeiros'
import AdminClientes from './AdminClientes'
import AdminPlanos from './AdminPlanos'
import AdminGerencia from './AdminGerencia'
import AdminAgenda from './AdminAgenda'
import AdminConfiguracoes from './AdminConfiguracoes'
import AdminProdutos from './AdminProdutos' // Componente que você criará

export default function Admin({ servicos, aoMudar }) {
  const [abaAtiva, setAbaAtiva] = useState('dashboard')
  const [sidebarAberta, setSidebarAberta] = useState(false)

  const navegarPara = (id) => {
    setAbaAtiva(id)
    setSidebarAberta(false)
  }

  const NavItem = ({ id, label, icon: Icon }) => {
    const isActive = abaAtiva === id;
    
    return (
      <button 
        onClick={() => navegarPara(id)} 
        className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest hover:brightness-110"
        style={{
          backgroundColor: isActive ? 'var(--cor-primaria)' : 'transparent',
          color: isActive ? '#ffffff' : 'var(--cor-texto-secundario)',
          boxShadow: isActive ? '0 10px 15px -3px rgba(var(--cor-primaria-rgb), 0.2)' : 'none'
        }}
      >
        <Icon size={20} /> 
        <span className="flex-1 text-left">{label}</span>
        {isActive && <ChevronRight size={14} className="opacity-50" />}
      </button>
    )
  }

  return (
    <div 
      className="flex min-h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--cor-bg-geral)', color: 'var(--cor-texto-principal)' }}
    >
      
      {/* Overlay Mobile */}
      {sidebarAberta && (
        <div 
          className="fixed inset-0 z-[60] md:hidden transition-all duration-300 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-[70] w-72 border-r flex flex-col p-6
          transform transition-transform duration-300 ease-in-out
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}
        style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}
      >
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
            Antunes<span style={{ color: 'var(--cor-primaria)' }}>.OS</span>
          </h2>
          <button 
            onClick={() => setSidebarAberta(false)} 
            className="md:hidden transition-colors hover:opacity-70"
            style={{ color: 'var(--cor-texto-secundario)' }}
          >
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
          <NavItem id="agenda" label="Agenda & Horários" icon={Clock} />
          <NavItem id="servicos" label="Serviços" icon={Scissors} />
          <NavItem id="produtos" label="Produtos" icon={Package} /> {/* Novo Item */}
          <NavItem id="barbeiros" label="Barbeiros" icon={UserCircle} />
          <NavItem id="clientes" label="Clientes" icon={Users} />
          <NavItem id="planos" label="Planos" icon={Gem} />
          <NavItem id="gerencia" label="Gerência" icon={BarChart3} />
          
          <div className="pt-4 mt-4 border-t" style={{ borderTopColor: 'var(--cor-borda)' }}>
            <NavItem id="configuracoes" label="Configurações" icon={Settings} />
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t" style={{ borderTopColor: 'var(--cor-borda)' }}>
          <Link 
            to="/" 
            className="flex items-center gap-3 p-3 text-xs font-black uppercase tracking-widest transition-colors hover:opacity-80"
            style={{ color: 'var(--cor-texto-secundario)' }}
          >
            <LogOut size={16} style={{ color: 'var(--cor-primaria)' }} /> Sair do Painel
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Mobile */}
        <header 
          className="md:hidden p-4 border-b flex items-center justify-between"
          style={{ backgroundColor: 'var(--cor-card)', borderBottomColor: 'var(--cor-borda)' }}
        >
          <button 
            onClick={() => setSidebarAberta(true)}
            className="p-3 border rounded-xl transition-all active:scale-95"
            style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
          >
            <Menu size={24} />
          </button>
          <h2 className="text-sm font-black italic uppercase tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
            Antunes<span style={{ color: 'var(--cor-primaria)' }}>.OS</span>
          </h2>
          <div className="w-12"></div>
        </header>

        {/* Área de Scroll dos Componentes */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar animate-in fade-in duration-500">
          {abaAtiva === 'dashboard' && <AdminDashboard totalServicos={servicos.length} />}
          {abaAtiva === 'agenda' && <AdminAgenda />}
          {abaAtiva === 'servicos' && <AdminServicos servicos={servicos} aoMudar={aoMudar} />}
          {abaAtiva === 'produtos' && <AdminProdutos />} {/* Nova Rota Interna */}
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