import { WifiOff } from 'lucide-react'
import { useStatusConexao } from './useStatusConexao'

// Aviso fixo no topo da tela, mostrado sempre que o app não consegue confirmar
// que está conversando com o servidor (sem internet, ou Firestore fora do ar/
// inacessível). Usado nos dois PWAs instaláveis (site do cliente e o do
// barbeiro/Team Antunes) — ver useStatusConexao.js para a lógica de detecção.
export default function AvisoConexao() {
  const semConexao = useStatusConexao()
  if (!semConexao) return null

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white text-xs md:text-sm font-black uppercase tracking-wide text-center py-2 px-4 flex items-center justify-center gap-2 shadow-lg animate-in fade-in slide-in-from-top duration-300"
    >
      <WifiOff size={14} className="shrink-0" />
      Sem conexão com o servidor — verifique sua internet
    </div>
  )
}
