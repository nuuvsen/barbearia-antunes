import { useState, useEffect } from 'react'
import { auth, db } from './firebase' 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth' 
import { 
  collection, getDocs, addDoc, deleteDoc, 
  doc, updateDoc, onSnapshot, serverTimestamp 
} from 'firebase/firestore'
import { Check, X, Calendar, Plus, Lock, Send } from 'lucide-react'

const DIAS_DA_SEMANA = [
  { id: 'seg', nome: 'Segunda' }, { id: 'ter', nome: 'Terça' }, { id: 'qua', nome: 'Quarta' },
  { id: 'qui', nome: 'Quinta' }, { id: 'sex', nome: 'Sexta' }, { id: 'sab', nome: 'Sábado' }, { id: 'dom', nome: 'Domingo' },
]

const FotoPadrao = () => (
  <div className="w-full h-full bg-[#1c1c1c] flex items-center justify-center rounded-full border-2 border-dashed border-red-600/30 group-hover:border-red-600 transition-colors">
    <svg viewBox="0 0 100 100" className="w-12 h-12 fill-none stroke-red-600" strokeWidth="3">
      <path d="M70 20 L30 60 L20 50 L60 10 Z" fill="currentColor" opacity="0.2" />
      <path d="M30 60 L75 15" strokeLinecap="round" />
      <text x="50%" y="65%" textAnchor="middle" className="fill-red-600 font-black italic tracking-tighter" fontSize="30">A</text>
    </svg>
  </div>
)

