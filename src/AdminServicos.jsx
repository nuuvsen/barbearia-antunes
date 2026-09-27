import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'

// Formata minutos num texto legível ("40 min", "1h", "1h 30min") — mesma regra que
// handleTempoChange usava antes, só que agora computada a partir do número, não digitada.
const formatarDuracao = (minutos) => {
  const total = Math.max(0, Math.round(Number(minutos) || 0))
  if (total < 60) return `${total} min`
  const horas = Math.floor(total / 60)
  const restantes = total % 60
  return restantes > 0 ? `${horas}h ${restantes}min` : `${horas}h`
}

// Serviços cadastrados antes desta atualização só tinham o texto livre "tempo" (ex:
// "1h 30min"), sem nenhum número de minutos gravado. Ao abrir um desses pra editar, tenta
// extrair um número de minutos razoável do texto antigo, em vez de abrir o campo zerado —
// o valor final só é regravado de fato quando o usuário salvar o formulário de novo.
const estimarMinutosDoTextoAntigo = (tempoStr) => {
  if (!tempoStr) return 30
  const strMin = String(tempoStr)
  const horasMatch = strMin.match(/(\d+)\s*h/i)
  const minMatch = strMin.match(/(\d+)\s*min/i)
  if (horasMatch || minMatch) {
    return (horasMatch ? parseInt(horasMatch[1], 10) * 60 : 0) + (minMatch ? parseInt(minMatch[1], 10) : 0)
  }
  const somenteNumero = parseInt(strMin.replace(/\D/g, ''), 10)
  return isNaN(somenteNumero) || somenteNumero <= 0 ? 30 : somenteNumero
}

