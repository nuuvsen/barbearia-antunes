import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { collection, query, where, getDocs, updateDoc, doc, increment, onSnapshot, addDoc } from 'firebase/firestore'
import { CalendarDays, Clock, UserCheck, Trash2, User, ChevronLeft, ChevronRight, Lock, Unlock, Ban, Users, X, RefreshCw, Plus, CheckCircle2, Save } from 'lucide-react'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'
import { ehBloqueio, removerBloqueio, liberarHorario, listarListaEsperaAtiva, sairDaListaEspera } from './bloqueioUtils'
import { concluirAtendimento } from './atendimentoUtils'
import AdminPagamento from './AdminPagamento'
import Carregando from './Carregando'
import AutocompleteCliente from './AutocompleteCliente'

const MAPA_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Configurações do Scheduler
const HORA_INICIO = 8; // 08:00
const HORA_FIM = 20; // 20:00
const PIXELS_POR_MINUTO = 3; // Escala vertical: 1 min = 3px (30 min = 90px)

// Utilitários de Data para evitar problemas de fuso horário
const parseDataLocal = (dataISO) => new Date(dataISO + 'T12:00:00');
const formatarDataISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Um horário "já passou" se a data for anterior a hoje, ou se for hoje e a hora do slot já
// tiver ficado pra trás — usado pra travar tanto o clique em horário vago (Marcar Corte)
// quanto soltar um agendamento arrastado (mover) num horário que já não existe mais.
const horarioJaPassou = (dataISO, horaStr) => {
  if (!dataISO || !horaStr) return false;
  const agora = new Date();
  const hojeISO = formatarDataISO(agora);
  if (dataISO < hojeISO) return true;
  if (dataISO > hojeISO) return false;
  const [h, m] = horaStr.split(':').map(Number);
  const minutosSlot = h * 60 + m;
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  return minutosSlot < minutosAgora;
};

const gerarHorarios = () => {
  const horarios = [];
  for (let h = HORA_INICIO; h <= HORA_FIM; h++) {
    horarios.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== HORA_FIM) horarios.push(`${String(h).padStart(2, '0')}:30`);
  }
  return horarios;
}

