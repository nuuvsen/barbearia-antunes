import React, { useState } from 'react';
import { Menu, X, LayoutDashboard, Users, Scissors, Settings, LogOut } from 'lucide-react';

export default function AdminLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Overlay para fechar o menu ao clicar fora (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0a] border-r border-[#1f1f1f] 
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-black uppercase italic italic">Antunes<span className="text-red-600">.OS</span></h2>
            <button onClick={toggleSidebar} className="md:hidden text-gray-500">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            <SidebarItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active />
            <SidebarItem icon={<Users size={20}/>} label="Clientes" />
            <SidebarItem icon={<Scissors size={20}/>} label="Serviços" />
            <SidebarItem icon={<Settings size={20}/>} label="Configurações" />
          </nav>

          <button className="flex items-center gap-3 p-4 text-gray-500 hover:text-red-500 transition-all font-bold uppercase text-xs">
            <LogOut size={18} /> Sair do Painel
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Mobile */}
        <header className="md:hidden p-4 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between">
            <h2 className="text-lg font-black uppercase italic">Antunes<span className="text-red-600">.OS</span></h2>
            <button 
                onClick={toggleSidebar}
                className="p-2 bg-[#111] border border-[#1f1f1f] rounded-xl text-white"
            >
                <Menu size={24} />
            </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active = false }) {
  return (
    <div className={`
      flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all font-black uppercase text-[11px] tracking-widest
      ${active ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-500 hover:bg-[#111] hover:text-white'}
    `}>
      {icon}
      {label}
    </div>
  );
}