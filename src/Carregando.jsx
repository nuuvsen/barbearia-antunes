import { Loader2 } from 'lucide-react'

// Componente de carregamento reutilizável.
//
// Bug real encontrado: cada tela do painel reinventava o próprio "carregando..." do zero,
// com estilos diferentes entre si (algumas usavam texto puro com animate-pulse, outras um
// ícone Loader2 girando, outras um RefreshCcw, cores fixas tipo "text-gray-400" que não
// respeitavam o tema claro/escuro do usuário, etc.) — e várias telas que buscam dados no
// Firebase ao montar simplesmente não mostravam nada enquanto isso, arriscando um "flash"
// de conteúdo vazio ou com as cores padrão erradas. Este componente centraliza um único
// visual (usando as variáveis CSS de tema --cor-primaria/--cor-texto-secundario, que
// funcionam nos dois temas) para ser reaproveitado em qualquer tela ou modal.
//
// Uso:
//   <Carregando />                              → tela cheia, texto padrão "Carregando..."
//   <Carregando label="Carregando clientes..." />  → tela cheia, texto customizado
//   <Carregando tela={false} label="Salvando..." /> → variante compacta/inline (dentro de um card, modal pequeno etc.)
export default function Carregando({ label = 'Carregando...', tela = true, tamanho = 40 }) {
  if (!tela) {
    return (
      <div className="flex items-center justify-center gap-3 py-10 animate-in fade-in duration-300">
        <Loader2 className="animate-spin" size={Math.round(tamanho * 0.6)} style={{ color: 'var(--cor-primaria, #dc2626)' }} />
        <span className="font-black uppercase text-[10px] tracking-widest" style={{ color: 'var(--cor-texto-secundario, #adadad)' }}>{label}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-in fade-in duration-300">
      <Loader2 className="animate-spin" size={tamanho} style={{ color: 'var(--cor-primaria, #dc2626)' }} />
      <p className="font-black uppercase text-[10px] tracking-widest" style={{ color: 'var(--cor-texto-secundario, #adadad)' }}>{label}</p>
    </div>
  )
}