export default function AdminBarbeiros() {
  const [barbeiros, setBarbeiros] = useState([])
  const [limite, setLimite] = useState(0)
  const [erro, setErro] = useState('') 
  const [carregando, setCarregando] = useState(false) 
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false) // Estado para o botão de upgrade
  
  const agendaInicial = { seg: true, ter: true, qua: true, qui: true, sex: true, sab: true, dom: false }

  const [form, setForm] = useState({ 
    id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '', senha: '',
    diasTrabalho: agendaInicial 
  })

  useEffect(() => {
    const unsubBarbeiros = onSnapshot(collection(db, "barbeiros"), (snap) => {
      setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    const unsubConfig = onSnapshot(doc(db, "configuracoes", "plano"), (doc) => {
      if (doc.exists()) {
        setLimite(doc.data().limiteBarbeiros || 0)
      }
    })

    return () => { unsubBarbeiros(); unsubConfig(); }
  }, [])

  // FUNÇÃO DE UPGRADE INTEGRADA
  const solicitarUpgrade = async () => {
    if (enviandoSolicitacao) return;
    
    setEnviandoSolicitacao(true);
    try {
      await addDoc(collection(db, "solicitacoes"), {
        cliente: "Barbearia Antunes", // Aqui você pode usar auth.currentUser.displayName se tiver
        mensagem: "Deseja aumentar o limite de barbeiros",
        data: serverTimestamp(),
        status: "pendente"
      });
      alert("Solicitação enviada com sucesso! O administrador entrará em contato em breve.");
    } catch (e) {
      console.error("Erro ao enviar:", e);
      alert("Erro ao enviar solicitação. Tente novamente mais tarde.");
    } finally {
      setEnviandoSolicitacao(false);
    }
  }

  const toggleDia = (diaId) => {
    setForm(prev => ({ ...prev, diasTrabalho: { ...prev.diasTrabalho, [diaId]: !prev.diasTrabalho[diaId] } }))
  }

  const fecharModal = () => {
    setIsModalOpen(false)
    setErro('')
    setForm({ id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '', senha: '', diasTrabalho: agendaInicial })
  }

  const prepararEdicao = (b) => {
    setErro('')
    setForm({ ...b, senha: b.senhaAcesso || '', diasTrabalho: b.diasTrabalho || agendaInicial })
    setIsModalOpen(true)
  }

  const prepararCriacao = () => {
    if (barbeiros.length >= limite) {
      setErro("Limite do plano atingido.")
      return 
    }
    setErro('')
    setForm({ id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '', senha: '', diasTrabalho: agendaInicial })
    setIsModalOpen(true)
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.id && barbeiros.length >= limite) {
      setErro("Você atingiu o limite de colaboradores do seu plano.")
      return
    }
    if (!form.nome || form.senha.length < 6) {
      setErro("Preencha o nome e uma senha de no mínimo 6 dígitos.")
      return
    }
    
    setErro('')
    setCarregando(true)

    try {
      const dadosBarbeiro = {
        nome: form.nome, idade: form.idade, dataInicio: form.dataInicio,
        instagram: form.instagram, foto: form.foto || '', diasTrabalho: form.diasTrabalho 
      }

      if (form.id) {
        const barbeiroAtual = barbeiros.find(b => b.id === form.id)
        if (form.senha !== barbeiroAtual.senhaAcesso) {
          const userCred = await signInWithEmailAndPassword(auth, barbeiroAtual.emailAcesso, barbeiroAtual.senhaAcesso)
          await updatePassword(userCred.user, form.senha)
          await signOut(auth)
          dadosBarbeiro.senhaAcesso = form.senha
        } else {
          dadosBarbeiro.senhaAcesso = barbeiroAtual.senhaAcesso
        }
        await updateDoc(doc(db, "barbeiros", form.id), dadosBarbeiro)
      } else {
        const emailFicticio = `${form.nome.toLowerCase().replace(/\s/g, '')}@antunes.com`
        const credencial = await createUserWithEmailAndPassword(auth, emailFicticio, form.senha)
        dadosBarbeiro.uid = credencial.user.uid
        dadosBarbeiro.emailAcesso = emailFicticio
        dadosBarbeiro.senhaAcesso = form.senha 
        await addDoc(collection(db, "barbeiros"), dadosBarbeiro)
      }
      fecharModal()
    } catch (error) {
      setErro(`Erro: ${error.code}`)
    } finally { setCarregando(false) }
  }

  const limiteAtingido = barbeiros.length >= limite;

  return (
    <div className="animate-in fade-in duration-500 pb-20 px-4">
      {/* HEADER COM STATUS DO PLANO */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Equipe <span className="text-red-600">Antunes</span>
          </h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">
            Plano atual: {barbeiros.length} de {limite} barbeiros ativos
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* LISTAGEM DE BARBEIROS */}
        {barbeiros.map(b => (
          <div key={b.id} className="bg-[#111111] p-6 rounded-3xl border border-[#1f1f1f] flex flex-col justify-between gap-6 group transition-all hover:border-red-600/40">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 relative flex-shrink-0">
                {b.foto ? <img src={b.foto} className="w-full h-full rounded-full border-2 border-red-600 object-cover" alt={b.nome} /> : <FotoPadrao />}
              </div>
              <div className="overflow-hidden">
                <p className="font-black text-xl uppercase tracking-tighter text-white truncate">{b.nome}</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">{b.idade} Anos • {b.dataInicio}</p>
                {b.senhaAcesso && <p className="text-[9px] text-red-500 font-black uppercase tracking-widest">PIN: {b.senhaAcesso}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1">
                {DIAS_DA_SEMANA.map(d => (
                  <div key={d.id} className={`text-[8px] px-1.5 py-0.5 rounded font-black ${b.diasTrabalho?.[d.id] ? 'bg-green-600/20 text-green-500' : 'bg-white/5 text-gray-600'}`}>
                    {d.id.toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t border-white/5 pt-4">
                <button onClick={() => prepararEdicao(b)} className="flex-1 bg-[#1c1c1c] py-2.5 rounded-xl hover:bg-white hover:text-black transition-all flex justify-center items-center">✏️</button>
                <button onClick={async () => { if(confirm("Remover da equipe?")) { await deleteDoc(doc(db, "barbeiros", b.id)); } }} className="flex-1 bg-[#1c1c1c] py-2.5 rounded-xl hover:bg-red-600 transition-all text-white flex justify-center items-center">🗑️</button>
              </div>
            </div>
          </div>
        ))}

        {/* CARD DINÂMICO (NOVO OU SOLICITAR UPGRADE) */}
        {!limiteAtingido ? (
          <button 
            onClick={prepararCriacao} 
            className="border-2 border-dashed border-[#1f1f1f] p-8 rounded-3xl flex flex-col items-center justify-center gap-3 group hover:border-red-600 transition-all bg-[#0a0a0a]/50 min-h-[220px]"
          >
            <div className="w-12 h-12 rounded-full bg-[#1c1c1c] flex items-center justify-center group-hover:bg-red-600 transition-all shadow-lg">
              <Plus size={24} className="text-gray-500 group-hover:text-white" />
            </div>
            <p className="text-gray-500 font-black uppercase tracking-widest text-[10px] group-hover:text-white text-center">Contratar Novo Barbeiro</p>
          </button>
        ) : (
          <button 
            onClick={solicitarUpgrade}
            disabled={enviandoSolicitacao}
            className="border-2 border-red-600/20 bg-red-600/5 p-8 rounded-3xl flex flex-col items-center justify-center gap-3 group hover:bg-red-600/10 transition-all min-h-[220px] relative overflow-hidden w-full text-left"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${enviandoSolicitacao ? 'bg-zinc-800' : 'bg-red-600 shadow-red-600/40'}`}>
              {enviandoSolicitacao ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white" /> : <Lock size={20} className="text-white" />}
            </div>
            <div className="text-center">
              <p className="text-red-600 font-black uppercase tracking-widest text-[11px]">
                {enviandoSolicitacao ? 'Enviando Pedido...' : 'Solicitar aumento de colaboradores'}
              </p>
              <p className="text-[8px] text-gray-500 uppercase font-bold mt-1">Limite de {limite} vagas atingido</p>
            </div>
            {!enviandoSolicitacao && (
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase text-white bg-red-600 px-3 py-1.5 rounded-full tracking-widest animate-pulse">
                <Send size={10} /> Enviar agora
              </div>
            )}
          </button>
        )}
      </div>

      {/* MODAL POP-UP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={fecharModal} />
          <div className="bg-[#111111] w-full max-w-lg p-8 rounded-[40px] border border-[#1f1f1f] relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={fecharModal} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-2xl font-black mb-8 uppercase italic text-red-600">{form.id ? 'Editar Perfil' : 'Novo Barbeiro'}</h2>
            
            <form onSubmit={salvar} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-2 tracking-widest">Nome do Profissional</label>
                  <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Rodrigo Antunes" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-2 tracking-widest">Senha / PIN</label>
                  <input value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} placeholder="Mínimo 6 dígitos" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input value={form.idade} onChange={e => setForm({...form, idade: e.target.value})} placeholder="Idade" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all" />
                  <input value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} placeholder="Início" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all" />
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <h3 className="text-[10px] font-black uppercase text-gray-500 mb-4 flex items-center gap-2"><Calendar size={12} className="text-red-600" /> Dias de Atendimento</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIAS_DA_SEMANA.map((dia) => (
                    <button key={dia.id} type="button" onClick={() => toggleDia(dia.id)} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${form.diasTrabalho[dia.id] ? 'bg-red-600/10 border-red-600/40 text-white' : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-700'}`}>
                      <span className="font-bold text-[10px] uppercase tracking-tighter">{dia.id}</span>
                      {form.diasTrabalho[dia.id] ? <Check size={12} className="text-red-600" /> : <X size={12} />}
                    </button>
                  ))}
                </div>
              </div>

              {erro && <p className="text-red-500 text-[10px] font-black uppercase text-center animate-pulse">{erro}</p>}

              <button type="submit" disabled={carregando} className={`w-full text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all ${carregando ? 'bg-zinc-800 text-zinc-500 cursor-wait' : 'bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20'}`}>
                {carregando ? 'Processando...' : (form.id ? 'Salvar Alterações' : 'Confirmar Contratação')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}