export default function AdminAgenda() {
  const pegarDiaDeHoje = () => formatarDataISO(new Date());

  // ESTADOS PRINCIPAIS
  const [dataSelecionada, setDataSelecionada] = useState(pegarDiaDeHoje())
  const [barbeiroFiltro, setBarbeiroFiltro] = useState('Todos')
  const [visualizacao, setVisualizacao] = useState('Dia') // Dia, Semana, Mês
  const [agendamentos, setAgendamentos] = useState([])
  const [barbeiros, setBarbeiros] = useState([])
  const [carregando, setCarregando] = useState(false)

  const [mostrarCalendario, setMostrarCalendario] = useState(false)
  const [mesVisivel, setMesVisivel] = useState(new Date())

  // LISTA DE ESPERA — entradas ativas (Aguardando/Notificado), independente da data
  // selecionada acima na agenda (ver bloqueioUtils.js). Essencial pro modo 'manual' funcionar
  // de verdade (é a única forma do admin ver quem está esperando), e útil em qualquer modo.
  const [listaEspera, setListaEspera] = useState([])
  const [carregandoListaEspera, setCarregandoListaEspera] = useState(false)

  // DETALHES DO CORTE — clicar num agendamento ativo na grade abre este modal, que permite
  // editar cliente/serviço/preço, adicionar itens extras, salvar, cancelar ou já concluir o
  // atendimento por ali (antes só existia o ícone de lixeira, só pra cancelar).
  const [agendamentoDetalhe, setAgendamentoDetalhe] = useState(null)
  const [formDetalhe, setFormDetalhe] = useState({ clienteNome: '', clienteTelefone: '', servico: '', preco: 0, observacoes: '', itensExtras: [] })
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false)
  const [agendamentoEmPagamento, setAgendamentoEmPagamento] = useState(null)

  // CORES DA PERSONALIZACAO - sem isso os campos do modal de detalhes ficavam com o fundo
  // escuro "de fabrica" (var(--cor-input-bg), nunca sobrescrita pela personalizacao) atras
  // de um texto pensado pro tema claro configurado pela barbearia - quase ilegivel. Os outros
  // paineis (AdminServicos.jsx etc.) ja seguem esse padrao de usar configCores.fundo/texto.
  const [configCores, setConfigCores] = useState(null)

  // CATALOGO - vira lista de selecao no campo "Servico" e no "Adicionar item extra", em vez
  // do admin digitar o nome a mao (evita erro de digitacao e nomes fora do cadastro real).
  const [servicosDisponiveis, setServicosDisponiveis] = useState([])
  const [planosDisponiveis, setPlanosDisponiveis] = useState([])

  // CLIENTES CADASTRADOS - alimenta as sugestões de autocomplete dos campos "Cliente"
  // (Detalhes do Corte e Marcar Corte), pra não precisar digitar o nome inteiro toda vez.
  const [clientesCadastrados, setClientesCadastrados] = useState([])
  const nomeVinculadoDetalheRef = useRef('') // nome ao qual formDetalhe.clienteTelefone pertence de fato
  const nomeVinculadoNovoRef = useRef('') // idem, para formNovo.clienteTelefone

  // NOVO AGENDAMENTO - abre ao clicar num horario vago na grade (Dia/Semana), ja com
  // barbeiro/data/hora daquele slot preenchidos.
  const [novoAgendamento, setNovoAgendamento] = useState(null)
  const [formNovo, setFormNovo] = useState({ clienteNome: '', clienteTelefone: '', servico: '', preco: 0, barbeiro: '', data: '', hora: '', observacoes: '' })
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  useEffect(() => {
    const unsubCores = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) setConfigCores(docSnap.data().cores);
    });
    const unsubServicos = onSnapshot(collection(db, "servicos"), (snap) => {
      setServicosDisponiveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPlanos = onSnapshot(collection(db, "planos"), (snap) => {
      setPlanosDisponiveis(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== 'Inativo'));
    });
    const unsubClientes = onSnapshot(collection(db, "clientes"), (snap) => {
      setClientesCadastrados(snap.docs.map(d => ({ telefone: d.id, nome: d.data().nome || '' })));
    });
    return () => { unsubCores(); unsubServicos(); unsubPlanos(); unsubClientes(); };
  }, []);

  const horariosGrid = gerarHorarios();

  useEffect(() => {
    const obterBarbeiros = async () => {
      const snap = await getDocs(collection(db, "barbeiros"))
      setBarbeiros(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }
    obterBarbeiros()
  }, [])

  const buscarListaEspera = async () => {
    setCarregandoListaEspera(true)
    try {
      const lista = await listarListaEsperaAtiva()
      lista.sort((a, b) => (a.data || '').localeCompare(b.data) || new Date(a.criadoEm) - new Date(b.criadoEm))
      setListaEspera(lista)
    } catch (error) {
      console.error("Erro ao buscar lista de espera:", error)
    }
    setCarregandoListaEspera(false)
  }

  useEffect(() => {
    buscarListaEspera()
  }, [])

  const removerDaListaEspera = async (entrada) => {
    const confirmacao = await Swal.fire({
      title: 'Remover da fila?',
      text: `${entrada.nome} sairá da lista de espera de ${entrada.barbeiro === 'qualquer' ? 'Qualquer Barbeiro' : entrada.barbeiro} (${formatarDataBRSimples(entrada.data)}).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: 'var(--cor-texto-secundario)',
      confirmButtonText: 'Sim, remover',
      cancelButtonText: 'Voltar'
    })
    if (!confirmacao.isConfirmed) return

    try {
      await sairDaListaEspera(entrada.id)
      setListaEspera(prev => prev.filter(e => e.id !== entrada.id))
    } catch (error) {
      console.error("Erro ao remover da lista de espera:", error)
      Swal.fire({ title: 'Erro!', text: 'Não foi possível remover da fila.', icon: 'error', confirmButtonColor: 'var(--cor-primaria)' })
    }
  }

  const formatarDataBRSimples = (dataISO) => {
    if (!dataISO) return ''
    const [ano, mes, dia] = dataISO.split('-')
    return `${dia}/${mes}/${ano}`
  }

  // Calcula o intervalo de datas que precisa ser buscado no Firebase
  const obterLimitesDaVisualizacao = () => {
    const dataObj = parseDataLocal(dataSelecionada);
    
    if (visualizacao === 'Dia') {
      return { start: dataSelecionada, end: dataSelecionada };
    } 
    else if (visualizacao === 'Semana') {
      const diaSemana = dataObj.getDay();
      const start = new Date(dataObj);
      start.setDate(dataObj.getDate() - diaSemana);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: formatarDataISO(start), end: formatarDataISO(end) };
    } 
    else if (visualizacao === 'Mês') {
      const start = new Date(dataObj.getFullYear(), dataObj.getMonth(), 1);
      const end = new Date(dataObj.getFullYear(), dataObj.getMonth() + 1, 0);
      return { start: formatarDataISO(start), end: formatarDataISO(end) };
    }
  };

  const buscarAgendamentos = async () => {
    setCarregando(true)
    try {
      const limites = obterLimitesDaVisualizacao();
      
      const q = query(
        collection(db, "agendamentos"),
        where("data", ">=", limites.start),
        where("data", "<=", limites.end)
      )

      const snap = await getDocs(q)
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      // Filtra por barbeiro em memória (evita necessidade de índices compostos no Firebase)
      if (barbeiroFiltro !== 'Todos') {
        lista = lista.filter(item => item.barbeiro === barbeiroFiltro);
      }

      // Ordena por hora
      const ordenados = lista.sort((a, b) => a.hora.localeCompare(b.hora))
      setAgendamentos(ordenados)
    } catch (error) {
      console.error("Erro ao buscar:", error)
    }
    setCarregando(false)
  }

  useEffect(() => {
    buscarAgendamentos()
  }, [dataSelecionada, barbeiroFiltro, visualizacao])

  const cancelarCorte = async (item) => {
    const id = item.id;
    if (!navigator.onLine) {
      Swal.fire({
        icon: 'error',
        title: 'Sem Conexão!',
        text: 'Você está offline. Conecte-se à internet.',
        confirmButtonColor: 'var(--cor-primaria)'
      });
      return; 
    }

    const confirmacao = await Swal.fire({
      title: 'Tem certeza?',
      text: "Deseja marcar este agendamento como Cancelado?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33', // Vermelho para a ação destrutiva
      cancelButtonColor: 'var(--cor-texto-secundario)', // Cinza para cancelar
      confirmButtonText: 'Sim, cancelar!',
      cancelButtonText: 'Não, manter'
    });

    if (confirmacao.isConfirmed) {
      try {
        // Bug real encontrado: esta tela apagava o agendamento de vez (deleteDoc), enquanto
        // toda cancelamento em outro lugar do sistema (AdminDashboard.jsx, Cliente.jsx) só
        // marca status: "Cancelado" e mantém o registro. Isso fazia um agendamento cancelado
        // por aqui sumir sem deixar rastro: não contava em "Cancelados" nas estatísticas de
        // Gerência, e o cliente via o próprio horário simplesmente desaparecer do histórico
        // dele (Cliente.jsx) em vez de aparecer como "Cancelado". Corrigido para o mesmo
        // padrão usado no resto do sistema.
        await updateDoc(doc(db, "agendamentos", id), { status: "Cancelado" });

        // Libera a trava de horário (ver bloqueioUtils.js) pra esse horário voltar a
        // ficar disponível para agendamento.
        await liberarHorario(item.barbeiro, item.data, item.hora);

        // Bug real encontrado: quando o cliente cancela o próprio agendamento pela página
        // dele (Cliente.jsx), o crédito de plano usado ao agendar é devolvido
        // (cortesRestantes + 1). Cancelar o MESMO agendamento por aqui (pela Agenda do
        // admin) não devolvia o crédito — o cliente perdia o corte do plano de vez, mesmo
        // sem nunca ter sido atendido. Corrigido para devolver o crédito também aqui.
        if ((item.preco === 'PLANO' || item.preco === 'PLANO ATIVO') && item.clienteTelefone) {
          await updateDoc(doc(db, "clientes", item.clienteTelefone), { cortesRestantes: increment(1) });
        }

        Swal.fire({
          title: 'Cancelado!',
          text: 'O agendamento foi marcado como cancelado.',
          icon: 'success',
          confirmButtonColor: 'var(--cor-primaria)'
        });

        buscarAgendamentos();
        // O cancelamento acima pode ter disparado a lista de espera (modo bot/automático em
        // liberarHorario) — recarrega pra refletir a mudança de status na tela.
        buscarListaEspera();
      } catch (error) {
        console.error("Erro ao cancelar:", error);
        Swal.fire({
          title: 'Erro!',
          text: 'Não foi possível cancelar o agendamento.',
          icon: 'error',
          confirmButtonColor: 'var(--cor-primaria)'
        });
      }
    }
  }

  // Converte o preço do agendamento (pode vir como número, ou string "R$ 45,00" de
  // origens mais antigas) pro número puro que o formulário de edição usa.
  const converterPrecoParaNumero = (precoStr) => {
    if (typeof precoStr === 'number') return precoStr;
    if (!precoStr) return 0;
    const numero = parseFloat(String(precoStr).replace(/[^\d,.-]/g, '').replace(',', '.'));
    return isNaN(numero) ? 0 : numero;
  }

  const agendamentoDetalheEhPlano = agendamentoDetalhe && (
    agendamentoDetalhe.preco === 'PLANO ATIVO' ||
    agendamentoDetalhe.preco === 'INCLUSO NO PLANO' ||
    agendamentoDetalhe.preco === 'PLANO'
  );

  // Abre o modal de detalhes ao clicar num corte ativo na grade (não confundir com o botão
  // de lixeira, que continua cancelando direto sem abrir nada).
  const abrirDetalhesAgendamento = (item) => {
    setAgendamentoDetalhe(item)
    setFormDetalhe({
      clienteNome: item.clienteNome || '',
      clienteTelefone: item.clienteTelefone || '',
      servico: item.servico || '',
      preco: converterPrecoParaNumero(item.preco),
      observacoes: item.observacoes || '',
      itensExtras: Array.isArray(item.itensExtras) ? item.itensExtras : []
    })
  }

  // Pergunta nome + preço de um item extra (ex: "Barba", "Sobrancelha") e soma ao total —
  // é o "adicionar algo" pedido pelo usuário, pra não precisar abrir uma comanda avulsa só
  // pra registrar um acréscimo em cima de um agendamento que já existia.
  // Monta as <option> do catalogo (servicos + planos ativos), reutilizadas aqui e no
  // <select> de Servico do modal de detalhes.
  const montarOpcoesCatalogo = () => {
    const opcoesServicos = servicosDisponiveis.map(s =>
      `<option value="servico::${s.nome}" data-preco="${converterPrecoParaNumero(s.preco)}">${s.nome} \u2014 ${s.preco}</option>`
    ).join('');
    const opcoesPlanos = planosDisponiveis.map(p =>
      `<option value="plano::${p.nome}" data-preco="0">${p.nome} (Plano)</option>`
    ).join('');
    return { opcoesServicos, opcoesPlanos };
  }

  // Pergunta um item extra escolhido da lista de Servicos/Planos cadastrados - em vez de
  // digitar, evita nome fora do cadastro e ja traz o preco de tabela (ainda editavel, pra
  // cobrir descontos ou combos pontuais).
  const adicionarItemExtra = async () => {
    const { opcoesServicos, opcoesPlanos } = montarOpcoesCatalogo();
    const temCatalogo = servicosDisponiveis.length > 0 || planosDisponiveis.length > 0;

    const { value: valores } = await Swal.fire({
      title: 'Adicionar item extra',
      html: temCatalogo
        ? '<select id="swal-item-select" class="swal2-select" style="display:block; width:100%;">' +
          (opcoesServicos ? `<optgroup label="Serviços">${opcoesServicos}</optgroup>` : '') +
          (opcoesPlanos ? `<optgroup label="Planos">${opcoesPlanos}</optgroup>` : '') +
          '</select>' +
          '<input id="swal-item-preco" class="swal2-input" type="number" step="0.01" min="0" placeholder="Preço (R$)">'
        : '<p style="font-size:12px; opacity:0.7; margin-bottom:8px;">Nenhum serviço ou plano cadastrado — digite manualmente:</p>' +
          '<input id="swal-item-nome" class="swal2-input" placeholder="Nome do item (ex: Barba)">' +
          '<input id="swal-item-preco" class="swal2-input" type="number" step="0.01" min="0.01" placeholder="Preço (R$)">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Adicionar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--cor-primaria)',
      cancelButtonColor: 'var(--cor-texto-secundario)',
      didOpen: () => {
        if (!temCatalogo) return;
        const sel = document.getElementById('swal-item-select');
        const precoInput = document.getElementById('swal-item-preco');
        const preencherPreco = () => {
          const opt = sel.options[sel.selectedIndex];
          precoInput.value = opt?.dataset?.preco || 0;
        };
        sel.addEventListener('change', preencherPreco);
        preencherPreco();
      },
      preConfirm: () => {
        const preco = parseFloat(document.getElementById('swal-item-preco').value)
        let nome;
        if (temCatalogo) {
          const sel = document.getElementById('swal-item-select');
          const valor = sel.value || '';
          nome = valor.includes('::') ? valor.split('::')[1] : valor;
        } else {
          nome = document.getElementById('swal-item-nome').value.trim()
        }
        if (!nome || isNaN(preco) || preco < 0) {
          Swal.showValidationMessage('Selecione um item e informe um preço válido.')
          return false
        }
        return { nome, preco }
      }
    })

    if (!valores) return

    setFormDetalhe(prev => ({
      ...prev,
      itensExtras: [...prev.itensExtras, valores],
      preco: prev.preco + valores.preco
    }))
  }

  const removerItemExtra = (indice) => {
    setFormDetalhe(prev => {
      const item = prev.itensExtras[indice]
      return {
        ...prev,
        itensExtras: prev.itensExtras.filter((_, i) => i !== indice),
        preco: Math.max(0, prev.preco - (item?.preco || 0))
      }
    })
  }

  // Monta o payload de edição uma única vez — usado tanto por "Salvar Alterações" quanto
  // por "Concluir Atendimento" (que salva a edição antes de abrir o pagamento, senão uma
  // troca de serviço/preço feita ali se perderia ao concluir).
  const construirPayloadEdicaoDetalhe = () => ({
    clienteNome: formDetalhe.clienteNome,
    clienteTelefone: formDetalhe.clienteTelefone,
    servico: formDetalhe.servico,
    observacoes: formDetalhe.observacoes,
    ...(!agendamentoDetalheEhPlano && { preco: formDetalhe.preco, itensExtras: formDetalhe.itensExtras })
  })

  const salvarDetalhesAgendamento = async () => {
    if (!agendamentoDetalhe) return
    setSalvandoDetalhe(true)
    try {
      await updateDoc(doc(db, "agendamentos", agendamentoDetalhe.id), construirPayloadEdicaoDetalhe())
      Swal.fire({ title: 'Salvo!', text: 'As alterações foram salvas.', icon: 'success', confirmButtonColor: 'var(--cor-primaria)', timer: 1400, showConfirmButton: false })
      setAgendamentoDetalhe(null)
      buscarAgendamentos()
    } catch (error) {
      console.error("Erro ao salvar detalhes do agendamento:", error)
      Swal.fire({ title: 'Erro!', text: 'Não foi possível salvar as alterações.', icon: 'error', confirmButtonColor: 'var(--cor-primaria)' })
    } finally {
      setSalvandoDetalhe(false)
    }
  }

  // "Concluir Atendimento" a partir da Agenda: salva qualquer edição pendente primeiro
  // (mesmo payload de salvarDetalhesAgendamento), depois abre o mesmo modal de pagamento
  // usado no Dashboard (AdminPagamento) já com os dados atualizados.
  const concluirDaAgenda = async () => {
    if (!agendamentoDetalhe) return
    setSalvandoDetalhe(true)
    try {
      await updateDoc(doc(db, "agendamentos", agendamentoDetalhe.id), construirPayloadEdicaoDetalhe())
      setAgendamentoEmPagamento({ ...agendamentoDetalhe, ...formDetalhe })
      setAgendamentoDetalhe(null)
    } catch (error) {
      console.error("Erro ao preparar conclusão do atendimento:", error)
      Swal.fire({ title: 'Erro!', text: 'Não foi possível salvar as alterações antes de concluir.', icon: 'error', confirmButtonColor: 'var(--cor-primaria)' })
    } finally {
      setSalvandoDetalhe(false)
    }
  }

  const cancelarDaAgenda = () => {
    const item = agendamentoDetalhe
    setAgendamentoDetalhe(null)
    cancelarCorte(item)
  }

  // Callback do AdminPagamento (mesmo componente usado no Dashboard) — usa a mesma função
  // compartilhada de conclusão (atendimentoUtils.js) pra garantir que concluir por aqui
  // tenha exatamente o mesmo efeito financeiro/estoque/NPS/fiado que concluir pela fila.
  const handleConcluirPagamento = async (id, dadosPagamento) => {
    try {
      const resultado = await concluirAtendimento({ id, agendamento: agendamentoEmPagamento, dadosPagamento, barbeiros })
      Swal.fire({
        title: resultado.fiadoFalhou ? 'Concluído (com aviso)' : 'Concluído!',
        text: resultado.fiadoFalhou
          ? 'Atendimento finalizado, mas houve um erro ao registrar o fiado. Anote manualmente!'
          : 'Atendimento finalizado com sucesso.',
        icon: resultado.fiadoFalhou ? 'warning' : 'success',
        confirmButtonColor: 'var(--cor-primaria)'
      })
      setAgendamentoEmPagamento(null)
      buscarAgendamentos()
    } catch (error) {
      console.error("Erro ao concluir atendimento:", error)
      Swal.fire({ title: 'Erro!', text: 'Não foi possível concluir o atendimento.', icon: 'error', confirmButtonColor: 'var(--cor-primaria)' })
    }
  }

  // MOVER AGENDAMENTO (arrastar e soltar) - permite trocar um corte de horario e/ou de
  // barbeiro sem cancelar e recriar. Sempre pede confirmacao antes de gravar, ja que e facil
  // soltar num slot errado sem querer.
  const moverAgendamento = async (dadosArrastados, destino) => {
    const { id, horaAtual, barbeiroAtual, dataAtual, clienteNome: clienteArrastado } = dadosArrastados;
    const barbeiroDestino = destino.barbeiro || barbeiroAtual;
    const semMudanca = destino.hora === horaAtual && barbeiroDestino === barbeiroAtual && destino.data === dataAtual;
    if (semMudanca) return;

    // Segunda trava (a primeira é no onDrop do slot): mesmo que algo chame moverAgendamento
    // diretamente, nunca deixa um corte cair num horário que já passou.
    if (horarioJaPassou(destino.data, destino.hora)) {
      toast.error('Não é possível mover um corte para um horário que já passou.');
      return;
    }

    const mudouBarbeiro = barbeiroDestino !== barbeiroAtual;
    const mudouData = destino.data !== dataAtual;
    const [anoD, mesD, diaD] = destino.data.split('-');
    const descricaoDestino = `${destino.hora}${mudouData ? ` de ${diaD}/${mesD}` : ''}${mudouBarbeiro ? ` com ${barbeiroDestino}` : ''}`;

    const confirmacao = await Swal.fire({
      title: 'Mover agendamento?',
      text: `Mover o corte de ${clienteArrastado} para ${descricaoDestino}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--cor-primaria)',
      cancelButtonColor: 'var(--cor-texto-secundario)',
      confirmButtonText: 'Sim, mover!',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacao.isConfirmed) return;

    try {
      await updateDoc(doc(db, "agendamentos", id), {
        hora: destino.hora,
        barbeiro: barbeiroDestino,
        data: destino.data
      });
      buscarAgendamentos();
      Swal.fire({ title: 'Movido!', text: 'O agendamento foi atualizado.', icon: 'success', confirmButtonColor: 'var(--cor-primaria)', timer: 1400, showConfirmButton: false });
    } catch (error) {
      console.error("Erro ao mover agendamento:", error);
      Swal.fire({ title: 'Erro!', text: 'Não foi possível mover o agendamento.', icon: 'error', confirmButtonColor: 'var(--cor-primaria)' });
    }
  }

  const handleDragStartAgendamento = (e, item) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id: item.id,
      horaAtual: item.hora,
      barbeiroAtual: item.barbeiro,
      dataAtual: item.data,
      clienteNome: item.clienteNome
    }));
  }

  const handleDropAgendamento = (e, destino) => {
    e.preventDefault();
    try {
      const dados = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (dados?.id) moverAgendamento(dados, destino);
    } catch (error) {
      console.error("Erro ao processar o arraste:", error);
    }
  }

  // NOVO AGENDAMENTO A PARTIR DE UM HORARIO VAGO - clicar num slot livre na grade (Dia ou
  // Semana) abre este modal ja com barbeiro/data/hora daquele slot preenchidos.
  const abrirNovoAgendamento = (contexto) => {
    setNovoAgendamento(contexto)
    setFormNovo({
      clienteNome: '',
      clienteTelefone: '',
      servico: '',
      preco: 0,
      barbeiro: contexto.barbeiro || barbeiros[0]?.nome || '',
      data: contexto.data,
      hora: contexto.hora,
      observacoes: ''
    })
  }

  const salvarNovoAgendamento = async () => {
    if (!formNovo.clienteNome.trim() || !formNovo.servico || !formNovo.barbeiro) {
      Swal.fire({ title: 'Faltou algo', text: 'Preencha ao menos cliente, serviço e barbeiro.', icon: 'warning', confirmButtonColor: 'var(--cor-primaria)' })
      return
    }
    // Segunda trava (a primeira é não abrir o modal ao clicar num slot já passado): se o
    // admin trocar a data/hora dentro do próprio modal pra algo que já passou, barra aqui.
    if (horarioJaPassou(formNovo.data, formNovo.hora)) {
      Swal.fire({ title: 'Horário inválido', text: 'Não é possível marcar um corte num horário que já passou.', icon: 'warning', confirmButtonColor: 'var(--cor-primaria)' })
      return
    }
    setSalvandoNovo(true)
    try {
      await addDoc(collection(db, "agendamentos"), {
        clienteNome: formNovo.clienteNome,
        clienteTelefone: formNovo.clienteTelefone,
        servico: formNovo.servico,
        preco: formNovo.preco,
        barbeiro: formNovo.barbeiro,
        data: formNovo.data,
        hora: formNovo.hora,
        observacoes: formNovo.observacoes,
        status: 'Agendado'
      })
      Swal.fire({ title: 'Agendado!', text: 'O corte foi marcado na agenda.', icon: 'success', confirmButtonColor: 'var(--cor-primaria)', timer: 1400, showConfirmButton: false })
      setNovoAgendamento(null)
      buscarAgendamentos()
    } catch (error) {
      console.error("Erro ao criar agendamento:", error)
      Swal.fire({ title: 'Erro!', text: 'Não foi possível marcar o corte.', icon: 'error', confirmButtonColor: 'var(--cor-primaria)' })
    } finally {
      setSalvandoNovo(false)
    }
  }

  const desbloquearNoScheduler = async (item) => {
    const confirmacao = await Swal.fire({
      title: 'Desbloquear horário?',
      text: "Este horário voltará a ficar disponível para agendamento.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--cor-primaria)',
      cancelButtonColor: 'var(--cor-texto-secundario)',
      confirmButtonText: 'Sim, desbloquear!',
      cancelButtonText: 'Voltar'
    });

    if (confirmacao.isConfirmed) {
      try {
        await removerBloqueio(item);
        Swal.fire({
          title: 'Desbloqueado!',
          text: 'O horário foi liberado com sucesso.',
          icon: 'success',
          confirmButtonColor: 'var(--cor-primaria)'
        });
        buscarAgendamentos();
        // Mesmo motivo do cancelamento: desbloquear também passa por liberarHorario e pode
        // ter avisado alguém da lista de espera.
        buscarListaEspera();
      } catch (error) {
        console.error("Erro ao desbloquear:", error);
        Swal.fire({
          title: 'Erro!',
          text: 'Não foi possível desbloquear o horário.',
          icon: 'error',
          confirmButtonColor: 'var(--cor-primaria)'
        });
      }
    }
  }

  // LÓGICA DE POSICIONAMENTO NO GRID (Dia e Semana)
  const calcularTop = (horaString) => {
    if (!horaString) return 0;
    const [h, m] = horaString.split(':').map(Number);
    const minutosDesdeInicio = (h - HORA_INICIO) * 60 + m;
    return minutosDesdeInicio * PIXELS_POR_MINUTO;
  };

  const calcularHeight = (duracaoMinutos = 30) => {
    return duracaoMinutos * PIXELS_POR_MINUTO;
  };

  // NAVEGAÇÃO DE DATAS
  const mudarData = (dias) => {
    const nova = parseDataLocal(dataSelecionada);
    nova.setDate(nova.getDate() + dias);
    setDataSelecionada(formatarDataISO(nova));
  }

  const formatarDataNome = (dataISO) => {
    const hojeISO = pegarDiaDeHoje()
    const [ano, mes, dia] = dataISO.split('-')
    const formatoBR = `${dia}/${mes}/${ano}`

    if (dataISO === hojeISO) return <><span className="font-black" style={{ color: 'var(--cor-primaria)' }}>HOJE</span></>
    return <span className="font-black" style={{ color: 'var(--cor-texto-principal)' }}>{formatoBR}</span>
  }

  // ====== RENDERIZAÇÃO: VISUALIZAÇÃO POR DIA ======
  const renderVisaoDia = () => {
    const barbeirosExibidos = barbeiroFiltro === 'Todos' ? barbeiros : barbeiros.filter(b => b.nome === barbeiroFiltro);
    
    // "bg-opacity-50" nunca funcionou aqui: essa utility do Tailwind só afeta uma cor
    // definida por classe (ex: bg-red-500), e a cor de fundo real vem do style inline
    // logo abaixo — então a classe não tinha efeito nenhum. Removida (era código morto).
    return (
      <div className="overflow-x-auto" style={{ backgroundColor: 'var(--cor-card)' }}>
        <div className="min-w-[800px] flex relative pb-4">
          {/* Eixo Y - Horários */}
          <div className="w-20 flex-shrink-0 border-r" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)', zIndex: 30 }}>
            <div className="h-14 border-b flex items-center justify-center sticky top-0" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)' }}>
              <Clock size={16} style={{ color: 'var(--cor-texto-secundario)' }} />
            </div>
            <div className="relative">
              {horariosGrid.map((hora, idx) => (
                <div key={idx} className="border-b flex items-start justify-center text-xs font-bold pt-2" style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}>{hora}</div>
              ))}
            </div>
          </div>

          {/* Eixo X - Barbeiros */}
          {barbeirosExibidos.map((barbeiro) => {
            const ags = agendamentos.filter(ag => ag.barbeiro === barbeiro.nome);
            return (
              <div key={barbeiro.id} className="flex-1 min-w-[250px] border-r relative" style={{ borderColor: 'var(--cor-borda)' }}>
                <div className="h-14 border-b flex items-center justify-center gap-2 font-black uppercase tracking-widest sticky top-0 z-20 shadow-sm" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
                  <User size={16} style={{ color: 'var(--cor-primaria)' }} /> {barbeiro.nome}
                </div>
                <div className="relative w-full">
                  {/* "border-opacity-30" é da API antiga do Tailwind (v3) e não combina com
                      cor vinda de style inline — não tinha efeito, a linha saía sempre 100%
                      opaca. Uso color-mix() direto no style pra realmente deixar a linha
                      mais sutil, como era a intenção original. */}
                  {horariosGrid.map((horaSlot, i) => {
                    const passou = horarioJaPassou(dataSelecionada, horaSlot);
                    return (
                      <div key={i}
                           className={`border-b w-full transition-colors ${passou ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-black/5'}`}
                           style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'color-mix(in srgb, var(--cor-borda) 30%, transparent)' }}
                           title={passou ? 'Horário já passou' : 'Clique para marcar um corte • solte aqui para mover um agendamento'}
                           onClick={() => { if (!passou) abrirNovoAgendamento({ barbeiro: barbeiro.nome, data: dataSelecionada, hora: horaSlot }) }}
                           onDragOver={(e) => e.preventDefault()}
                           onDrop={(e) => {
                             if (passou) { toast.error('Não é possível mover um corte para um horário que já passou.'); return; }
                             handleDropAgendamento(e, { barbeiro: barbeiro.nome, data: dataSelecionada, hora: horaSlot });
                           }}
                      ></div>
                    );
                  })}
                  {ags.map(item => renderBlocoAgendamento(item))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ====== RENDERIZAÇÃO: VISUALIZAÇÃO POR SEMANA ======
  const renderVisaoSemana = () => {
    const limites = obterLimitesDaVisualizacao();
    const startObj = parseDataLocal(limites.start);
    const diasSemanaISO = [];
    for(let i=0; i<7; i++) {
      const temp = new Date(startObj);
      temp.setDate(startObj.getDate() + i);
      diasSemanaISO.push(formatarDataISO(temp));
    }

    return (
      <div className="overflow-x-auto" style={{ backgroundColor: 'var(--cor-card)' }}>
        <div className="min-w-[1000px] flex relative pb-4">
          {/* Eixo Y - Horários */}
          <div className="w-20 flex-shrink-0 border-r" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)', zIndex: 30 }}>
            <div className="h-14 border-b flex items-center justify-center sticky top-0" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)' }}>
              <Clock size={16} style={{ color: 'var(--cor-texto-secundario)' }} />
            </div>
            <div className="relative">
              {horariosGrid.map((hora, idx) => (
                <div key={idx} className="border-b flex items-start justify-center text-xs font-bold pt-2" style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}>{hora}</div>
              ))}
            </div>
          </div>

          {/* Eixo X - Dias da Semana */}
          {diasSemanaISO.map((diaISO, index) => {
            const ags = agendamentos.filter(ag => ag.data === diaISO);
            const [ano, mes, dia] = diaISO.split('-');
            const isHoje = diaISO === pegarDiaDeHoje();

            return (
              <div key={diaISO} className="flex-1 min-w-[150px] border-r relative" style={{ borderColor: 'var(--cor-borda)', backgroundColor: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.02)' : 'transparent' }}>
                <div className={`h-14 border-b flex flex-col items-center justify-center sticky top-0 z-20 shadow-sm ${isHoje ? 'border-b-4' : ''}`} style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: isHoje ? 'var(--cor-primaria)' : 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>{MAPA_DIAS[index]}</span>
                  <span className="font-black">{dia}/{mes}</span>
                </div>
                <div className="relative w-full">
                  {/* "border-opacity-30" é da API antiga do Tailwind (v3) e não combina com
                      cor vinda de style inline — não tinha efeito, a linha saía sempre 100%
                      opaca. Uso color-mix() direto no style pra realmente deixar a linha
                      mais sutil, como era a intenção original. */}
                  {horariosGrid.map((horaSlot, i) => {
                    const passou = horarioJaPassou(diaISO, horaSlot);
                    return (
                      <div key={i}
                           className={`border-b w-full transition-colors ${passou ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-black/5'}`}
                           style={{ height: `${30 * PIXELS_POR_MINUTO}px`, borderColor: 'color-mix(in srgb, var(--cor-borda) 30%, transparent)' }}
                           title={passou ? 'Horário já passou' : 'Clique para marcar um corte • solte aqui para mover um agendamento'}
                           onClick={() => { if (!passou) abrirNovoAgendamento({ barbeiro: barbeiroFiltro !== 'Todos' ? barbeiroFiltro : '', data: diaISO, hora: horaSlot }) }}
                           onDragOver={(e) => e.preventDefault()}
                           onDrop={(e) => {
                             if (passou) { toast.error('Não é possível mover um corte para um horário que já passou.'); return; }
                             handleDropAgendamento(e, { data: diaISO, hora: horaSlot });
                           }}
                      ></div>
                    );
                  })}
                  {ags.map(item => renderBlocoAgendamento(item))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ====== RENDERIZAÇÃO: VISUALIZAÇÃO POR MÊS ======
  const renderVisaoMes = () => {
    const limites = obterLimitesDaVisualizacao();
    const dataObj = parseDataLocal(dataSelecionada);
    const startOfMonth = new Date(dataObj.getFullYear(), dataObj.getMonth(), 1);
    const endOfMonth = new Date(dataObj.getFullYear(), dataObj.getMonth() + 1, 0);
    
    const diasGrid = [];
    for(let i=0; i<startOfMonth.getDay(); i++) diasGrid.push(null); // Padding inicial
    for(let i=1; i<=endOfMonth.getDate(); i++) {
      diasGrid.push(formatarDataISO(new Date(dataObj.getFullYear(), dataObj.getMonth(), i)));
    }
    const diasFaltantes = 42 - diasGrid.length; // Garante 6 linhas no grid (6 * 7 = 42)
    for(let i=0; i<diasFaltantes; i++) diasGrid.push(null); // Padding final

    return (
      <div className="w-full" style={{ backgroundColor: 'var(--cor-card)' }}>
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--cor-borda)' }}>
          {MAPA_DIAS.map(d => (
            <div key={d} className="p-3 text-center text-[10px] font-black uppercase tracking-widest border-r" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {diasGrid.map((diaISO, idx) => {
            if (!diaISO) return <div key={idx} className="min-h-[120px] p-2 border-r border-b opacity-20" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-bg-geral)' }}></div>;
            
            const ags = agendamentos.filter(ag => ag.data === diaISO);
            const isHoje = diaISO === pegarDiaDeHoje();
            const [ano, mes, dia] = diaISO.split('-');

            return (
              <div key={diaISO} onClick={() => { setDataSelecionada(diaISO); setVisualizacao('Dia'); }} className="min-h-[120px] p-2 border-r border-b cursor-pointer transition-all hover:bg-black/5" style={{ borderColor: 'var(--cor-borda)', backgroundColor: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.05)' : 'transparent' }}>
                <div className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-full mb-2 ${isHoje ? 'text-white' : ''}`} style={{ backgroundColor: isHoje ? 'var(--cor-primaria)' : 'transparent', color: isHoje ? '#fff' : 'var(--cor-texto-principal)' }}>
                  {dia}
                </div>
                <div className="space-y-1">
                  {ags.slice(0, 4).map(item => {
                    const cinza = ehBloqueio(item) || item.status === 'Cancelado';
                    const concluidoMes = item.status === 'Concluído';
                    const estiloItem = cinza
                      ? { backgroundColor: 'rgba(120,120,128,0.15)', borderColor: '#71717a', color: '#71717a' }
                      : concluidoMes
                        ? { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e', color: '#16a34a' }
                        : { backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-primaria)', color: 'var(--cor-texto-principal)' };
                    return (
                      <div key={item.id} className={`text-[9px] font-bold p-1 rounded overflow-hidden truncate border-l-2 ${item.status === 'Cancelado' ? 'line-through' : ''}`} style={estiloItem}>
                        {item.hora} - {ehBloqueio(item) ? '🔒 Bloqueado' : item.status === 'Cancelado' ? `❌ ${item.clienteNome}` : concluidoMes ? `✅ ${item.clienteNome}` : item.clienteNome}
                      </div>
                    )
                  })}
                  {ags.length > 4 && (
                    <div className="text-[10px] font-black text-center mt-1" style={{ color: 'var(--cor-primaria)' }}>+{ags.length - 4} mais</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Componente reutilizável para o card de agendamento (usado em Dia e Semana)
  const renderBlocoAgendamento = (item) => {
    const topPx = calcularTop(item.hora);
    const heightPx = calcularHeight(item.duracao || 30);
    const bloqueado = ehBloqueio(item);
    const cancelado = item.status === 'Cancelado';
    const concluido = item.status === 'Concluído';

    if (cancelado) {
      // Agora que cancelar aqui vira status: "Cancelado" (em vez de apagar o registro), o
      // card precisa continuar existindo na grade — mas visualmente "morto" (cinza, sem
      // botão de cancelar de novo), senão pareceria um horário normal e ocupado.
      return (
        <div key={item.id} className="absolute left-1 right-1 rounded-xl p-2 border overflow-hidden flex flex-col justify-start opacity-60"
             style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: 'rgba(120,120,128,0.1)', borderColor: '#71717a', borderLeftWidth: '4px' }}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black leading-none" style={{ color: '#71717a' }}>{item.hora}</span>
            <Ban size={12} style={{ color: '#71717a' }} />
          </div>
          <h3 className="text-xs font-black uppercase italic truncate leading-tight mt-1 line-through" style={{ color: '#71717a' }}>{item.clienteNome}</h3>
          <p className="text-[9px] font-bold uppercase truncate leading-none mt-0.5" style={{ color: '#71717a' }}>Cancelado</p>
        </div>
      )
    }

    if (concluido) {
      // Sem esse bloco, um corte já pago caía no branch padrão lá embaixo — exatamente a
      // mesma aparência de um corte pendente (mesma borda vermelha, clicável pra pagar de
      // novo). O admin concluía o pagamento, via a mensagem de sucesso, voltava pra agenda
      // e o card continuava idêntico — parecendo que nada tinha acontecido. Agora fica
      // verde, com check, e sem clique/arraste (já foi pago, não tem o que reabrir aqui).
      return (
        <div key={item.id} title="Atendimento já concluído"
             className="absolute left-1 right-1 rounded-xl p-2 border overflow-hidden flex flex-col justify-start opacity-80"
             style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e', borderLeftWidth: '4px' }}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black leading-none" style={{ color: '#16a34a' }}>{item.hora}</span>
            <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
          </div>
          <h3 className="text-xs font-black uppercase italic truncate leading-tight mt-1" style={{ color: '#16a34a' }}>{item.clienteNome}</h3>
          <p className="text-[9px] font-bold uppercase truncate leading-none mt-0.5" style={{ color: '#16a34a' }}>Concluído</p>
        </div>
      )
    }

    if (bloqueado) {
      return (
        <div key={item.id} className="absolute left-1 right-1 rounded-xl p-2 shadow-lg border overflow-hidden group transition-all hover:scale-[1.02] hover:z-50 flex flex-col justify-start"
             style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: 'rgba(120,120,128,0.15)', borderColor: '#71717a', borderLeftWidth: '4px' }}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black leading-none flex items-center gap-1" style={{ color: '#71717a' }}>
              <Lock size={9} /> {item.hora}
            </span>
            <button onClick={() => desbloquearNoScheduler(item)} title="Desbloquear" className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500 hover:scale-110">
              <Unlock size={12} />
            </button>
          </div>
          <h3 className="text-xs font-black uppercase italic truncate leading-tight mt-1" style={{ color: '#71717a' }}>Bloqueado</h3>
          {item.motivo && (
            <p className="text-[9px] font-bold uppercase truncate leading-none mt-0.5 opacity-70" style={{ color: '#71717a' }}>{item.motivo}</p>
          )}
          {visualizacao === 'Semana' && barbeiroFiltro === 'Todos' && (
             <p className="text-[8px] font-bold uppercase truncate mt-auto opacity-70" style={{ color: 'var(--cor-texto-secundario)' }}><User size={8} className="inline mr-1"/>{item.barbeiro}</p>
          )}
        </div>
      )
    }

    return (
      <div key={item.id} onClick={() => abrirDetalhesAgendamento(item)}
           draggable
           onDragStart={(e) => handleDragStartAgendamento(e, item)}
           title="Clique para ver detalhes • arraste para mover de horário/barbeiro"
           className="absolute left-1 right-1 rounded-xl p-2 shadow-lg border overflow-hidden group transition-all hover:scale-[1.02] hover:z-50 flex flex-col justify-start cursor-pointer active:cursor-grabbing"
           style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-primaria)', borderLeftWidth: '4px' }}>
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-black leading-none" style={{ color: 'var(--cor-texto-principal)' }}>{item.hora}</span>
          <button onClick={(e) => { e.stopPropagation(); cancelarCorte(item); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:scale-110">
            <Trash2 size={12} />
          </button>
        </div>
        <h3 className="text-xs font-black uppercase italic truncate leading-tight mt-1" style={{ color: 'var(--cor-texto-principal)' }}>{item.clienteNome}</h3>
        <p className="text-[9px] font-bold uppercase truncate leading-none mt-0.5" style={{ color: 'var(--cor-primaria)' }}>{item.servico}</p>
        {visualizacao === 'Semana' && barbeiroFiltro === 'Todos' && (
           <p className="text-[8px] font-bold uppercase truncate mt-auto opacity-70" style={{ color: 'var(--cor-texto-secundario)' }}><User size={8} className="inline mr-1"/>{item.barbeiro}</p>
        )}
      </div>
    )
  }

  // Pop-up do mini calendário (Mantido do original para não quebrar seu design)
  const primeiroDiaSemanaCalendario = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1).getDay();
  const totalDiasMesCalendario = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).getDate();
  const gridDiasCalendario = Array.from({ length: primeiroDiaSemanaCalendario }).map(() => null).concat(
    Array.from({ length: totalDiasMesCalendario }).map((_, i) => new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), i + 1))
  );

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
            Gestão de <span style={{ color: 'var(--cor-primaria)' }}>Agenda</span>
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--cor-texto-secundario)' }}>
            Visualize e gerencie os atendimentos
          </p>
        </div>

        <div className="flex border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)' }}>
          {['Dia', 'Semana', 'Mês'].map(vis => (
            <button key={vis} onClick={() => setVisualizacao(vis)} className="px-6 py-2 text-xs font-black uppercase transition-all"
              style={{ backgroundColor: visualizacao === vis ? 'var(--cor-primaria)' : 'transparent', color: visualizacao === vis ? '#ffffff' : 'var(--cor-texto-secundario)' }}>
              {vis}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col md:flex-row gap-4 mb-8 p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
          
          <div className="flex-[2] relative">
            <label className="text-[10px] font-black uppercase mb-2 block tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Data Base / Navegação</label>
            <div className="flex gap-2 items-center">
              <button onClick={() => mudarData(visualizacao === 'Mês' ? -30 : visualizacao === 'Semana' ? -7 : -1)} className="p-4 border rounded-2xl hover:brightness-125 transition-all" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}><ChevronLeft size={20}/></button>
              
              <div onClick={() => setMostrarCalendario(!mostrarCalendario)} className="flex-1 border p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:brightness-125 transition-all" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                <div className="flex items-center gap-3">
                  <CalendarDays size={20} style={{ color: 'var(--cor-primaria)' }} />
                  <div className="text-lg">{formatarDataNome(dataSelecionada)}</div>
                </div>
              </div>

              <button onClick={() => mudarData(visualizacao === 'Mês' ? 30 : visualizacao === 'Semana' ? 7 : 1)} className="p-4 border rounded-2xl hover:brightness-125 transition-all" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}><ChevronRight size={20}/></button>
            </div>

            {/* POP-UP DO CALENDÁRIO */}
            {mostrarCalendario && (
              <div className="absolute top-full left-14 mt-2 w-[320px] border p-5 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                <div className="flex justify-between items-center mb-4">
                  <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1))} className="p-2 rounded-xl transition-all hover:opacity-70" style={{ color: 'var(--cor-primaria)', backgroundColor: 'var(--cor-bg-geral)' }}><ChevronLeft size={20}/></button>
                  <span className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--cor-texto-principal)' }}>{NOMES_MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}</span>
                  <button onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1))} className="p-2 rounded-xl transition-all hover:opacity-70" style={{ color: 'var(--cor-primaria)', backgroundColor: 'var(--cor-bg-geral)' }}><ChevronRight size={20}/></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {MAPA_DIAS.map(d => <span key={d} className="text-[10px] font-black uppercase" style={{ color: 'var(--cor-texto-secundario)' }}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {gridDiasCalendario.map((dia, idx) => {
                    if (!dia) return <div key={`empty-${idx}`} />
                    const iso = formatarDataISO(dia);
                    const isSelecionado = iso === dataSelecionada;
                    const isHoje = iso === pegarDiaDeHoje();
                    let estiloBotao = { color: 'var(--cor-texto-secundario)' };
                    if (isSelecionado) estiloBotao = { backgroundColor: 'var(--cor-primaria)', color: '#ffffff' };
                    else if (isHoje) estiloBotao = { backgroundColor: 'transparent', color: 'var(--cor-primaria)', border: '1px solid var(--cor-primaria)' };

                    return (
                      <button key={idx} onClick={() => { setDataSelecionada(iso); setMostrarCalendario(false); }} className="aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all hover:brightness-125 hover:opacity-80" style={estiloBotao}>
                        {dia.getDate()}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-[1.5]">
            <label className="text-[10px] font-black uppercase mb-2 block tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>Filtrar por Barbeiro</label>
            <select value={barbeiroFiltro} onChange={e => setBarbeiroFiltro(e.target.value)} className="w-full border p-4 h-[58px] rounded-2xl outline-none font-bold appearance-none transition-all focus:brightness-125" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}>
              <option value="Todos">Todos os Barbeiros</option>
              {barbeiros.map(b => (
                <option key={b.id} value={b.nome}>{b.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CONTÊINER DO SCHEDULER */}
        <div className="rounded-3xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--cor-borda)' }}>
          {carregando ? (
            <div style={{ backgroundColor: 'var(--cor-card)' }}>
              <Carregando tela={false} label="Buscando dados no servidor..." />
            </div>
          ) : (
            <>
              {visualizacao === 'Dia' && renderVisaoDia()}
              {visualizacao === 'Semana' && renderVisaoSemana()}
              {visualizacao === 'Mês' && renderVisaoMes()}
            </>
          )}
        </div>

        {/* LISTA DE ESPERA */}
        <div className="mt-8 rounded-3xl border shadow-sm" style={{ borderColor: 'var(--cor-borda)', backgroundColor: 'var(--cor-card)' }}>
          <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'var(--cor-borda)' }}>
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--cor-texto-principal)' }}>
              <Users size={18} style={{ color: 'var(--cor-primaria)' }} /> Lista de Espera
              {listaEspera.length > 0 && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--cor-primaria)', color: '#ffffff' }}>{listaEspera.length}</span>
              )}
            </h2>
            <button onClick={buscarListaEspera} disabled={carregandoListaEspera} className="p-2.5 rounded-xl border transition-all hover:brightness-125" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }} title="Atualizar">
              <RefreshCw size={16} className={carregandoListaEspera ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="p-6">
            {listaEspera.length === 0 ? (
              <p className="text-center text-xs font-bold py-6 opacity-50" style={{ color: 'var(--cor-texto-secundario)' }}>Ninguém na lista de espera no momento.</p>
            ) : (
              <div className="space-y-3">
                {listaEspera.map(entrada => (
                  <div key={entrada.id} className="p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div className="font-black px-3 py-1.5 rounded-lg text-xs border" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}>
                        {formatarDataBRSimples(entrada.data)}
                      </div>
                      <div>
                        <p className="font-black uppercase text-sm" style={{ color: 'var(--cor-texto-principal)' }}>{entrada.nome}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70" style={{ color: 'var(--cor-texto-secundario)' }}>
                          {entrada.telefone} • {entrada.barbeiro === 'qualquer' ? 'Qualquer Barbeiro' : entrada.barbeiro}{entrada.servico ? ` • ${entrada.servico}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg" style={entrada.status === 'Notificado' ? { backgroundColor: 'rgba(234,179,8,0.15)', color: '#ca8a04' } : { backgroundColor: 'rgba(120,120,128,0.15)', color: '#71717a' }}>
                        {entrada.status === 'Notificado' ? 'Notificado' : 'Aguardando'}
                      </span>
                      <button onClick={() => removerDaListaEspera(entrada)} className="p-2.5 bg-red-50 border border-red-200 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all" title="Remover da fila">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETALHES / EDIÇÃO DO CORTE — aberto ao clicar num agendamento ativo na grade */}
      {agendamentoDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[3rem] border p-8 shadow-2xl"
               style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>

            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                  Detalhes do <span style={{ color: 'var(--cor-primaria)' }}>Corte</span>
                </h2>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mt-1">
                  {agendamentoDetalhe.barbeiro} • {formatarDataBRSimples(agendamentoDetalhe.data)} às {agendamentoDetalhe.hora}
                </p>
              </div>
              <button onClick={() => setAgendamentoDetalhe(null)} className="p-2 hover:opacity-50 transition-opacity">
                <X size={24} style={{ color: 'var(--cor-texto-principal)' }} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Cliente</label>
                  <AutocompleteCliente
                    clientes={clientesCadastrados}
                    valor={formDetalhe.clienteNome}
                    onChangeTexto={(texto) => {
                      setFormDetalhe(prev => {
                        if (nomeVinculadoDetalheRef.current && texto !== nomeVinculadoDetalheRef.current) {
                          nomeVinculadoDetalheRef.current = '';
                          return { ...prev, clienteNome: texto, clienteTelefone: '' };
                        }
                        return { ...prev, clienteNome: texto };
                      });
                    }}
                    onSelecionar={(cliente) => {
                      nomeVinculadoDetalheRef.current = cliente.nome;
                      setFormDetalhe(prev => ({ ...prev, clienteNome: cliente.nome, clienteTelefone: cliente.telefone || '' }));
                    }}
                    inputClassName="w-full px-6 py-4 rounded-2xl border outline-none transition-all focus:ring-2"
                    inputStyle={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)', '--tw-ring-color': 'var(--cor-primaria)' }}
                    dropdownStyle={{ backgroundColor: configCores?.card || 'var(--cor-card)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}
                    itemHoverStyle={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)' }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Telefone</label>
                  <input value={formDetalhe.clienteTelefone} onChange={e => setFormDetalhe({ ...formDetalhe, clienteTelefone: e.target.value })}
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Serviço</label>
                <select value={formDetalhe.servico} onChange={e => {
                          const valor = e.target.value;
                          const servicoAchado = servicosDisponiveis.find(s => s.nome === valor);
                          const planoAchado = planosDisponiveis.find(p => p.nome === valor);
                          setFormDetalhe(prev => ({
                            ...prev,
                            servico: valor,
                            preco: servicoAchado ? converterPrecoParaNumero(servicoAchado.preco) : planoAchado ? 0 : prev.preco
                          }))
                        }}
                        className="w-full px-6 py-4 rounded-2xl border outline-none font-bold appearance-none"
                        style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                  <option value="">Selecione um serviço...</option>
                  {formDetalhe.servico && !servicosDisponiveis.some(s => s.nome === formDetalhe.servico) && !planosDisponiveis.some(p => p.nome === formDetalhe.servico) && (
                    <option value={formDetalhe.servico}>{formDetalhe.servico} (atual)</option>
                  )}
                  {servicosDisponiveis.length > 0 && (
                    <optgroup label="Serviços">
                      {servicosDisponiveis.map(s => <option key={s.id} value={s.nome}>{s.nome} — {s.preco}</option>)}
                    </optgroup>
                  )}
                  {planosDisponiveis.length > 0 && (
                    <optgroup label="Planos">
                      {planosDisponiveis.map(p => <option key={p.id} value={p.nome}>{p.nome} (Plano)</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              {agendamentoDetalheEhPlano ? (
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-black uppercase text-center">
                  Coberto pelo Plano — sem cobrança avulsa
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Preço Total (R$)</label>
                    <input type="number" step="0.01" min="0" value={formDetalhe.preco}
                           onChange={e => setFormDetalhe({ ...formDetalhe, preco: Math.max(0, parseFloat(e.target.value) || 0) })}
                           className="w-full px-6 py-4 rounded-2xl border outline-none font-black"
                           style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between ml-4">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Itens Extras</label>
                      <button type="button" onClick={adicionarItemExtra}
                              className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity"
                              style={{ color: 'var(--cor-primaria)' }}>
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                    {formDetalhe.itensExtras.length > 0 && (
                      <div className="space-y-2">
                        {formDetalhe.itensExtras.map((extra, idx) => (
                          <div key={idx} className="flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-bold"
                               style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                            <span>{extra.nome}</span>
                            <div className="flex items-center gap-3">
                              <span style={{ color: 'var(--cor-primaria)' }}>R$ {extra.preco.toFixed(2).replace('.', ',')}</span>
                              <button type="button" onClick={() => removerItemExtra(idx)} className="text-red-500 hover:scale-110 transition-transform">
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Observações</label>
                <textarea value={formDetalhe.observacoes} onChange={e => setFormDetalhe({ ...formDetalhe, observacoes: e.target.value })}
                          rows={2}
                          className="w-full px-6 py-4 rounded-2xl border outline-none resize-none"
                          style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-6 mt-6 border-t" style={{ borderColor: 'var(--cor-borda)' }}>
              <button onClick={concluirDaAgenda} disabled={salvandoDetalhe}
                      className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 text-white flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#16a34a' }}>
                <CheckCircle2 size={16} /> {salvandoDetalhe ? 'Aguarde...' : 'Concluir Atendimento'}
              </button>
              <div className="flex gap-3">
                <button onClick={salvarDetalhesAgendamento} disabled={salvandoDetalhe}
                        className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                  <Save size={14} /> Salvar Alterações
                </button>
                <button onClick={cancelarDaAgenda} disabled={salvandoDetalhe}
                        className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-red-500/30 text-red-500 hover:bg-red-500/10 disabled:opacity-50">
                  Cancelar Agendamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGAMENTO / CONCLUSÃO — mesmo componente usado no Dashboard */}
      {agendamentoEmPagamento && (
        <AdminPagamento
          agendamento={agendamentoEmPagamento}
          onClose={() => setAgendamentoEmPagamento(null)}
          onConfirm={handleConcluirPagamento}
        />
      )}

      {/* NOVO AGENDAMENTO — aberto ao clicar num horário vago na grade */}
      {novoAgendamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[3rem] border p-8 shadow-2xl"
               style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>

            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: 'var(--cor-texto-principal)' }}>
                  Marcar <span style={{ color: 'var(--cor-primaria)' }}>Corte</span>
                </h2>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mt-1">
                  Novo agendamento
                </p>
              </div>
              <button onClick={() => setNovoAgendamento(null)} className="p-2 hover:opacity-50 transition-opacity">
                <X size={24} style={{ color: 'var(--cor-texto-principal)' }} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Cliente</label>
                  <AutocompleteCliente
                    clientes={clientesCadastrados}
                    valor={formNovo.clienteNome}
                    placeholder="Nome do cliente"
                    onChangeTexto={(texto) => {
                      setFormNovo(prev => {
                        if (nomeVinculadoNovoRef.current && texto !== nomeVinculadoNovoRef.current) {
                          nomeVinculadoNovoRef.current = '';
                          return { ...prev, clienteNome: texto, clienteTelefone: '' };
                        }
                        return { ...prev, clienteNome: texto };
                      });
                    }}
                    onSelecionar={(cliente) => {
                      nomeVinculadoNovoRef.current = cliente.nome;
                      setFormNovo(prev => ({ ...prev, clienteNome: cliente.nome, clienteTelefone: cliente.telefone || '' }));
                    }}
                    inputClassName="w-full px-6 py-4 rounded-2xl border outline-none transition-all focus:ring-2"
                    inputStyle={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)', '--tw-ring-color': 'var(--cor-primaria)' }}
                    dropdownStyle={{ backgroundColor: configCores?.card || 'var(--cor-card)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}
                    itemHoverStyle={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)' }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Telefone</label>
                  <input value={formNovo.clienteTelefone} onChange={e => setFormNovo({ ...formNovo, clienteTelefone: e.target.value })}
                         placeholder="(00) 00000-0000"
                         className="w-full px-6 py-4 rounded-2xl border outline-none"
                         style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Barbeiro</label>
                  <select value={formNovo.barbeiro} onChange={e => setFormNovo({ ...formNovo, barbeiro: e.target.value })}
                          className="w-full px-6 py-4 rounded-2xl border outline-none font-bold appearance-none"
                          style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                    <option value="">Selecione...</option>
                    {barbeiros.map(b => <option key={b.id} value={b.nome}>{b.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Data</label>
                  <input type="date" value={formNovo.data} min={pegarDiaDeHoje()}
                         onChange={e => {
                           const novaData = e.target.value;
                           setFormNovo(prev => ({
                             ...prev,
                             data: novaData,
                             // Se a data virou hoje e a hora escolhida já passou, empurra pro
                             // primeiro horário ainda disponível — evita cair num select com
                             // uma hora inválida escondida no meio das opções.
                             hora: horarioJaPassou(novaData, prev.hora)
                               ? (horariosGrid.find(h => !horarioJaPassou(novaData, h)) || prev.hora)
                               : prev.hora
                           }));
                         }}
                         className="w-full px-6 py-4 rounded-2xl border outline-none font-bold"
                         style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Hora</label>
                  <select value={formNovo.hora} onChange={e => setFormNovo({ ...formNovo, hora: e.target.value })}
                          className="w-full px-6 py-4 rounded-2xl border outline-none font-bold appearance-none"
                          style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                    {horariosGrid.filter(h => !horarioJaPassou(formNovo.data, h)).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Serviço</label>
                <select value={formNovo.servico} onChange={e => {
                          const valor = e.target.value;
                          const servicoAchado = servicosDisponiveis.find(s => s.nome === valor);
                          const planoAchado = planosDisponiveis.find(p => p.nome === valor);
                          setFormNovo(prev => ({
                            ...prev,
                            servico: valor,
                            preco: servicoAchado ? converterPrecoParaNumero(servicoAchado.preco) : planoAchado ? 0 : prev.preco
                          }))
                        }}
                        className="w-full px-6 py-4 rounded-2xl border outline-none font-bold appearance-none"
                        style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }}>
                  <option value="">Selecione um serviço...</option>
                  {servicosDisponiveis.length > 0 && (
                    <optgroup label="Serviços">
                      {servicosDisponiveis.map(s => <option key={s.id} value={s.nome}>{s.nome} — {s.preco}</option>)}
                    </optgroup>
                  )}
                  {planosDisponiveis.length > 0 && (
                    <optgroup label="Planos">
                      {planosDisponiveis.map(p => <option key={p.id} value={p.nome}>{p.nome} (Plano)</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Preço Total (R$)</label>
                <input type="number" step="0.01" min="0" value={formNovo.preco}
                       onChange={e => setFormNovo({ ...formNovo, preco: Math.max(0, parseFloat(e.target.value) || 0) })}
                       className="w-full px-6 py-4 rounded-2xl border outline-none font-black"
                       style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-4 opacity-50">Observações</label>
                <textarea value={formNovo.observacoes} onChange={e => setFormNovo({ ...formNovo, observacoes: e.target.value })}
                          rows={2}
                          className="w-full px-6 py-4 rounded-2xl border outline-none resize-none"
                          style={{ backgroundColor: configCores?.fundo || 'var(--cor-input-bg)', borderColor: 'var(--cor-borda)', color: configCores?.texto || 'var(--cor-texto-principal)' }} />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-6 mt-6 border-t" style={{ borderColor: 'var(--cor-borda)' }}>
              <button onClick={salvarNovoAgendamento} disabled={salvandoNovo}
                      className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 text-white flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'var(--cor-primaria)' }}>
                <Plus size={16} /> {salvandoNovo ? 'Aguarde...' : 'Marcar Corte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}