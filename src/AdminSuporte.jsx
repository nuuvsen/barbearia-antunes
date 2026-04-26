import { useState } from 'react'
import { db } from './firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { MessageSquare, Send, CheckCircle } from 'lucide-react'

export default function AdminSuporte() {
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const enviarTicket = async (e) => {
    e.preventDefault()
    if (!mensagem.trim()) return

    setEnviando(true)
    try {
      await addDoc(collection(db, "solicitacoes"), {
        cliente: "Barbearia Antunes (Painel Admin)",
        mensagem: mensagem,
        tipo: "suporte_tecnico",
        data: serverTimestamp()
      })
      setEnviado(true)
      setMensagem('')
      setTimeout(() => setEnviado(false), 5000) // Reseta o status após 5 segundos
    } catch (error) {
      alert("Erro ao enviar mensagem. Tente novamente.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-[#111] border border-[#1f1f1f] rounded-[2.5rem] p-10 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <MessageSquare className="text-white" size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Central de <span className="text-red-600">Suporte</span></h2>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Sua solicitação vai direto para o desenvolvedor</p>
          </div>
        </div>

        {enviado ? (
          <div className="bg-green-600/10 border border-green-600/30 p-10 rounded-3xl text-center animate-in zoom-in duration-300">
            <div className="flex justify-center mb-4">
               <CheckCircle className="text-green-500" size={48} />
            </div>
            <h3 className="text-white font-black uppercase tracking-widest mb-2">Mensagem Enviada!</h3>
            <p className="text-green-500/70 text-xs font-bold uppercase">Recebemos sua solicitação. Responderemos em breve.</p>
          </div>
        ) : (
          <form onSubmit={enviarTicket} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-4 tracking-[0.2em]">Descreva o seu problema ou sugestão</label>
              <textarea 
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Ex: Gostaria de adicionar um novo serviço ou tive problemas com a agenda..."
                className="w-full bg-black border border-[#1f1f1f] p-6 rounded-3xl text-white min-h-[200px] outline-none focus:border-white transition-all resize-none font-medium leading-relaxed"
              />
            </div>

            <button 
              type="submit"
              disabled={enviando || !mensagem.trim()}
              className="w-full bg-white text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black shadow-xl shadow-white/5"
            >
              {enviando ? "Enviando..." : <><Send size={20} /> Enviar Solicitação</>}
            </button>
          </form>
        )}

        <div className="mt-10 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
           <p className="text-[9px] text-gray-600 uppercase font-bold tracking-widest text-center md:text-left">
             Horário de Atendimento: <span className="text-gray-400">Seg a Sex, 09h às 18h</span>
           </p>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-green-500 uppercase font-black tracking-widest">Sistema Operacional</span>
           </div>
        </div>
      </div>
    </div>
  )
}