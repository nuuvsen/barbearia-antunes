import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'
import { BOT_URL } from './botConfig'
import { Tag, DollarSign, Scissors, CalendarDays, Users } from 'lucide-react'

export default function AdminPlanos() {
  const [planos, setPlanos] = useState([])
  const [servicosDisponiveis, setServicosDisponiveis] = useState([])
  const [carregando, setCarregando] = useState(true) // Estado para evitar o flash
  
  // Inicializa tentando pegar do localStorage (Síncrono - resolve o flash)
  const [cores, setCores] = useState(() => {
    const salvo = localStorage.getItem('tema_customizado')
    return salvo ? JSON.parse(salvo) : {
      primaria: '#922020',
      fundo: '#bababa',
      card: '#ffffff',
      texto: '#171717',
      textoSecundario: '#2e2e2e',
      borda: '#000000'
    }
  })

  const [form, setForm] = useState({ 
    id: null, 
    nome: '', 
    valor: '', 
    cortes: '', 
    validadeDias: '',
    status: 'Ativo', 
    servicosInclusos: [], 
    combos: [] 
  })
  
  const [novoCombo, setNovoCombo] = useState({ nome: '', tempo: '' })
  const [solicitacoes, setSolicitacoes] = useState([])

  // Quantos clientes têm cada plano ativo no momento (dataLimite ainda não vencida, ou
  // sem dataLimite registrada). Só pra mostrar nos cards — não afeta nenhuma lógica de
  // negócio existente.
  const [assinantesPorPlano, setAssinantesPorPlano] = useState({})

  const carregarDados = async () => {
    try {
      // 1. Busca a personalização primeiro para garantir as cores
      const docConfig = await getDoc(doc(db, "configuracoes", "personalizacao"))
      if (docConfig.exists() && docConfig.data().cores) {
        const novasCores = docConfig.data().cores;
        setCores(novasCores);
        // Atualiza o cache local para a próxima visita ser instantânea
        localStorage.setItem('tema_customizado', JSON.stringify(novasCores));
      }

      // 2. Busca o restante dos dados
      const [snapPlanos, snapServicos, snapClientes] = await Promise.all([
        getDocs(collection(db, "planos")),
        getDocs(collection(db, "servicos")),
        getDocs(collection(db, "clientes"))
      ]);

      setPlanos(snapPlanos.docs.map(d => ({ id: d.id, ...d.data() })))
      setServicosDisponiveis(snapServicos.docs.map(d => d.data().nome))

      // dataLimite é sempre gravada em ISO ("AAAA-MM-DD", ver finalizarSolicitacao acima
      // e o mesmo fluxo em AdminClientes.jsx), então dá pra comparar direto com `new Date()`.
      const agora = new Date()
      const mapaAssinantes = {}
      snapClientes.docs.forEach(d => {
        const c = d.data()
        if (!c.planoId) return
        if (c.dataLimite) {
          const dl = new Date(c.dataLimite)
          if (!isNaN(dl.getTime()) && dl < agora) return // plano venceu, não conta
        }
        mapaAssinantes[c.planoId] = (mapaAssinantes[c.planoId] || 0) + 1
      })
      setAssinantesPorPlano(mapaAssinantes)
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false); // Libera a tela após carregar tudo
    }
  }

  useEffect(() => { carregarDados() }, [])

  // Escuta em tempo real as solicitações de assinatura que os clientes fazem pela
  // vitrine de planos (Cliente.jsx → "Assinaturas"). Cada uma fica "Pendente" até o
  // cliente vir na loja e o admin finalizar (ou recusar) por aqui.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "solicitacoesPlanos"), (snap) => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.status === 'Pendente')
      lista.sort((a, b) => new Date(a.dataCriacao) - new Date(b.dataCriacao))
      setSolicitacoes(lista)
    })
    return () => unsub()
  }, [])

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome || !form.valor) {
      toast.error("Preencha ao menos o nome e o valor do plano.")
      return
    }

    const dadosPlanos = {
      nome: form.nome,
      valor: form.valor,
      cortes: form.cortes,
      validadeDias: Number(form.validadeDias) || 0, // <--- SALVA NO BANCO
      status: form.status,
      servicosInclusos: form.servicosInclusos || [],
      combos: form.combos || []
    }

    try {
      if (form.id) {
        await updateDoc(doc(db, "planos", form.id), dadosPlanos)
        toast.success("Plano atualizado com sucesso!")
      } else {
        await addDoc(collection(db, "planos"), dadosPlanos)
        toast.success("Plano criado com sucesso!")
      }
      setForm({ id: null, nome: '', valor: '', cortes: '', validadeDias: '', status: 'Ativo', servicosInclusos: [], combos: [] })
      carregarDados()
    } catch (erro) {
      console.error("Erro ao salvar plano:", erro)
      toast.error("Erro ao salvar plano.")
    }
  }

  const alternarStatus = async (plano) => {
    const novoStatus = plano.status === 'Ativo' ? 'Inativo' : 'Ativo'
    try {
      await updateDoc(doc(db, "planos", plano.id), { status: novoStatus })
      toast.success(`Plano ${novoStatus === 'Ativo' ? 'ativado' : 'desativado'} com sucesso!`)
      carregarDados()
    } catch (erro) {
      toast.error("Erro ao alterar status do plano.")
    }
  }

  const iniciarEdicao = (plano) => {
    setForm({
      ...plano,
      servicosInclusos: plano.servicosInclusos || [],
      combos: plano.combos || []
    })
  }

  const excluirPlano = async (plano) => {
    const resultado = await Swal.fire({
      title: 'Apagar plano?',
      text: `Deseja apagar permanentemente o plano "${plano.nome}"? Clientes que já têm esse plano continuarão com os créditos atuais, mas o plano some da lista de opções.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, apagar!',
      cancelButtonText: 'Cancelar'
    })
    if (resultado.isConfirmed) {
      try {
        await deleteDoc(doc(db, "planos", plano.id))
        toast.success("Plano removido com sucesso!")
        carregarDados()
      } catch (erro) {
        toast.error("Erro ao remover plano.")
      }
    }
  }

  // Ativa de fato o plano pro cliente (mesma lógica de atribuição usada em
  // AdminClientes.jsx → aoMudarPlano): cria/atualiza o doc em "clientes" com o
  // plano, os créditos e a data limite, e marca a solicitação como concluída.
  const finalizarSolicitacao = async (sol) => {
    const planoDaSolicitacao = planos.find(p => p.id === sol.planoId)

    const confirmar = await Swal.fire({
      title: 'Finalizar assinatura?',
      html: `Confirma que <b>${sol.nome}</b> (${sol.telefone}) já veio na loja e pagou o plano <b>${sol.planoNome}</b>? Isso vai ativar o plano na ficha dele(a).`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, ativar!',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#3085d6'
    })
    if (!confirmar.isConfirmed) return

    try {
      let novaDataLimite = null
      if (planoDaSolicitacao?.validadeDias && Number(planoDaSolicitacao.validadeDias) > 0) {
        const d = new Date()
        d.setDate(d.getDate() + Number(planoDaSolicitacao.validadeDias))
        novaDataLimite = d.toISOString().split('T')[0]
      }

      const telefoneLimpo = sol.telefone.trim()
      await setDoc(doc(db, "clientes", telefoneLimpo), {
        nome: sol.nome,
        telefone: telefoneLimpo,
        planoId: sol.planoId,
        planoNome: sol.planoNome,
        cortesRestantes: planoDaSolicitacao ? Number(planoDaSolicitacao.cortes) : 0,
        dataLimite: novaDataLimite
      }, { merge: true })

      await updateDoc(doc(db, "solicitacoesPlanos", sol.id), {
        status: 'Concluida',
        dataConclusao: new Date().toISOString()
      })

      toast.success(`Assinatura de ${sol.nome} ativada com sucesso!`)

      // Avisa o cliente por notificação push (não trava o fluxo se falhar — o plano já
      // foi ativado de verdade no passo acima, isso aqui é só o aviso).
      fetch(`${BOT_URL}/api/notificacoes/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destino: 'cliente',
          identificador: telefoneLimpo,
          titulo: 'Assinatura Ativada! 🎉',
          corpo: `Seu plano ${sol.planoNome} já está ativo. Aproveite!`
        })
      }).catch(erro => console.error('Erro ao notificar cliente:', erro))
    } catch (erro) {
      console.error("Erro ao finalizar solicitação:", erro)
      toast.error("Erro ao ativar a assinatura.")
    }
  }

  const recusarSolicitacao = async (sol) => {
    const confirmar = await Swal.fire({
      title: 'Recusar solicitação?',
      text: `O plano de ${sol.nome} NÃO será ativado. Use isso se o cliente desistiu ou não apareceu.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, recusar',
      cancelButtonText: 'Voltar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    })
    if (!confirmar.isConfirmed) return

    try {
      await updateDoc(doc(db, "solicitacoesPlanos", sol.id), { status: 'Cancelada' })
      toast.success("Solicitação recusada.")
    } catch (erro) {
      console.error("Erro ao recusar solicitação:", erro)
      toast.error("Erro ao recusar solicitação.")
    }
  }

  const toggleServico = (nome) => {
    if (form.servicosInclusos.includes(nome)) {
      setForm({ ...form, servicosInclusos: form.servicosInclusos.filter(s => s !== nome) })
    } else {
      setForm({ ...form, servicosInclusos: [...form.servicosInclusos, nome] })
    }
  }

  const adicionarCombo = () => {
    if (novoCombo.nome && novoCombo.tempo) {
      setForm({ ...form, combos: [...form.combos, novoCombo] })
      setNovoCombo({ nome: '', tempo: '' })
    }
  }

  const removerCombo = (index) => {
    const novaLista = form.combos.filter((_, i) => i !== index)
      setForm({ ...form, combos: novaLista })
  }

  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Enquanto estiver carregando os dados do Firebase pela primeira vez, 
  // mostramos uma tela vazia ou um loader com a cor de fundo já aplicada
  if (carregando) {
    return <div className="min-h-screen w-full" style={{ backgroundColor: cores.fundo }} />;
  }

  return (
    <div className="animate-in fade-in duration-500 min-h-screen p-4 md:p-10" style={{ backgroundColor: cores.fundo }}>
      <h1 
        className="text-4xl font-black uppercase italic tracking-tighter mb-10"
        style={{ color: cores.texto }}
      >
        Gestão de <span style={{ color: cores.primaria }}>Planos</span>
      </h1>

      {/* SOLICITAÇÕES DE ASSINATURA — clientes que pediram um plano pela vitrine
          pública (Cliente.jsx → "Assinaturas") e ainda não finalizaram na loja. */}
      {solicitacoes.length > 0 && (
        <div 
          className="mb-10 p-6 md:p-8 rounded-3xl border-2"
          style={{ backgroundColor: hexToRgba(cores.primaria, 0.05), borderColor: hexToRgba(cores.primaria, 0.3) }}
        >
          <div className="flex items-center gap-3 mb-5">
            <span 
              className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-black text-white"
              style={{ backgroundColor: cores.primaria }}
            >
              {solicitacoes.length}
            </span>
            <h2 className="text-lg font-black uppercase italic tracking-tighter" style={{ color: cores.texto }}>
              Solicitações de Assinatura Pendentes
            </h2>
          </div>

          <div className="space-y-3">
            {solicitacoes.map(sol => (
              <div 
                key={sol.id} 
                className="p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                style={{ backgroundColor: cores.card, borderColor: cores.borda }}
              >
                <div>
                  <p className="font-black text-lg uppercase" style={{ color: cores.texto }}>{sol.nome}</p>
                  <p className="text-xs font-bold mt-1" style={{ color: cores.textoSecundario }}>
                    📱 {sol.telefone} <span className="mx-2">•</span> Quer o plano <span style={{ color: cores.primaria }}>{sol.planoNome}</span> (R$ {sol.planoValor})
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => finalizarSolicitacao(sol)} 
                    className="flex-1 md:flex-none bg-green-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-xl transition-all"
                  >
                    ✓ Finalizar
                  </button>
                  <button 
                    onClick={() => recusarSolicitacao(sol)} 
                    className="flex-1 md:flex-none border font-black text-xs uppercase tracking-widest px-5 py-3 rounded-xl transition-all hover:opacity-80"
                    style={{ borderColor: cores.borda, color: cores.textoSecundario }}
                  >
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LISTA DE PLANOS */}
        <div className="lg:col-span-2 space-y-4">
          {planos.map(p => (
            <div 
              key={p.id} 
              className="p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all"
              style={{ 
                backgroundColor: cores.card, 
                borderColor: p.status === 'Ativo' ? cores.borda : hexToRgba(cores.borda, 0.2),
                opacity: p.status === 'Ativo' ? 1 : 0.6
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-black text-2xl uppercase tracking-tighter" style={{ color: cores.texto }}>{p.nome}</p>
                  <span
                    className="text-[10px] px-2 py-1 rounded-full font-black uppercase text-white"
                    style={{ backgroundColor: p.status === 'Ativo' ? '#16a34a' : cores.primaria }}
                  >
                    {p.status}
                  </span>
                  <span
                    className="text-[10px] px-2 py-1 rounded-full font-black uppercase flex items-center gap-1"
                    style={{ backgroundColor: hexToRgba(cores.borda, 0.08), color: cores.textoSecundario }}
                    title="Clientes com esse plano ativo agora (dentro da validade)"
                  >
                    <Users size={11} /> {assinantesPorPlano[p.id] || 0} assinante{(assinantesPorPlano[p.id] || 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-sm font-bold mt-1" style={{ color: cores.primaria }}>
                  R$ {p.valor} <span className="font-normal" style={{ color: cores.textoSecundario }}>/ mês</span>
                </p>
                <p 
                  className="text-xs mt-2 italic border-b pb-2" 
                  style={{ color: cores.textoSecundario, borderColor: hexToRgba(cores.borda, 0.1) }}
                >
                  Limite de {p.cortes} agendamentos 
                  {p.validadeDias ? ` (${p.validadeDias} dias de validade)` : ''}
                </p>
                
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.servicosInclusos || []).length > 0 && p.servicosInclusos.map(s => (
                    <span 
                      key={s} 
                      className="text-[10px] px-2 py-1 rounded-md uppercase font-bold"
                      style={{ backgroundColor: hexToRgba(cores.borda, 0.05), color: cores.textoSecundario }}
                    >
                      {s}
                    </span>
                  ))}
                  {(p.combos || []).length > 0 && p.combos.map((c, idx) => (
                    <span 
                      key={'c'+idx} 
                      className="border text-[10px] px-2 py-1 rounded-md uppercase font-black"
                      style={{ 
                        backgroundColor: hexToRgba(cores.primaria, 0.1), 
                        color: cores.primaria, 
                        borderColor: hexToRgba(cores.primaria, 0.2) 
                      }}
                    >
                      ⭐ {c.nome}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => alternarStatus(p)} className="p-3 rounded-xl hover:opacity-80 transition-all text-white" style={{ backgroundColor: cores.textoSecundario }}>👁️</button>
                <button onClick={() => iniciarEdicao(p)} className="p-3 rounded-xl hover:opacity-80 transition-all text-white" style={{ backgroundColor: cores.texto }}>✏️</button>
                <button onClick={() => excluirPlano(p)} className="p-3 rounded-xl hover:opacity-80 transition-all text-white" style={{ backgroundColor: cores.primaria }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* FORMULÁRIO */}
        <div 
          className="p-8 rounded-3xl border h-fit sticky top-10 shadow-2xl"
          style={{ backgroundColor: cores.card, borderColor: cores.borda }}
        >
          <h2 className="text-xl font-black mb-6 uppercase italic" style={{ color: cores.primaria }}>
            {form.id ? 'Editar Plano' : 'Criar Novo Plano'}
          </h2>
          <form onSubmit={salvar} className="space-y-5">
            <div>
              <label className="text-[10px] font-black uppercase opacity-50 ml-2 flex items-center gap-1" style={{ color: cores.textoSecundario }}>
                <Tag size={11} /> Nome do Plano
              </label>
              <input
                value={form.nome}
                onChange={e => setForm({...form, nome: e.target.value})}
                placeholder="Ex: Plano Mensal"
                className="w-full border p-4 rounded-2xl outline-none transition-all mt-1"
                style={{
                  backgroundColor: hexToRgba(cores.fundo, 0.3),
                  borderColor: cores.borda,
                  color: cores.texto
                }}
              />
              <p className="text-[9px] font-bold opacity-50 mt-1 ml-2">Como o plano aparece pro cliente na vitrine e na ficha dele.</p>
            </div>

            {/* Cada campo empilhado em 1 coluna (não lado a lado): esse formulário mora numa
                coluna estreita do layout (1 de 3), e com os campos em grid-cols-3 o texto do
                placeholder/label ficava cortado na borda do input. */}
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="text-[10px] font-black uppercase opacity-50 ml-2 flex items-center gap-1" style={{ color: cores.textoSecundario }}>
                  <DollarSign size={11} /> Valor Mensal (R$)
                </label>
                <input
                  value={form.valor}
                  onChange={e => setForm({...form, valor: e.target.value})}
                  placeholder="Ex: 80"
                  inputMode="decimal"
                  className="w-full border p-4 rounded-2xl outline-none mt-1"
                  style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda, color: cores.texto }}
                />
                <p className="text-[9px] font-bold opacity-50 mt-1 ml-2">Quanto o cliente paga por mês nesse plano.</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase opacity-50 ml-2 flex items-center gap-1" style={{ color: cores.textoSecundario }}>
                  <Scissors size={11} /> Cortes / Agendamentos Inclusos
                </label>
                <input
                  value={form.cortes}
                  onChange={e => setForm({...form, cortes: e.target.value})}
                  placeholder="Ex: 4"
                  type="number"
                  className="w-full border p-4 rounded-2xl outline-none mt-1"
                  style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda, color: cores.texto }}
                />
                <p className="text-[9px] font-bold opacity-50 mt-1 ml-2">Quantos agendamentos o cliente pode usar dentro da validade. Aparece no card como "Limite de X agendamentos".</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase opacity-50 ml-2 flex items-center gap-1" style={{ color: cores.textoSecundario }}>
                  <CalendarDays size={11} /> Validade (dias)
                </label>
                <input
                  value={form.validadeDias}
                  onChange={e => setForm({...form, validadeDias: e.target.value})}
                  placeholder="Ex: 30"
                  type="number"
                  className="w-full border p-4 rounded-2xl outline-none mt-1"
                  style={{ backgroundColor: hexToRgba(cores.fundo, 0.3), borderColor: cores.borda, color: cores.texto }}
                />
                <p className="text-[9px] font-bold opacity-50 mt-1 ml-2">Dias até o plano vencer e o cliente precisar renovar. Deixe em branco ou 0 pra um plano que não vence (só controla pelos cortes).</p>
              </div>
            </div>

            {/* SELEÇÃO DE SERVIÇOS */}
            <div className="border p-4 rounded-2xl" style={{ backgroundColor: hexToRgba(cores.fundo, 0.2), borderColor: cores.borda }}>
              <p className="text-[10px] uppercase font-black" style={{ color: cores.textoSecundario }}>Serviços Base Cobertos:</p>
              <p className="text-[9px] font-bold opacity-50 mb-3">Marque quais serviços do cardápio já entram no plano sem cobrar de novo.</p>
              <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 mb-2">
                {servicosDisponiveis.map(s => (
                  <label key={s} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={form.servicosInclusos.includes(s)} 
                      onChange={() => toggleServico(s)} 
                      className="w-4 h-4" 
                      style={{ accentColor: cores.primaria }}
                    />
                    <span 
                      className="text-sm font-bold uppercase transition-colors"
                      style={{ color: form.servicosInclusos.includes(s) ? cores.texto : cores.textoSecundario }}
                    >
                      {s}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* CRIAÇÃO DE COMBOS */}
            <div className="border p-4 rounded-2xl" style={{ backgroundColor: hexToRgba(cores.primaria, 0.05), borderColor: hexToRgba(cores.primaria, 0.2) }}>
              <p className="text-[10px] uppercase font-black" style={{ color: cores.primaria }}>Combos Exclusivos:</p>
              <p className="text-[9px] font-bold opacity-60 mb-3" style={{ color: cores.primaria }}>Extras exclusivos de assinante (ex: "Corte + Barba" com tempo reservado na agenda), fora do que já vem no plano.</p>

              <div className="flex gap-2 mb-3 items-end">
                <div className="flex-1">
                  <label className="text-[8px] font-black uppercase opacity-60 ml-1" style={{ color: cores.primaria }}>Nome do Combo</label>
                  <input
                    value={novoCombo.nome}
                    onChange={e => setNovoCombo({...novoCombo, nome: e.target.value})}
                    placeholder="Ex: Corte + Barba"
                    className="w-full border p-3 rounded-xl outline-none text-xs mt-1"
                    style={{ backgroundColor: cores.card, borderColor: cores.borda, color: cores.texto }}
                  />
                </div>
                <div className="w-20">
                  <label className="text-[8px] font-black uppercase opacity-60 ml-1" style={{ color: cores.primaria }}>Min.</label>
                  <input
                    value={novoCombo.tempo}
                    onChange={e => setNovoCombo({...novoCombo, tempo: e.target.value})}
                    placeholder="30"
                    className="w-full border p-3 rounded-xl outline-none text-xs mt-1"
                    style={{ backgroundColor: cores.card, borderColor: cores.borda, color: cores.texto }}
                  />
                </div>
                <button
                  type="button"
                  onClick={adicionarCombo}
                  className="text-white font-black px-4 py-3 rounded-xl hover:opacity-80"
                  style={{ backgroundColor: cores.primaria }}
                >+</button>
              </div>

              {form.combos && form.combos.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t" style={{ borderColor: hexToRgba(cores.primaria, 0.2) }}>
                  {form.combos.map((c, index) => (
                    <div key={index} className="flex justify-between items-center border p-2 px-3 rounded-xl" style={{ backgroundColor: cores.card, borderColor: cores.borda }}>
                      <div>
                        <p className="text-xs font-bold uppercase" style={{ color: cores.texto }}>{c.nome}</p>
                        <p className="text-[10px]" style={{ color: cores.textoSecundario }}>{c.tempo}</p>
                      </div>
                      <button type="button" onClick={() => removerCombo(index)} className="text-xs font-black" style={{ color: cores.primaria }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="w-full text-white font-black py-4 rounded-2xl hover:opacity-90 uppercase tracking-widest mt-4 transition-all shadow-lg"
              style={{ backgroundColor: cores.primaria }}
            >
              {form.id ? 'Salvar Mudanças' : 'Lançar Plano'}
            </button>
            
            {form.id && (
              <button 
                type="button" 
                onClick={() => setForm({id:null, nome:'', valor:'', cortes:'', validadeDias: '', status:'Ativo', servicosInclusos: [], combos: []})} 
                className="w-full text-xs font-bold mt-2 hover:opacity-70 transition-colors"
                style={{ color: cores.textoSecundario }}
              >
                Cancelar Edição
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}