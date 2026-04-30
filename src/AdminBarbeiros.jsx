import { useState, useEffect } from 'react'
import { auth, db } from './firebase' 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth' 
import { 
  collection, getDocs, addDoc, deleteDoc, 
  doc, updateDoc, onSnapshot, serverTimestamp 
} from 'firebase/firestore'
import { 
  Check, X, Calendar, Plus, Lock, 
  Users, BarChart3, Scissors, UserCircle, 
  ChevronRight, TrendingUp, Star 
} from 'lucide-react'

const DIAS_DA_SEMANA = [
  { id: 'seg', nome: 'Segunda' }, { id: 'ter', nome: 'Terça' }, { id: 'qua', nome: 'Quarta' },
  { id: 'qui', nome: 'Quinta' }, { id: 'sex', nome: 'Sexta' }, { id: 'sab', nome: 'Sábado' }, { id: 'dom', nome: 'Domingo' },
]

const FotoPadrao = () => (
  <div className="w-full h-full flex items-center justify-center rounded-full border-2 border-dashed group-hover:brightness-125 transition-all"
       style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-primaria)' }}>
    <svg viewBox="0 0 100 100" className="w-12 h-12 fill-none stroke-current" strokeWidth="3" style={{ color: 'var(--cor-primaria)' }}>
      <path d="M70 20 L30 60 L20 50 L60 10 Z" fill="currentColor" opacity="0.2" />
      <path d="M30 60 L75 15" strokeLinecap="round" />
      <text x="50%" y="65%" textAnchor="middle" className="font-black italic tracking-tighter" fontSize="30" style={{ fill: 'var(--cor-primaria)' }}>A</text>
    </svg>
  </div>
)

