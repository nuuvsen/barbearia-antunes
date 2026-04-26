import { useState, useEffect } from 'react'
import { auth, db } from './firebase' 
// Importamos novas ferramentas do Firebase Auth para o "truque" da senha
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth' 
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Check, X, Calendar } from 'lucide-react'

const DIAS_DA_SEMANA = [
  { id: 'seg', nome: 'Segunda' },
  { id: 'ter', nome: 'Terça' },
  { id: 'qua', nome: 'Quarta' },
  { id: 'qui', nome: 'Quinta' },
  { id: 'sex', nome: 'Sexta' },
  { id: 'sab', nome: 'Sábado' },
  { id: 'dom', nome: 'Domingo' },
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
  const [erro, setErro] = useState('') 
  const [carregando, setCarregando] = useState(false) 
  
  const agendaInicial = {
    seg: true, ter: true, qua: true, qui: true, sex: true, sab: true, dom: false
  }

  const [form, setForm] = useState({ 
    id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '', senha: '',
    diasTrabalho: agendaInicial 
  })

  const carregar = async () => {
    const snap = await getDocs(collection(db, "barbeiros"))
    setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { carregar() }, [])

  const toggleDia = (diaId) => {
    setForm(prev => ({
      ...prev,
      diasTrabalho: {
        ...prev.diasTrabalho,
        [diaId]: !prev.diasTrabalho[diaId]
      }
    }))
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome || form.senha.length < 6) {
      setErro("Preencha o nome e uma senha de no mínimo 6 dígitos.")
      return
    }
    
    setErro('')
    setCarregando(true)

    try {
      const dadosBarbeiro = {
        nome: form.nome,
        idade: form.idade,
        dataInicio: form.dataInicio,
        instagram: form.instagram,
        foto: form.foto || '',
        diasTrabalho: form.diasTrabalho 
      }

      if (form.id) {
        // --- MODO EDIÇÃO ---
        const barbeiroAtual = barbeiros.find(b => b.id === form.id)

        // Se o admin digitou uma senha diferente da que estava salva
        if (form.senha !== barbeiroAtual.senhaAcesso) {
          if (!barbeiroAtual.senhaAcesso) {
            setErro("Este barbeiro é antigo e não tem senha salva. Exclua e crie novamente.")
            setCarregando(false)
            return
          }

          try {
            // 1. Loga rapidamente como o barbeiro usando a senha antiga
            const userCred = await signInWithEmailAndPassword(auth, barbeiroAtual.emailAcesso, barbeiroAtual.senhaAcesso)
            
            // 2. Altera a senha no Firebase Auth
            await updatePassword(userCred.user, form.senha)
            
            // 3. Desloga imediatamente
            await signOut(auth)

            // 4. Salva a nova senha no banco de dados para consultas futuras
            dadosBarbeiro.senhaAcesso = form.senha
          } catch (err) {
            console.error(err)
            setErro("Erro interno ao alterar a senha de segurança.")
            setCarregando(false)
            return
          }
        } else {
          // Se não mudou a senha, mantém a mesma no banco
          dadosBarbeiro.senhaAcesso = barbeiroAtual.senhaAcesso
        }

        await updateDoc(doc(db, "barbeiros", form.id), dadosBarbeiro)

      } else {
        // --- MODO CRIAÇÃO ---
        const emailFicticio = `${form.nome.toLowerCase().replace(/\s/g, '')}@antunes.com`
        const credencial = await createUserWithEmailAndPassword(auth, emailFicticio, form.senha)
        
        dadosBarbeiro.uid = credencial.user.uid
        dadosBarbeiro.emailAcesso = emailFicticio
        dadosBarbeiro.senhaAcesso = form.senha // Salva a senha no banco de dados

        await addDoc(collection(db, "barbeiros"), dadosBarbeiro)
      }

      setForm({ id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '', senha: '', diasTrabalho: agendaInicial })
      carregar()
    } catch (error) {
      console.error("Erro ao salvar:", error)
      if (error.code === 'auth/email-already-in-use') {
        setErro("Já existe um barbeiro com este nome.")
      } else {
        // Mudamos esta linha abaixo para mostrar a mensagem real do erro!
        setErro(`Erro do Firebase: ${error.code}`) 
      }
    } finally {
      setCarregando(false)
    }
  }

  const cancelarEdicao = () => {
    setErro('')
    setForm({ id: null, nome: '', idade: '', dataInicio: '', instagram: '', foto: '', senha: '', diasTrabalho: agendaInicial })
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10 text-white">Equipe <span className="text-red-600">Antunes</span></h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LISTA DE BARBEIROS */}
        <div className="lg:col-span-2 space-y-4">
          {barbeiros.map(b => (
            <div key={b.id} className="bg-[#111111] p-6 rounded-3xl border border-[#1f1f1f] flex flex-col md:flex-row justify-between items-center gap-6 group transition-all">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 relative">
                  {b.foto ? (
                    <img src={b.foto} className="w-full h-full rounded-full border-2 border-red-600 object-cover" alt={b.nome} />
                  ) : (
                    <FotoPadrao />
                  )}
                </div>
                <div>
                  <p className="font-black text-2xl uppercase tracking-tighter text-white">{b.nome}</p>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">{b.idade} Anos • Desde {b.dataInicio}</p>
                  
                  {/* Exibe a senha salva para o Admin ver facilmente */}
                  {b.senhaAcesso && (
                    <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">PIN de Acesso: {b.senhaAcesso}</p>
                  )}
                  
                  {/* Resumo visual dos dias que trabalha */}
                  <div className="flex gap-1 mt-3">
                    {DIAS_DA_SEMANA.map(d => (
                      <div key={d.id} className={`text-[9px] px-1.5 py-0.5 rounded font-black ${b.diasTrabalho?.[d.id] ? 'bg-green-600/20 text-green-500' : 'bg-white/5 text-gray-600'}`}>
                        {d.id.toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {/* Ao clicar em editar, já preenche a senha atual no formulário */}
                <button onClick={() => { setErro(''); setForm({ ...b, senha: b.senhaAcesso || '', diasTrabalho: b.diasTrabalho || agendaInicial }) }} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-white hover:text-black transition-all">✏️</button>
                <button onClick={async () => { if(confirm("Remover da equipe?")) { await deleteDoc(doc(db, "barbeiros", b.id)); carregar(); } }} className="bg-[#1c1c1c] p-3 rounded-xl hover:bg-red-600 transition-all text-white">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* FORMULÁRIO */}
        <div className="bg-[#111111] p-8 rounded-3xl border border-[#1f1f1f] h-fit sticky top-10 shadow-2xl">
          <h2 className="text-xl font-black mb-6 uppercase italic text-red-600">{form.id ? 'Editar' : 'Novo'} Barbeiro</h2>
          <form onSubmit={salvar} className="space-y-6">
            
            <div className="space-y-3">
              <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do Barbeiro" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" required />
              
              {/* O campo de senha agora aparece na Criação e na Edição */}
              <div>
                <input value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} placeholder="Senha de Acesso" type="text" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" required />
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2 ml-2">
                  {form.id ? "Altere os números acima para redefinir a senha" : "Mín. 6 dígitos. O barbeiro usará para login."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input value={form.idade} onChange={e => setForm({...form, idade: e.target.value})} placeholder="Idade" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
                <input value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} placeholder="Início (Ano)" className="w-full bg-[#0a0a0a] border border-[#1f1f1f] p-4 rounded-2xl text-white outline-none focus:border-red-600" />
              </div>
            </div>

            {/* AVISO DE ERRO */}
            {erro && <p className="text-red-500 text-xs font-black uppercase tracking-widest text-center">{erro}</p>}

            {/* SELEÇÃO DE DIAS */}
            <div className="pt-4 border-t border-white/5">
              <h3 className="text-[10px] font-black uppercase text-gray-500 mb-4 flex items-center gap-2 tracking-widest">
                <Calendar size={12} className="text-red-600" /> Dias de Atendimento
              </h3>
              
              <div className="grid grid-cols-1 gap-2">
                {DIAS_DA_SEMANA.map((dia) => (
                  <button 
                    key={dia.id} 
                    type="button"
                    onClick={() => toggleDia(dia.id)}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                      form.diasTrabalho[dia.id] 
                      ? 'bg-red-600/10 border-red-600/40 text-white' 
                      : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-700'
                    }`}
                  >
                    <span className="font-bold text-xs uppercase tracking-tighter">{dia.nome}</span>
                    {form.diasTrabalho[dia.id] ? <Check size={14} className="text-red-600" /> : <X size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={carregando} className={`w-full text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 ${carregando ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>
              {carregando ? 'Salvando...' : (form.id ? 'Atualizar Perfil' : 'Salvar Barbeiro')}
            </button>
            
            {form.id && (
              <button type="button" onClick={cancelarEdicao} className="w-full text-gray-600 text-[10px] font-black uppercase tracking-widest mt-2 hover:text-white transition-colors">
                Cancelar Edição
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}