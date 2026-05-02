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

// IMPORTAÇÃO DOS NOVOS COMPONENTES
import MediaPorBarbeiro from './MediaPorBarbeiro'
import ClientesPorBarbeiro from './ClientesPorBarbeiro'
import AtendimentosPorBarbeiro from './AtendimentosPorBarbeiro'

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
  const [secao, setSecao] = useState('equipe')
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
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
            Equipe <span style={{ color: 'var(--cor-primaria)' }}>Antunes</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--cor-texto-secundario)' }}>
            Gestão de profissionais e performance
          </p>
        </div>

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

      {secao === 'media' && <MediaPorBarbeiro barbeiros={barbeiros} />}
      {secao === 'clientes' && <ClientesPorBarbeiro barbeiros={barbeiros} />}
      {secao === 'atendimentos' && <AtendimentosPorBarbeiro barbeiros={barbeiros} />}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3rem] border p-8 shadow-2xl"
               style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
            
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                {form.id ? 'Editar' : 'Novo'} <span style={{ color: 'var(--cor-primaria)' }}>Barbeiro</span>
              </h2>
              <button onClick={fecharModal} className="p-2 hover:opacity-50 transition-opacity">
                <X size={24} style={{ color: 'var(--cor-texto-principal)' }} />
              </button>
            </div>

            <form onSubmit={salvar} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Nome Completo</label>
                  <input required type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
                         className="w-full px-6 py-4 rounded-2xl border outline-none transition-all focus:ring-2"
                         style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)', '--tw-ring-color': 'var(--cor-primaria)' }} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Idade</label>
                  <input required type="number" value={form.idade} onChange={e => setForm({...form, idade: e.target.value})}
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Data de Início</label>
                  <input required type="date" value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})}
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Senha de Acesso (PIN)</label>
                  <input required type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})}
                         placeholder="Mínimo 6 caracteres"
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Instagram (sem @)</label>
                <input type="text" value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})}
                       className="w-full px-6 py-4 rounded-2xl border outline-none"
                       style={{ backgroundColor: 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }} />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Dias de Trabalho</label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_DA_SEMANA.map(dia => (
                    <button key={dia.id} type="button" onClick={() => toggleDia(dia.id)}
                            className="flex-1 min-w-[80px] py-3 rounded-xl font-black text-[10px] uppercase transition-all border"
                            style={{ 
                              backgroundColor: form.diasTrabalho[dia.id] ? 'var(--cor-primaria)' : 'transparent',
                              borderColor: form.diasTrabalho[dia.id] ? 'var(--cor-primaria)' : 'var(--cor-borda)',
                              color: form.diasTrabalho[dia.id] ? '#fff' : 'var(--cor-texto-secundario)'
                            }}>
                      {dia.nome}
                    </button>
                  ))}
                </div>
              </div>

              {erro && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase text-center">
                  {erro}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={fecharModal}
                        className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest"
                        style={{ backgroundColor: 'var(--cor-input-bg)', color: 'var(--cor-texto-principal)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={carregando}
                        className="flex-[2] py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--cor-primaria)', color: '#fff' }}>
                  {carregando ? 'Salvando...' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}