import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from './firebase'
import Sobre from './Sobre.jsx';
import { 
  LayoutDashboard, 
  Clock, 
  Scissors, 
  UserCircle, 
  Users,
  Gem,
  BarChart3,
  Wallet,
  Lock,
  Menu,
  X, 
  ChevronRight,
  LogOut,
  Settings,
  Package, // Importado para representar Produtos
  HelpCircle // <-- ADICIONADO: Ícone para a página Sobre
} from 'lucide-react'

import AdminDashboard from './AdminDashboard'
import AdminServicos from './AdminServicos'
import AdminBarbeiros from './AdminBarbeiros'
import AdminClientes from './AdminClientes'
import AdminPlanos from './AdminPlanos'
import AdminGerencia from './AdminGerencia'
import AdminAgenda from './AdminAgenda'
import AdminConfiguracoes from './AdminConfiguracoes'
import AdminProdutos from './AdminProdutos'
import AdminFiado from './AdminFiado'
import AdminCaixa from './AdminCaixa'

export default function Admin({ servicos, aoMudar }) {
  const [abaAtiva, setAbaAtiva] = useState('dashboard')
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [avaliacoesNegativasPendentes, setAvaliacoesNegativasPendentes] = useState(0)

  // Alerta em tempo real de avaliação ruim (nota 1 ou 2), vinda do NPS automático do bot —
  // fica montado aqui (fora de qualquer aba) pra avisar o admin mesmo se ele estiver em
  // outra tela quando a avaliação chegar. O badge (contador na Barbeiros, onde vive a aba
  // "Avaliações") usa o mesmo critério "nota <= 2 e ainda não lida" que a AdminAvaliacoes usa.
  useEffect(() => {
    let primeiraCarga = true
    const q = query(collection(db, "avaliacoes"), where("nota", "<=", 2))
    const unsub = onSnapshot(q, (snap) => {
      const pendentes = snap.docs.filter(d => !d.data().lida).length
      setAvaliacoesNegativasPendentes(pendentes)

      // Sem essa trava, toda vez que o admin abre o painel ele levaria um toast de
      // erro pra cada avaliação ruim antiga que já estava no banco.
      if (primeiraCarga) {
        primeiraCarga = false
        return
      }

      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const av = change.doc.data()
          toast.error(
            `⭐ Avaliação ruim! ${av.clienteNome || 'Cliente'} deu nota ${av.nota} para ${av.barbeiro || 'a equipe'}.${av.comentario ? ` "${av.comentario}"` : ''}`,
            { duration: 8000 }
          )
        }
      })
    })
    return () => unsub()
  }, [])

  const navegarPara = (id) => {
    setAbaAtiva(id)
    setSidebarAberta(false)
  }

  const NavItem = ({ id, label, icon: Icon, badge }) => {
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
        {badge > 0 && (
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[9px] font-black bg-red-500 text-white">
            {badge}
          </span>
        )}
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
          <NavItem id="produtos" label="Produtos" icon={Package} /> 
          <NavItem id="barbeiros" label="Barbeiros" icon={UserCircle} badge={avaliacoesNegativasPendentes} />
          <NavItem id="clientes" label="Clientes" icon={Users} />
          <NavItem id="planos" label="Planos" icon={Gem} />
          <NavItem id="fiado" label="Contas a Receber" icon={Wallet} />
          <NavItem id="caixa" label="Controle de Caixa" icon={Lock} />
          <NavItem id="gerencia" label="Gerência" icon={BarChart3} />
          
          <div className="pt-4 mt-4 border-t" style={{ borderTopColor: 'var(--cor-borda)' }}>
            <NavItem id="configuracoes" label="Configurações" icon={Settings} />
          </div>
        </nav>

        {/* <-- ADICIONADO: Seção inferior com o Sobre acima do Sair --> */}
        <div className="mt-auto pt-6 border-t flex flex-col gap-2" style={{ borderTopColor: 'var(--cor-borda)' }}>
          <NavItem id="sobre" label="Sobre o Sistema" icon={HelpCircle} />
          
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
        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
          {/* Bug real encontrado: esta div nunca é desmontada quando a aba muda (só os filhos
              trocam), então a classe "animate-in fade-in" só tocava uma vez, no primeiro
              carregamento do painel — trocar de aba sempre foi um corte seco, sem nenhuma
              transição. A key={abaAtiva} força o React a desmontar/remontar esta div a cada
              troca de aba, o que faz a animação de entrada tocar de novo toda vez. */}
          <div key={abaAtiva} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {abaAtiva === 'dashboard' && <AdminDashboard totalServicos={servicos.length} />}
            {abaAtiva === 'agenda' && <AdminAgenda />}
            {abaAtiva === 'servicos' && <AdminServicos servicos={servicos} aoMudar={aoMudar} />}
            {abaAtiva === 'produtos' && <AdminProdutos />}
            {abaAtiva === 'barbeiros' && <AdminBarbeiros />}
            {abaAtiva === 'clientes' && <AdminClientes />}
            {abaAtiva === 'planos' && <AdminPlanos />}
            {abaAtiva === 'fiado' && <AdminFiado />}
            {abaAtiva === 'caixa' && <AdminCaixa />}
            {abaAtiva === 'gerencia' && <AdminGerencia />}
            {abaAtiva === 'configuracoes' && <AdminConfiguracoes />}

            {/* <-- ADICIONADO: Renderização do componente Sobre --> */}
            {abaAtiva === 'sobre' && <Sobre />}
          </div>
        </div>
      </main>

    </div>
  )
}