export default function AdminServicos({ servicos, aoMudar }) {
  const [form, setForm] = useState({ id: null, nome: '', preco: '', duracaoMinutos: 30 })
  const [carregando, setCarregando] = useState(false)
  const [configCores, setConfigCores] = useState(null)

  // 1. BUSCA PERSONALIZAÇÃO (CORES) DO FIREBASE EM TEMPO REAL
  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) {
        setConfigCores(docSnap.data().cores);
      }
    });
    return () => unsubCores();
  }, []);

  // --- FUNÇÕES DE MÁSCARA ---
  const handlePrecoChange = (e) => {
    // Remove tudo que não for número
    let valor = e.target.value.replace(/\D/g, "");
    if (!valor) {
      setForm({ ...form, preco: "" });
      return;
    }
    // Divide por 100 para criar os centavos e formata no padrão brasileiro
    const formatoMoeda = (Number(valor) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    setForm({ ...form, preco: `R$ ${formatoMoeda}` });
  };

  // --------------------------

  // Abre um serviço existente pra edição, convertendo o texto antigo em minutos quando o
  // registro ainda não tinha duracaoMinutos gravado (ver estimarMinutosDoTextoAntigo acima).
  const iniciarEdicao = (servico) => {
    setForm({
      ...servico,
      duracaoMinutos: servico.duracaoMinutos ?? estimarMinutosDoTextoAntigo(servico.tempo)
    })
  }

  const salvarServico = async (e) => {
    e.preventDefault()
    setCarregando(true)
    try {
      const duracaoMinutos = Number(form.duracaoMinutos) || 30
      const dadosServico = {
        nome: form.nome,
        preco: form.preco || "R$ 0,00", // Fallback padronizado (mesmo que na criação)
        duracaoMinutos, // fonte da verdade — é o que agora bloqueia de fato os horários seguintes na agenda
        tempo: formatarDuracao(duracaoMinutos) // texto de exibição, derivado do número acima
      }
      if (form.id) {
        await updateDoc(doc(db, "servicos", form.id), dadosServico)
        toast.success("Serviço atualizado com sucesso!")
      } else {
        await addDoc(collection(db, "servicos"), dadosServico)
        toast.success("Serviço adicionado com sucesso!")
      }
      setForm({ id: null, nome: '', preco: '', duracaoMinutos: 30 })
      aoMudar()
    } catch (error) {
      console.error("Erro:", error)
      toast.error("Erro ao salvar serviço.")
    } finally {
      setCarregando(false)
    }
  }

  const excluirServico = async (servico) => {
    const resultado = await Swal.fire({
      title: 'Apagar serviço?',
      text: `Deseja apagar permanentemente "${servico.nome}"? Ele deixará de aparecer para novos agendamentos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, apagar!',
      cancelButtonText: 'Cancelar'
    })
    if (resultado.isConfirmed) {
      try {
        await deleteDoc(doc(db, "servicos", servico.id))
        toast.success("Serviço removido com sucesso!")
        aoMudar()
      } catch (error) {
        toast.error("Erro ao remover serviço.")
      }
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10" 
          style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
        Gerenciar <span style={{ color: configCores?.primaria || 'var(--cor-primaria)' }}>Serviços</span>
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LISTA DE SERVIÇOS */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl border overflow-hidden shadow-xl" 
               style={{ 
                 backgroundColor: configCores?.card || 'var(--cor-card)', 
                 borderColor: configCores?.borda || 'var(--cor-borda)' 
               }}>
            <table className="w-full text-left">
              <thead style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)' }}>
                <tr className="text-[10px] uppercase font-black" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  <th className="p-5">Serviço</th>
                  <th className="p-5 text-center">Preço</th>
                  <th className="p-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map(s => (
                  <tr key={s.id} className="border-b transition-colors group" 
                      style={{ borderColor: configCores?.borda || 'var(--cor-borda)' }}>
                    <td className="p-5">
                      <p className="font-bold text-lg" style={{ color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                        {s.nome}
                      </p>
                      <p className="text-xs" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                        {s.tempo}
                      </p>
                    </td>
                    <td className="p-5 text-center">
                      <span className="px-4 py-1.5 rounded-full text-xs font-black border"
                            style={{ 
                              backgroundColor: `${configCores?.primaria}1a` || 'rgba(var(--cor-primaria-rgb), 0.1)', 
                              color: configCores?.primaria || 'var(--cor-primaria)',
                              borderColor: `${configCores?.primaria}33` || 'rgba(var(--cor-primaria-rgb), 0.2)'
                            }}>
                        {s.preco}
                      </span>
                    </td>
                    <td className="p-5 text-right space-x-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => iniciarEdicao(s)} className="p-2 rounded-lg transition-all hover:scale-110"
                              style={{ backgroundColor: configCores?.fundo || 'var(--cor-bg-botao)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                        ✏️
                      </button>
                      <button onClick={() => excluirServico(s)}
                              className="p-2 rounded-lg transition-all hover:scale-110"
                              style={{ backgroundColor: configCores?.fundo || 'var(--cor-bg-botao)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULÁRIO DINÂMICO */}
        <div className="p-8 rounded-3xl border h-fit sticky top-10 shadow-2xl"
             style={{ 
               backgroundColor: configCores?.card || 'var(--cor-card)', 
               borderColor: configCores?.borda || 'var(--cor-borda)' 
             }}>
          <h2 className="text-xl font-black mb-6 uppercase italic" style={{ color: configCores?.primaria || 'var(--cor-primaria)' }}>
            {form.id ? 'Editar Item' : 'Novo Serviço'}
          </h2>
          
          <form onSubmit={salvarServico} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest ml-2" 
                     style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                Nome
              </label>
              <input 
                required
                value={form.nome} 
                onChange={e => setForm({...form, nome: e.target.value})} 
                placeholder="Ex: Corte Masculino" 
                className="w-full border p-4 rounded-2xl outline-none transition-all focus:ring-2"
                style={{ 
                  backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', 
                  borderColor: configCores?.borda || 'var(--cor-borda)', 
                  color: configCores?.texto || 'var(--cor-texto-principal)' 
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-2" 
                       style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  Preço
                </label>
                <input 
                  required
                  value={form.preco} 
                  onChange={handlePrecoChange} 
                  placeholder="R$ 0,00" 
                  className="w-full border p-4 rounded-2xl outline-none transition-all focus:ring-2"
                  style={{ 
                    backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', 
                    borderColor: configCores?.borda || 'var(--cor-borda)', 
                    color: configCores?.texto || 'var(--cor-texto-principal)' 
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-2"
                       style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                  Duração (minutos)
                </label>
                <input
                  value={form.duracaoMinutos}
                  onChange={e => setForm({ ...form, duracaoMinutos: e.target.value.replace(/\D/g, '') })}
                  placeholder="30"
                  type="text"
                  inputMode="numeric"
                  className="w-full border p-4 rounded-2xl outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: configCores?.fundo || 'var(--cor-input-bg)',
                    borderColor: configCores?.borda || 'var(--cor-borda)',
                    color: configCores?.texto || 'var(--cor-texto-principal)'
                  }}
                />
              </div>
            </div>

            {/* Ajuste rápido pros tempos mais comuns — evita ter que apagar e digitar o
                número toda vez. Esse tempo agora reserva de verdade os horários seguintes
                na agenda (ver bloqueioUtils.js), então vale a pena deixar fácil de acertar. */}
            <div className="flex flex-wrap gap-2">
              {[20, 30, 40, 60, 90].map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setForm({ ...form, duracaoMinutos: min })}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all"
                  style={{
                    backgroundColor: Number(form.duracaoMinutos) === min ? (configCores?.primaria || 'var(--cor-primaria)') : 'transparent',
                    color: Number(form.duracaoMinutos) === min ? '#fff' : (configCores?.textoSecundario || 'var(--cor-texto-secundario)'),
                    borderColor: configCores?.borda || 'var(--cor-borda)'
                  }}
                >
                  {formatarDuracao(min)}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-bold opacity-50 -mt-2 ml-2" style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
              Esse tempo passa a ocupar de verdade os horários seguintes na Agenda — um corte de 1h bloqueia os próximos 30/40min pro mesmo barbeiro.
            </p>

            <button 
              type="submit" 
              disabled={carregando}
              className="w-full font-black py-4 rounded-2xl hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
              style={{ 
                backgroundColor: configCores?.primaria || 'var(--cor-primaria)',
                color: '#ffffff' 
              }}
            >
              {carregando ? 'Processando...' : form.id ? 'Salvar Alterações' : 'Adicionar Serviço'}
            </button>

            {form.id && (
              <button type="button" onClick={() => setForm({id:null, nome:'', preco:'', duracaoMinutos: 30})}
                      className="w-full text-xs font-bold mt-2 hover:underline"
                      style={{ color: configCores?.textoSecundario || 'var(--cor-texto-secundario)' }}>
                Cancelar Edição
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}