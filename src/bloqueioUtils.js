import { collection, addDoc, doc, deleteDoc, updateDoc, getDoc, query, where, getDocs, runTransaction } from 'firebase/firestore'
import { db } from './firebase'
import Swal from 'sweetalert2'
import { BOT_URL } from './botConfig'

// Um "bloqueio" é um horário fechado manualmente pelo admin/barbeiro para não receber
// clientes (folga, almoço, manutenção etc.) — não é um agendamento real. Registros criados
// antes desta atualização não tinham os campos "tipo"/"motivo", só um telefone fixo
// "00000000000" e o serviço "Bloqueio Manual". ehBloqueio() reconhece os dois formatos,
// então os bloqueios antigos continuam sendo tratados corretamente em toda a agenda.
export const ehBloqueio = (ag) => {
  if (!ag) return false
  return ag.tipo === 'bloqueio' || ag.clienteTelefone === '00000000000' || ag.servico === 'Bloqueio Manual'
}

// Amarra vários horários bloqueados de uma vez (bloqueio em intervalo) sob um único id,
// pra poder desbloquear o intervalo inteiro com uma ação só.
const gerarGrupoBloqueioId = () => `bloq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// =========================================================================
// TRAVA DE HORÁRIO (evita double booking)
// =========================================================================
// Bug real encontrado: nenhum lugar do sistema reverificava se um horário ainda estava
// livre no exato momento de salvar — a checagem só acontecia quando a lista de horários era
// carregada (alguns segundos ou minutos antes). Se duas pessoas escolhessem o mesmo
// barbeiro+dia+hora quase ao mesmo tempo (dois clientes, ou um cliente e um bloqueio criado
// pelo admin), os dois agendamentos eram criados sem nenhum aviso — double booking real.
//
// O Firestore não permite fazer uma consulta (query) dentro de uma transação, só leituras
// de documentos específicos por ID. Por isso criamos uma coleção separada "travasHorario"
// com um documento por barbeiro+dia+hora, cujo ID é determinístico (sempre o mesmo para o
// mesmo horário). Reservar um horário e criar o registro (agendamento ou bloqueio) agora
// acontece dentro de uma única transação atômica: ou os dois acontecem juntos, ou nenhum
// acontece. Toda vez que um agendamento/bloqueio é cancelado ou removido, a trava
// correspondente precisa ser liberada (liberarHorario) para o horário voltar a ficar livre.
export const gerarIdTravaHorario = (barbeiro, data, hora) =>
  `${String(barbeiro).replace(/\//g, '-')}_${data}_${hora}`

// =========================================================================
// DURAÇÃO DE SERVIÇO x GRADE DE HORÁRIOS
// =========================================================================
// Antes disso, o tempo de um serviço (cadastrado em AdminServicos.jsx) era só um texto
// pra exibição — nada no agendamento em si reservava os horários seguintes, então um corte
// de 1h marcado numa grade de 30 em 30 min deixava o horário seguinte livre pra outro cliente
// marcar em cima, mesmo o barbeiro ainda estando ocupado. As funções abaixo convertem
// hora <-> minutos e calculam quais horas de uma grade um atendimento realmente ocupa a
// partir da duração (em minutos) do serviço escolhido.

export const horaParaMinutos = (horaStr) => {
  if (!horaStr) return 0
  const [h, m] = String(horaStr).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const minutosParaHora = (minutos) => {
  const h = Math.floor(minutos / 60).toString().padStart(2, '0')
  const m = (minutos % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// Quais horas da grade (de `intervalo` em `intervalo` minutos) um atendimento de
// `duracaoMinutos` iniciado em `horaInicio` efetivamente ocupa. Sempre retorna pelo menos a
// própria hora de início, mesmo se a duração/intervalo vierem inválidos — nunca "some" com o
// horário que o agendamento realmente começa.
export const calcularSlotsSpan = ({ horaInicio, duracaoMinutos, intervalo }) => {
  const intervaloNum = Number(intervalo) || 30
  const duracaoNum = Number(duracaoMinutos) || intervaloNum
  const qtdSlots = Math.max(1, Math.ceil(duracaoNum / intervaloNum))
  const inicioMin = horaParaMinutos(horaInicio)
  const slots = []
  for (let i = 0; i < qtdSlots; i++) {
    slots.push(minutosParaHora(inicioMin + i * intervaloNum))
  }
  return slots
}

// Dois atendimentos (mesmo barbeiro/dia) se sobrepõem se o intervalo [início, início+duração)
// de um cruzar o do outro — matemática padrão de sobreposição de intervalos.
export const horariosSeSobrepoe = (horaA, duracaoA, horaB, duracaoB) => {
  const inicioA = horaParaMinutos(horaA)
  const fimA = inicioA + (Number(duracaoA) || 30)
  const inicioB = horaParaMinutos(horaB)
  const fimB = inicioB + (Number(duracaoB) || 30)
  return inicioA < fimB && inicioB < fimA
}

// Reserva atomicamente um horário para um barbeiro específico: cria o documento (agendamento
// ou bloqueio) e a trava do horário na mesma transação. Se o horário já estiver travado, NADA
// é criado e é lançado um erro com `code: 'HORARIO_OCUPADO'` — quem chamar decide o que fazer
// (tentar outro barbeiro, avisar a pessoa, etc.). Retorna o ID do documento criado.
//
// Quando `duracaoMinutos` e `intervalo` são passados, e o serviço ocupa mais de uma hora da
// grade, TODAS as horas que ele ocupa (calcularSlotsSpan) são travadas na MESMA transação —
// ou o intervalo inteiro é reservado, ou nenhuma hora é criada (mesma garantia atômica de
// sempre, só que agora cobrindo várias horas em vez de uma só). Sem esses dois parâmetros
// (bloqueios manuais, atribuição da lista de espera), continua reservando só a hora exata,
// exatamente como sempre funcionou.
export const reservarHorario = async ({ barbeiro, data, hora, dadosDocumento, colecaoDestino = "agendamentos", duracaoMinutos, intervalo }) => {
  const slots = (duracaoMinutos && intervalo) ? calcularSlotsSpan({ horaInicio: hora, duracaoMinutos, intervalo }) : [hora]
  const travaRefs = slots.map(h => doc(db, "travasHorario", gerarIdTravaHorario(barbeiro, data, h)))
  const novoDocRef = doc(collection(db, colecaoDestino))

  await runTransaction(db, async (transaction) => {
    // Toda leitura precisa acontecer antes de qualquer escrita numa transação do Firestore —
    // por isso lê todas as travas candidatas primeiro, só depois decide o que escrever.
    const travaSnaps = await Promise.all(travaRefs.map(ref => transaction.get(ref)))
    if (travaSnaps.some(snap => snap.exists())) {
      const erro = new Error('Este horário acabou de ser ocupado.')
      erro.code = 'HORARIO_OCUPADO'
      throw erro
    }
    travaRefs.forEach((travaRef, i) => {
      transaction.set(travaRef, {
        barbeiro,
        data,
        hora: slots[i],
        colecao: colecaoDestino,
        agendamentoId: novoDocRef.id,
        criadoEm: new Date().toISOString()
      })
    })
    transaction.set(novoDocRef, {
      ...dadosDocumento,
      // Só grava a lista de horas ocupadas quando o serviço realmente ocupa mais de uma —
      // mantém os documentos antigos (1 hora só) do jeito que sempre foram.
      ...(slots.length > 1 && { horariosOcupados: slots })
    })
  })

  return novoDocRef.id
}

// =========================================================================
// LISTA DE ESPERA
// =========================================================================
// Quando o dia inteiro de um barbeiro (ou de "qualquer barbeiro") está lotado, o cliente
// pode entrar numa fila de espera pra aquele barbeiro+dia (ver Cliente.jsx). Quando um
// horário desse dia realmente vaga (liberarHorario, chamado por todo cancelamento do
// sistema), decide o que fazer com essa fila de acordo com o modo configurado em
// configuracoes/agenda.listaEsperaModo (ver AdminConfiguracoes.jsx):
//   'manual'     -> não faz nada automático; a fila fica só visível pro admin (AdminAgenda.jsx).
//   'bot'        -> segura o horário pro primeiro da fila (cria um agendamento provisório com
//                   status "Aguardando Confirmação", que ocupa a trava e aparece como ocupado
//                   em toda a agenda) e pergunta a ele pelo WhatsApp — ninguém mais consegue
//                   agendar por cima enquanto ele não responde (não há prazo: ver Bot-barbearia).
//   'automatico' -> agenda direto pro primeiro da fila (status "Pendente") e só avisa.

const formatarDataListaEspera = (dataISO) => {
  const [ano, mes, dia] = String(dataISO || '').split('-')
  return (ano && mes && dia) ? `${dia}/${mes}/${ano}` : dataISO
}

// Evita duplicar a entrada do mesmo cliente na mesma fila (mesmo telefone+barbeiro+data)
// enquanto ele ainda está Aguardando ou já foi Notificado — se ele já está na fila, apenas
// retorna o id existente em vez de criar outro registro.
export const entrarNaListaEspera = async ({ telefone, nome, barbeiro, data, servico }) => {
  const jaNaFila = await getDocs(query(
    collection(db, "listaEspera"),
    where("telefone", "==", telefone),
    where("barbeiro", "==", barbeiro),
    where("data", "==", data),
    where("status", "in", ["Aguardando", "Notificado"])
  ))
  if (!jaNaFila.empty) return jaNaFila.docs[0].id

  const docRef = await addDoc(collection(db, "listaEspera"), {
    telefone,
    nome,
    barbeiro,
    data,
    servico: servico || null,
    status: "Aguardando",
    criadoEm: new Date().toISOString(),
    notificadoEm: null,
    horaOferecida: null
  })
  return docRef.id
}

// Cancelamento pelo próprio cliente (sai da fila antes de ser chamado). Soft-cancel (mantém
// o histórico), igual ao padrão usado pra agendamentos em vez de apagar de vez.
export const sairDaListaEspera = async (id) => {
  await updateDoc(doc(db, "listaEspera", id), { status: "Cancelado" })
}

// Lista das entradas ainda ativas (Aguardando ou Notificado) pra tela do admin.
export const listarListaEsperaAtiva = async () => {
  const snap = await getDocs(query(collection(db, "listaEspera"), where("status", "in", ["Aguardando", "Notificado"])))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

const buscarModoListaEspera = async () => {
  try {
    const snap = await getDoc(doc(db, "configuracoes", "agenda"))
    return snap.exists() ? (snap.data().listaEsperaModo || "manual") : "manual"
  } catch {
    return "manual"
  }
}

// Primeiro da fila elegível pra um barbeiro+dia: quem pediu esse barbeiro específico OU quem
// pediu "qualquer barbeiro" — nessa ordem de chegada (criadoEm), sem separar os dois grupos
// entre si (o pedido mais antigo vence, seja ele específico ou "qualquer").
const buscarProximoCandidato = async (barbeiro, data) => {
  const [snapEspecifico, snapQualquer] = await Promise.all([
    getDocs(query(collection(db, "listaEspera"), where("barbeiro", "==", barbeiro), where("data", "==", data), where("status", "==", "Aguardando"))),
    getDocs(query(collection(db, "listaEspera"), where("barbeiro", "==", "qualquer"), where("data", "==", data), where("status", "==", "Aguardando")))
  ])
  const candidatos = [...snapEspecifico.docs, ...snapQualquer.docs].map(d => ({ id: d.id, ...d.data() }))
  candidatos.sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
  return candidatos[0] || null
}

// Cria de fato o agendamento do candidato no horário que acabou de vagar, sem nunca deixar a
// trava sem dono no meio do caminho: o novo agendamento nasce e a trava é atualizada pra
// apontar pra ele na MESMA transação que "segurava" o horário livre (a trava nunca é apagada
// nesse fluxo — ela só troca de dono, do agendamento antigo/cancelado pro novo candidato).
const atribuirCandidatoAoHorario = async ({ candidato, barbeiro, data, hora, statusInicial }) => {
  const travaRef = doc(db, "travasHorario", gerarIdTravaHorario(barbeiro, data, hora))
  const novoDocRef = doc(collection(db, "agendamentos"))

  await runTransaction(db, async (transaction) => {
    transaction.set(novoDocRef, {
      clienteNome: candidato.nome,
      clienteTelefone: candidato.telefone,
      barbeiro,
      servico: candidato.servico || "A combinar",
      preco: "A combinar",
      data,
      hora,
      status: statusInicial,
      origemListaEspera: true,
      listaEsperaId: candidato.id
    })
    transaction.set(travaRef, {
      barbeiro, data, hora,
      colecao: "agendamentos",
      agendamentoId: novoDocRef.id,
      criadoEm: new Date().toISOString()
    })
  })

  return novoDocRef.id
}

// Libera a trava de um horário. Chamar sempre que um agendamento ou bloqueio for cancelado
// ou removido, senão o horário fica "fantasma" (travado pra sempre, mesmo sem ocupante real).
// Apagar um documento que não existe não dá erro no Firestore, então é seguro chamar mesmo
// para registros antigos que nunca tiveram trava (de antes desta atualização).
//
// `processarListaEspera` (padrão true) controla se essa liberação deve checar a fila de
// espera antes de soltar o horário de vez. Só é desligada internamente por criarBloqueios,
// no rollback de uma reserva que acabou de ser desfeita por causa de outro horário do MESMO
// bloqueio ter falhado — isso não é uma vaga real se abrindo, é o sistema desfazendo o que
// ele mesmo acabou de criar, e não deve disparar avisos de lista de espera.
//
// `horariosExtras` (novo, com a duração de serviço passando a ocupar mais de uma hora da
// grade — ver reservarHorario/calcularSlotsSpan) são as DEMAIS horas que o MESMO agendamento
// ocupava além da hora principal. Elas são sempre só liberadas (nunca oferecidas à lista de
// espera individualmente — só a hora principal entra na fila), pra não fatiar um horário longo
// que acabou de vagar em pedacinhos oferecidos separadamente pra pessoas diferentes.
export const liberarHorario = async (barbeiro, data, hora, { processarListaEspera = true, horariosExtras = [] } = {}) => {
  if (!barbeiro || !data || !hora) return

  const liberarExtras = () => Promise.all(
    horariosExtras.map(h => deleteDoc(doc(db, "travasHorario", gerarIdTravaHorario(barbeiro, data, h))))
  )

  if (processarListaEspera) {
    try {
      const modo = await buscarModoListaEspera()
      if (modo === 'bot' || modo === 'automatico') {
        const candidato = await buscarProximoCandidato(barbeiro, data)
        if (candidato) {
          const statusInicial = modo === 'automatico' ? 'Pendente' : 'Aguardando Confirmação'
          const agendamentoId = await atribuirCandidatoAoHorario({ candidato, barbeiro, data, hora, statusInicial })
          await updateDoc(doc(db, "listaEspera", candidato.id), {
            status: modo === 'automatico' ? 'Atendido' : 'Notificado',
            horaOferecida: hora,
            notificadoEm: new Date().toISOString()
          })

          try {
            if (modo === 'automatico') {
              await fetch(`${BOT_URL}/api/bot/enviar-confirmacao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  telefone: candidato.telefone,
                  nomeCliente: candidato.nome,
                  servico: candidato.servico || 'seu serviço',
                  data: formatarDataListaEspera(data),
                  horario: hora,
                  barbeiro,
                  // Sinaliza pro bot que esta confirmação veio da lista de espera (não é uma
                  // confirmação de agendamento comum) — só nesse caso ele também dispara a
                  // notificação push de "chamado da lista de espera" (ver Bot-barbearia/index.js).
                  origemListaEspera: true
                })
              })
            } else {
              await fetch(`${BOT_URL}/api/bot/lista-espera`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  telefone: candidato.telefone,
                  nomeCliente: candidato.nome,
                  servico: candidato.servico || 'seu serviço',
                  data, // ISO (AAAA-MM-DD) — o bot precisa disso pra achar o próximo da fila se recusarem
                  horario: hora,
                  barbeiro,
                  listaEsperaId: candidato.id,
                  agendamentoId
                })
              })
            }
          } catch (errorBot) {
            console.error('Erro ao avisar cliente da lista de espera, mas o horário foi atribuído a ele:', errorBot)
          }

          await liberarExtras() // as horas extras (se houver) não foram transferidas, só a principal
          return // a trava principal não foi apagada — foi transferida pro candidato da lista de espera
        }
      }
    } catch (erroListaEspera) {
      // Se a checagem da lista de espera falhar por qualquer motivo, não deixa isso travar o
      // cancelamento em si — o pior caso é o horário liberar normalmente, sem passar pela fila.
      console.error('Erro ao processar lista de espera:', erroListaEspera)
    }
  }

  await Promise.all([
    deleteDoc(doc(db, "travasHorario", gerarIdTravaHorario(barbeiro, data, hora))),
    liberarExtras()
  ])
}

// Abre o formulário (De/Até/Motivo) para bloquear um intervalo de horários. Retorna
// { horaInicio, horaFim, motivo } ou null se o usuário cancelar.
export const abrirModalDeBloqueio = async ({ cores, horariosDisponiveis, horaInicial }) => {
  if (!horariosDisponiveis || horariosDisponiveis.length === 0) return null

  const opcoesHtml = horariosDisponiveis
    .map(h => `<option value="${h}" ${h === horaInicial ? 'selected' : ''}>${h}</option>`)
    .join('')

  const corTexto = cores?.texto || '#000000'

  const { value: formValues } = await Swal.fire({
    title: 'Bloquear Horário',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:14px; margin-top:8px; color:${corTexto};">
        <div>
          <label style="font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; opacity:0.7;">De</label>
          <select id="swal-hora-inicio" class="swal2-select" style="width:100%; margin:6px 0 0; display:block;">${opcoesHtml}</select>
        </div>
        <div>
          <label style="font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; opacity:0.7;">Até (inclusive)</label>
          <select id="swal-hora-fim" class="swal2-select" style="width:100%; margin:6px 0 0; display:block;">${opcoesHtml}</select>
        </div>
        <div>
          <label style="font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; opacity:0.7;">Motivo (opcional)</label>
          <input id="swal-motivo" class="swal2-input" style="width:100%; margin:6px 0 0;" placeholder="Ex: Almoço, Folga, Manutenção..." maxlength="60" />
        </div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Bloquear',
    cancelButtonText: 'Cancelar',
    background: cores?.card || '#ffffff',
    color: corTexto,
    focusConfirm: false,
    didOpen: () => {
      const selFim = document.getElementById('swal-hora-fim')
      if (selFim && horaInicial) selFim.value = horaInicial
    },
    preConfirm: () => {
      const horaInicio = document.getElementById('swal-hora-inicio').value
      const horaFim = document.getElementById('swal-hora-fim').value
      const motivo = document.getElementById('swal-motivo').value
      if (horaFim < horaInicio) {
        Swal.showValidationMessage('O horário final não pode ser antes do horário inicial.')
        return false
      }
      return { horaInicio, horaFim, motivo }
    }
  })

  return formValues || null
}

// Cria um bloqueio por horário dentro do intervalo (reaproveita a granularidade de slot
// já usada pela grade), todos amarrados pelo mesmo grupoBloqueioId. Cada horário é reservado
// atomicamente (reservarHorario) — se algum já estiver ocupado (por um agendamento real ou
// outro bloqueio), NENHUM horário do intervalo é bloqueado: os que já tinham sido reservados
// com sucesso são desfeitos, e um erro (code 'HORARIOS_OCUPADOS') é lançado listando quais
// horários bateram de frente, pra não deixar bloqueio parcial e furado no meio do intervalo.
export const criarBloqueios = async ({ barbeiro, dataISO, horarios, motivo }) => {
  const grupoBloqueioId = gerarGrupoBloqueioId()
  const motivoLimpo = (motivo || '').trim()

  const resultados = await Promise.allSettled(horarios.map(hora => reservarHorario({
    barbeiro,
    data: dataISO,
    hora,
    dadosDocumento: {
      clienteNome: "🔒 Bloqueado",
      clienteTelefone: "",
      servico: motivoLimpo ? `Bloqueio: ${motivoLimpo}` : "Bloqueio Manual",
      motivo: motivoLimpo,
      barbeiro,
      // ISO (AAAA-MM-DD), igual ao resto do sistema.
      data: dataISO,
      hora,
      status: "Bloqueado",
      tipo: "bloqueio",
      grupoBloqueioId
    }
  })))

  const reservados = []
  const ocupados = []
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') reservados.push({ hora: horarios[i], id: r.value })
    else ocupados.push(horarios[i])
  })

  if (ocupados.length > 0) {
    await Promise.all(reservados.map(r => Promise.all([
      deleteDoc(doc(db, "agendamentos", r.id)),
      liberarHorario(barbeiro, dataISO, r.hora, { processarListaEspera: false })
    ])))
    const erro = new Error(`Estes horários já estavam ocupados e não foram bloqueados: ${ocupados.join(', ')}`)
    erro.code = 'HORARIOS_OCUPADOS'
    throw erro
  }

  return grupoBloqueioId
}

// Remove um bloqueio e libera a(s) trava(s) do(s) horário(s) correspondente(s), para que
// voltem a ficar disponíveis para agendamento. Se ele fizer parte de um grupo (bloqueio de
// intervalo criado de uma vez), remove o grupo inteiro para não deixar "buracos" no meio do
// intervalo desbloqueado.
export const removerBloqueio = async (bloqueio) => {
  if (bloqueio?.grupoBloqueioId) {
    const q = query(collection(db, "agendamentos"), where("grupoBloqueioId", "==", bloqueio.grupoBloqueioId))
    const snap = await getDocs(q)
    await Promise.all(snap.docs.map(d => {
      const dados = d.data()
      return Promise.all([
        deleteDoc(doc(db, "agendamentos", d.id)),
        liberarHorario(dados.barbeiro, dados.data, dados.hora)
      ])
    }))
  } else {
    await Promise.all([
      deleteDoc(doc(db, "agendamentos", bloqueio.id)),
      liberarHorario(bloqueio.barbeiro, bloqueio.data, bloqueio.hora)
    ])
  }
}
