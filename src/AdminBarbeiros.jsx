import { useState, useEffect } from 'react'
import { auth, db, firebaseConfig } from './firebase'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth'
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, updateDoc, setDoc, onSnapshot, serverTimestamp,
  query, where
} from 'firebase/firestore'
import {
  Check, X, Calendar, Plus, Lock,
  Users, BarChart3, Scissors, UserCircle,
  ChevronRight, TrendingUp, Star, MessageSquareText
} from 'lucide-react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { gerarIdTravaHorario, liberarHorario } from './bloqueioUtils'

// Criar ou alterar a senha de acesso de um barbeiro usa createUserWithEmailAndPassword /
// signInWithEmailAndPassword do Firebase Auth — e essas funções, quando chamadas na
// instância principal (`auth`), TROCAM automaticamente o usuário logado para o barbeiro
// que acabou de ser criado/autenticado. Isso derrubava o admin da sessão (ele virava
// "não autorizado" e era deslogado por RequireAdminAuth) toda vez que um barbeiro novo
// era cadastrado ou tinha o PIN alterado. A correção: fazer essas operações numa segunda
// instância isolada do Firebase (mesmo projeto, app secundário), que é descartada logo
// em seguida — a sessão do admin na instância principal nunca é tocada.
const executarSemDeslogarAdmin = async (tarefa) => {
  const appSecundario = initializeApp(firebaseConfig, `barbeiro-auth-${Date.now()}`)
  try {
    const authSecundario = getAuth(appSecundario)
    return await tarefa(authSecundario)
  } finally {
    await deleteApp(appSecundario)
  }
}

const traduzirErroAuth = (codigo) => {
  const mapa = {
    'auth/email-already-in-use': 'Já existe um barbeiro cadastrado com esse nome.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/invalid-email': 'Nome inválido para gerar o acesso — use apenas letras.',
    'auth/wrong-password': 'PIN atual incorreto — não foi possível confirmar a troca.',
    'auth/invalid-credential': 'PIN atual incorreto — não foi possível confirmar a troca.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde um instante e tente novamente.'
  }
  return mapa[codigo] || `Erro: ${codigo}`
}

// IMPORTAÇÃO DOS NOVOS COMPONENTES
import MediaPorBarbeiro from './MediaPorBarbeiro'
import ClientesPorBarbeiro from './ClientesPorBarbeiro'
import AtendimentosPorBarbeiro from './AtendimentosPorBarbeiro'
import AdminAvaliacoes from './AdminAvaliacoes'