export default function AdminBarbeiros() {
  const [secao, setSecao] = useState('equipe') // Controle de abas
  const [barbeiros, setBarbeiros] = useState([])
  const [limite, setLimite] = useState(0)
  const [erro, setErro] = useState('') 
  const [carregando, setCarregando] = useState(false) 
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false) 
  
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

  // FUNÇÕES DE GESTÃO
  const solicitarUpgrade = async () => {
    if (enviandoSolicitacao) return;
    setEnviandoSolicitacao(true);
    try {
      await addDoc(collection(db, "solicitacoes"), {
        cliente: "Barbearia Antunes", 
        mensagem: "Deseja aumentar o limite de barbeiros",
        data: serverTimestamp(),
        status: "pendente"
      });
      alert("Solicitação enviada com sucesso!");
    } catch (e) {
      alert("Erro ao enviar solicitação.");
    } finally { setEnviandoSolicitacao(false); }
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
      setErro("Limite atingido.")
      return
    }
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
      
      {/* HEADER DINÂMICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
            Equipe <span style={{ color: 'var(--cor-primaria)' }}>Antunes</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--cor-texto-secundario)' }}>
            Gestão de profissionais e performance
          </p>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl border" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
          {[
            { id: 'equipe', label: 'Barbeiros', icon: UserCircle },
            { id: 'media', label: 'Médias', icon: Star },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'atendimentos', label: 'Atendimentos', icon: Scissors },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setSecao(item.id)}
              className="px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center gap-2"
              style={{ 
                backgroundColor: secao === item.id ? 'var(--cor-primaria)' : 'transparent',
                color: secao === item.id ? '#ffffff' : 'var(--cor-texto-secundario)',
              }}
            >
              <item.icon size={14} /> {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTEÚDO: LISTA DE BARBEIROS */}
      {secao === 'equipe' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between px-2">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
               {barbeiros.length} de {limite} ativos no plano
             </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {barbeiros.map(b => (
              <div key={b.id} className="p-6 rounded-3xl border flex flex-col justify-between gap-6 group transition-all hover:brightness-125 shadow-sm"
                   style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 relative flex-shrink-0">
                    {b.foto ? 
                      <img src={b.foto} className="w-full h-full rounded-full border-2 object-cover" style={{ borderColor: 'var(--cor-primaria)' }} alt={b.nome} /> 
                      : <FotoPadrao />
                    }
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-black text-xl uppercase tracking-tighter truncate" style={{ color: 'var(--cor-texto-principal)' }}>
                        {b.nome}
                    </p>
                    <p className="text-[10px] uppercase font-bold tracking-widest mb-1" style={{ color: 'var(--cor-texto-secundario)' }}>
                        {b.idade} Anos • {b.dataInicio}
                    </p>
                    {b.senhaAcesso && <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--cor-primaria)' }}>PIN: {b.senhaAcesso}</p>}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-1">
                    {DIAS_DA_SEMANA.map(d => {
                      const estaTrabalhando = b.diasTrabalho?.[d.id];
                      return (
                        <div key={d.id} className="text-[8px] px-1.5 py-0.5 rounded font-black"
                             style={estaTrabalhando ? 
                                { backgroundColor: 'var(--cor-primaria-opaca)', color: 'var(--cor-primaria)' } : 
                                { backgroundColor: 'var(--cor-input-bg)', color: 'var(--cor-texto-secundario)' }
                             }>
                          {d.id.toUpperCase()}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 border-t pt-4" style={{ borderColor: 'var(--cor-borda)' }}>
                    <button onClick={() => prepararEdicao(b)} 
                            className="flex-1 py-2.5 rounded-xl transition-all flex justify-center items-center hover:brightness-125"
                            style={{ backgroundColor: 'var(--cor-bg-botao)', color: 'var(--cor-texto-principal)' }}>
                      ✏️
                    </button>
                    <button onClick={async () => { if(confirm("Remover da equipe?")) { await deleteDoc(doc(db, "barbeiros", b.id)); } }} 
                            className="flex-1 py-2.5 rounded-xl transition-all flex justify-center items-center hover:brightness-125"
                            style={{ backgroundColor: 'var(--cor-bg-botao)', color: 'var(--cor-texto-principal)' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* BOTAO ADICIONAR / UPGRADE */}
            {!limiteAtingido ? (
              <button onClick={prepararCriacao} 
                className="border-2 border-dashed p-8 rounded-3xl flex flex-col items-center justify-center gap-3 group transition-all min-h-[220px] hover:brightness-110"
                style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--cor-bg-botao)' }}>
                  <Plus size={24} style={{ color: 'var(--cor-texto-principal)' }} />
                </div>
                <p className="font-black uppercase tracking-widest text-[10px]" style={{ color: 'var(--cor-texto-secundario)' }}>Novo Barbeiro</p>
              </button>
            ) : (
              <button onClick={solicitarUpgrade} disabled={enviandoSolicitacao}
                className="border-2 p-8 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all min-h-[220px] hover:brightness-110"
                style={{ backgroundColor: 'var(--cor-primaria-opaca)', borderColor: 'var(--cor-primaria-suave)' }}>
                <Lock size={20} style={{ color: 'var(--cor-primaria)' }} />
                <p className="font-black uppercase tracking-widest text-[11px] text-center" style={{ color: 'var(--cor-primaria)' }}>
                  {enviandoSolicitacao ? 'Enviando...' : 'Aumentar Limite'}
                </p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* SEÇÃO: MÉDIA POR BARBEIRO */}
      {secao === 'media' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-500">
          {barbeiros.map(b => (
            <div key={b.id} className="p-6 rounded-[2.5rem] border flex items-center justify-between" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                   <Star size={18} className="text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <p className="font-black uppercase text-xs" style={{ color: 'var(--cor-texto-principal)' }}>{b.nome}</p>
                  <p className="text-[9px] font-bold uppercase opacity-50">Avaliação Média</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black italic" style={{ color: 'var(--cor-primaria)' }}>4.9</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-green-500">Expetacular</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SEÇÃO: CLIENTES POR BARBEIRO */}
      {secao === 'clientes' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          {barbeiros.map(b => (
            <div key={b.id} className="p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
              <div className="flex items-center gap-4 min-w-[200px]">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--cor-input-bg)' }}>
                  <Users size={20} style={{ color: 'var(--cor-primaria)' }} />
                </div>
                <p className="font-black uppercase text-sm tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>{b.nome}</p>
              </div>
              
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-blue-500" style={{ width: '70%' }} /> {/* Simulação de volume */}
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-lg font-black" style={{ color: 'var(--cor-texto-principal)' }}>142</p>
                  <p className="text-[8px] font-black uppercase opacity-50">Clientes Únicos</p>
                </div>
                <ChevronRight size={20} className="opacity-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SEÇÃO: ATENDIMENTOS POR BARBEIRO */}
      {secao === 'atendimentos' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {barbeiros.map(b => (
            <div key={b.id} className="p-8 rounded-[3rem] border text-center space-y-4" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--cor-primaria-opaca)' }}>
                <Scissors size={24} style={{ color: 'var(--cor-primaria)' }} />
              </div>
              <div>
                <p className="font-black uppercase text-lg tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>{b.nome}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500 flex items-center justify-center gap-1">
                  <TrendingUp size={10} /> +12% este mês
                </p>
              </div>
              <div className="pt-4 border-t" style={{ borderColor: 'var(--cor-borda)' }}>
                <p className="text-4xl font-black italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>328</p>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mt-1">Cortes Realizados</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL (MANTIDO IGUAL) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={fecharModal} />
          <div className="w-full max-w-lg p-8 rounded-[40px] border relative shadow-2xl overflow-y-auto max-h-[90vh]"
               style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
            
            <button onClick={fecharModal} className="absolute top-6 right-6" style={{ color: 'var(--cor-texto-secundario)' }}>
              <X size={24} />
            </button>

            <h2 className="text-2xl font-black mb-8 uppercase italic" style={{ color: 'var(--cor-primaria)' }}>
              {form.id ? 'Editar Perfil' : 'Novo Barbeiro'}
            </h2>
            
            <form onSubmit={salvar} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase ml-2 tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Nome Profissional</label>
                  <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} 
                         className="w-full border p-4 rounded-2xl outline-none" 
                         style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase ml-2 tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Senha / PIN</label>
                  <input value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} 
                         className="w-full border p-4 rounded-2xl outline-none" 
                         style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} required />
                </div>
              </div>

              <div className="pt-6 border-t" style={{ borderColor: 'var(--cor-borda)' }}>
                <h3 className="text-[10px] font-black uppercase mb-4 flex items-center gap-2" style={{ color: 'var(--cor-texto-secundario)' }}>
                  <Calendar size={12} style={{ color: 'var(--cor-primaria)' }} /> Dias de Atendimento
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIAS_DA_SEMANA.map((dia) => {
                    const diaAtivo = form.diasTrabalho[dia.id];
                    return (
                      <button key={dia.id} type="button" onClick={() => toggleDia(dia.id)} 
                              className="flex justify-between items-center p-3 rounded-xl border transition-all"
                              style={diaAtivo ? 
                                { backgroundColor: 'var(--cor-primaria-opaca)', borderColor: 'var(--cor-primaria-suave)', color: 'var(--cor-primaria)' } : 
                                { backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}>
                        <span className="font-black text-[10px] uppercase">{dia.id}</span>
                        {diaAtivo ? <Check size={12} /> : <X size={12} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {erro && <p className="text-[10px] font-black uppercase text-center" style={{ color: 'var(--cor-primaria)' }}>{erro}</p>}

              <button type="submit" disabled={carregando} 
                      className="w-full font-black py-4 rounded-2xl uppercase tracking-widest hover:brightness-110 transition-all"
                      style={{ backgroundColor: 'var(--cor-primaria)', color: '#FFFFFF' }}>
                {carregando ? 'Gravando...' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}