// Bug encontrado no passeio visual: a data de início (dataInicio, salva como "AAAA-MM-DD")
// era exibida crua no card, em formato ISO ("2006-06-21") em vez do formato brasileiro
// ("21/06/2006"). E quando faltava idade e data (barbeiro "Antunes"), o card mostrava
// "ANOS •" pendurado, com o "•" solto e nada nos dois lados.
const formatarDataBR = (dataISO) => {
  if (!dataISO) return ''
  const [ano, mes, dia] = dataISO.split('-')
  if (!ano || !mes || !dia) return dataISO
  return `${dia}/${mes}/${ano}`
}

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

  // CORES DA PERSONALIZACAO - o modal de Editar/Novo Barbeiro usava var(--cor-input-bg) puro,
  // que nunca e sobrescrito pelas cores da barbearia (fica sempre escuro), enquanto o texto
  // ja segue a personalizacao - resultado: texto quase ilegivel sobre fundo escuro. Outros
  // paineis (AdminServicos.jsx etc.) ja usam configCores.fundo/texto pra evitar isso.
  const [configCores, setConfigCores] = useState(null)

  useEffect(() => {
    const unsubBarbeiros = onSnapshot(collection(db, "barbeiros"), (snap) => {
      setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    const unsubConfig = onSnapshot(doc(db, "configuracoes", "plano"), (doc) => {
      if (doc.exists()) {
        setLimite(doc.data().limiteBarbeiros || 0)
      }
    })

    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) setConfigCores(docSnap.data().cores);
    })

    return () => { unsubBarbeiros(); unsubConfig(); unsubCores(); }
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
      toast.success("Solicitação enviada com sucesso!");
    } catch (e) {
      toast.error("Erro ao enviar solicitação.");
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
          await executarSemDeslogarAdmin(async (authSecundario) => {
            const userCred = await signInWithEmailAndPassword(authSecundario, barbeiroAtual.emailAcesso, barbeiroAtual.senhaAcesso)
            await updatePassword(userCred.user, form.senha)
          })
          dadosBarbeiro.senhaAcesso = form.senha
        } else {
          dadosBarbeiro.senhaAcesso = barbeiroAtual.senhaAcesso
        }
        await updateDoc(doc(db, "barbeiros", form.id), dadosBarbeiro)

        // O nome do barbeiro é gravado por valor (string) em cada agendamento/comanda —
        // não existe referência por id. Sem esta cascata, renomear um barbeiro (corrigir
        // um typo, por exemplo) deixava todo o histórico anterior órfão: sumia da própria
        // agenda dele (PainelBarbeiro.jsx filtra "where barbeiro == nome"), da coluna dele
        // no Dashboard/Agenda, e o faturamento/comissão de antes do rename ficava preso
        // num nome que não existe mais em nenhum relatório (Comissões, Gerência, Ticket
        // Médio) — parecendo receita perdida em vez de só ter mudado de nome.
        if (barbeiroAtual.nome !== form.nome) {
          const [snapAgendamentos, snapComandas] = await Promise.all([
            getDocs(query(collection(db, "agendamentos"), where("barbeiro", "==", barbeiroAtual.nome))),
            getDocs(query(collection(db, "comandas"), where("barbeiro", "==", barbeiroAtual.nome)))
          ]);
          const atualizacoes = [
            ...snapAgendamentos.docs.map(d => updateDoc(doc(db, "agendamentos", d.id), { barbeiro: form.nome })),
            ...snapComandas.docs.map(d => updateDoc(doc(db, "comandas", d.id), { barbeiro: form.nome }))
          ];
          if (atualizacoes.length > 0) await Promise.all(atualizacoes);

          // Bug real encontrado (interação com a trava de horário anti-double-booking):
          // agendamentos e bloqueios Pendentes/Bloqueados guardam uma "trava" de horário
          // (ver bloqueioUtils.js) cujo ID é baseado no NOME do barbeiro. Só renomear o
          // campo "barbeiro" no agendamento, sem migrar a trava, deixaria a trava antiga
          // (com o nome velho) travada para sempre — nenhum cancelamento futuro a
          // encontraria mais para liberar, "perdendo" aquele horário permanentemente.
          const paraMigrarTrava = snapAgendamentos.docs.filter(d => {
            const status = d.data().status;
            return status === 'Pendente' || status === 'Bloqueado';
          });
          if (paraMigrarTrava.length > 0) {
            await Promise.all(paraMigrarTrava.map(async d => {
              const dados = d.data();
              await liberarHorario(barbeiroAtual.nome, dados.data, dados.hora);
              await setDoc(doc(db, "travasHorario", gerarIdTravaHorario(form.nome, dados.data, dados.hora)), {
                barbeiro: form.nome,
                data: dados.data,
                hora: dados.hora,
                colecao: "agendamentos",
                agendamentoId: d.id,
                criadoEm: new Date().toISOString()
              });
            }));
          }
        }

        toast.success("Barbeiro atualizado com sucesso!")
      } else {
        const emailFicticio = `${form.nome.toLowerCase().replace(/\s/g, '')}@antunes.com`
        const uid = await executarSemDeslogarAdmin(async (authSecundario) => {
          const credencial = await createUserWithEmailAndPassword(authSecundario, emailFicticio, form.senha)
          return credencial.user.uid
        })
        dadosBarbeiro.uid = uid
        dadosBarbeiro.emailAcesso = emailFicticio
        dadosBarbeiro.senhaAcesso = form.senha
        await addDoc(collection(db, "barbeiros"), dadosBarbeiro)
        toast.success("Barbeiro cadastrado com sucesso!")
      }
      fecharModal()
    } catch (error) {
      setErro(traduzirErroAuth(error.code))
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
            { id: 'avaliacoes', label: 'Avaliações', icon: MessageSquareText },
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
          
          {/* BUG ENCONTRADO NO PASSEIO VISUAL: "md:grid-cols-2 lg:grid-cols-3" decide o número
              de colunas só pela largura da JANELA, sem saber que o painel admin sempre reserva
              espaço pra sidebar. Numa janela um pouco mais estreita (ex: ~800px, comum em
              notebook menor ou navegador não maximizado) o breakpoint "md" já força 2 colunas,
              cada uma com menos de 190px — não cabe avatar (64px) + nome, e o nome do barbeiro
              trunca pra 1 letra ("S...", "BE...", "A..."). Troquei pra um grid que decide o
              número de colunas pelo espaço realmente disponível (nunca menos de 260px por
              cartão), então ele nunca fica pequeno demais pro conteúdo. */}
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
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
                        {[b.idade ? `${b.idade} Anos` : null, formatarDataBR(b.dataInicio) || null].filter(Boolean).join(' • ')}
                    </p>
                    {/* O PIN não é mais exibido aqui (vazamento de credencial no card do barbeiro).
                        Ele ainda é necessário para conferência ao editar — veja o modal de edição. */}
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
                    <button onClick={async () => {
                      const resultado = await Swal.fire({
                        title: 'Remover barbeiro?',
                        text: `Deseja remover ${b.nome} da equipe? O acesso ao painel dele será revogado.`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'Sim, remover!',
                        cancelButtonText: 'Cancelar'
                      })
                      if (resultado.isConfirmed) {
                        try {
                          await deleteDoc(doc(db, "barbeiros", b.id))
                          toast.success("Barbeiro removido da equipe.")
                        } catch (e) {
                          toast.error("Erro ao remover barbeiro.")
                        }
                      }
                    }}
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
      {secao === 'avaliacoes' && <AdminAvaliacoes barbeiros={barbeiros} />}

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
                         style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)', '--tw-ring-color': 'var(--cor-primaria)' }} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Idade</label>
                  <input required type="number" value={form.idade} onChange={e => setForm({...form, idade: e.target.value})}
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Data de Início</label>
                  <input required type="date" value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})}
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Senha de Acesso (PIN)</label>
                  <input required type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})}
                         placeholder="Mínimo 6 caracteres"
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Instagram (sem @)</label>
                <input type="text" value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})}
                       className="w-full px-6 py-4 rounded-2xl border outline-none"
                       style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
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
                        style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
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