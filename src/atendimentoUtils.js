import { doc, updateDoc, addDoc, collection, query, where, getDocs, increment } from 'firebase/firestore'
import { db } from './firebase'
import { BOT_URL } from './botConfig'

// Conclui um atendimento (agendamento OU comanda): fecha o financeiro (comissão/lucro),
// baixa estoque dos produtos vendidos junto, registra Fiado quando for o caso e dispara a
// pesquisa de satisfação (NPS) pelo bot do WhatsApp.
//
// Extraído de AdminDashboard.jsx (onde essa lógica morava sozinha) pra ser compartilhado
// também com AdminAgenda.jsx — sem isso, "concluir atendimento" teria dois comportamentos
// diferentes dependendo de onde o admin clicasse, e uma correção feita num lugar (ex: o
// bug de comissão/lucro não recalculado no desconto de uma comanda) facilmente ficaria
// esquecida no outro.
//
// Retorna { fiadoFalhou }: o registro de Fiado é uma falha não-fatal (o atendimento já foi
// concluído no financeiro/estoque quando isso acontece) — cabe a quem chamou decidir como
// avisar o admin nesse caso, já que Dashboard e Agenda usam sistemas de notificação
// diferentes (react-hot-toast vs SweetAlert2).
export async function concluirAtendimento({ id, agendamento, dadosPagamento = {}, barbeiros = [] }) {
  if (!id) {
    throw new Error("ID do atendimento não encontrado.")
  }

  // "formaPagamento" é o nome de campo que os relatórios de AdminGerencia.jsx já leem.
  const { metodo, desconto, valorFinal, isPlano } = dadosPagamento;
  const dadosFinalizacao = {
    status: "Concluído",
    ...(metodo !== undefined && { formaPagamento: metodo }),
    ...(desconto !== undefined && { desconto }),
    ...(valorFinal !== undefined && { valorFinal }),
    ...(isPlano !== undefined && { isPlano }),
  };

  const dataAtual = new Date();
  const mesReferencia = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;

  // Comanda.jsx passa "origem: 'comanda'" ao abrir o pagamento logo após criar a comanda.
  // Mas um item retomado de uma fila unificada (agendamentos+comandas) marca esse campo
  // como "tipo", não "origem" — checar os dois evita tentar dar updateDoc em "agendamentos"
  // com um ID que só existe em "comandas".
  if (agendamento?.origem === 'comanda' || agendamento?.tipo === 'comanda') {
    // Comanda.jsx congela comissaoBarbeiro/lucroBarbearia na criação, calculados em cima do
    // valor CHEIO (antes de qualquer desconto). Se o caixa dá um desconto aqui na hora de
    // fechar o pagamento, "valorFinal" fica certo, mas comissaoBarbeiro/lucroBarbearia
    // precisam ser reescalados na mesma proporção do desconto, senão o desconto nunca
    // aparece em nenhum relatório (Gerência, Comissões).
    const valorTotalOriginal = Number(agendamento.valorTotal || 0);
    if (typeof valorFinal === 'number' && valorTotalOriginal > 0 && valorFinal !== valorTotalOriginal) {
      const proporcao = valorFinal / valorTotalOriginal;
      dadosFinalizacao.comissaoBarbeiro = Number(agendamento.comissaoBarbeiro || 0) * proporcao;
      dadosFinalizacao.lucroBarbearia = valorFinal - dadosFinalizacao.comissaoBarbeiro;
    }

    await updateDoc(doc(db, "comandas", id), dadosFinalizacao);

    if (agendamento.produtos && agendamento.produtos.length > 0) {
      for (const prod of agendamento.produtos) {
        const nomeProduto = typeof prod === 'string' ? prod : prod.nome;

        if (nomeProduto && nomeProduto !== 'Nenhum' && nomeProduto !== '') {
          const qProd = query(collection(db, "produtos"), where("nome", "==", nomeProduto.trim()));
          const snapProd = await getDocs(qProd);

          if (!snapProd.empty) {
            const produtoRef = snapProd.docs[0].ref;
            const estoqueAtual = snapProd.docs[0].data().estoque || 0;
            if (estoqueAtual > 0) {
              await updateDoc(produtoRef, { estoque: increment(-1) });
            }
          }
        }
      }
    }
  } else {
    // Agendamentos (vindos do site/agenda) nunca tinham comissão congelada. Calculamos aqui,
    // no momento da conclusão, pros relatórios de Gerência poderem somar agendamentos e
    // comandas juntos sem recalcular comissão com a porcentagem atual (que pode já ter
    // mudado depois).
    const dadosBarbeiro = barbeiros.find(b => b.nome === agendamento?.barbeiro);
    const taxaServico = (dadosBarbeiro?.comissaoServico ?? 50) / 100;

    let valorBase = 0; // Atendimento coberto por plano não gera valor novo
    if (!isPlano) {
      if (typeof valorFinal === 'number') {
        valorBase = valorFinal;
      } else {
        // Fallback: sem dadosPagamento, tenta extrair da string de preço (ex: "R$ 45,00")
        const valStr = agendamento?.preco?.toString().replace(/\D/g, '') || '0';
        valorBase = parseInt(valStr) / 100;
      }
    }
    const comissaoBarbeiro = valorBase * taxaServico;

    await updateDoc(doc(db, "agendamentos", id), {
      ...dadosFinalizacao,
      valorGerado: valorBase,
      comissaoBarbeiro,
      lucroBarbearia: valorBase - comissaoBarbeiro,
      mesReferencia,
    });
  }

  // FIADO: quando a forma de recebimento é "a receber depois", registra a dívida num livro
  // separado (coleção "fiados") pra dar pra cobrar o cliente e baixar o saldo aos poucos
  // (AdminFiado.jsx), sem misturar com o que já foi efetivamente recebido em caixa.
  let fiadoFalhou = false;
  if (metodo === 'Fiado' && typeof valorFinal === 'number' && valorFinal > 0) {
    try {
      await addDoc(collection(db, "fiados"), {
        clienteNome: agendamento?.clienteNome || 'Cliente',
        clienteTelefone: agendamento?.clienteTelefone || null,
        barbeiro: agendamento?.barbeiro || 'Equipe',
        servico: agendamento?.servico || 'Atendimento',
        origem: (agendamento?.origem === 'comanda' || agendamento?.tipo === 'comanda') ? 'comanda' : 'agendamento',
        origemId: id,
        valor: valorFinal,
        valorPago: 0,
        saldo: valorFinal,
        status: 'Aberto',
        data: dataAtual.toLocaleDateString('pt-BR'),
        dataCriacao: dataAtual.toISOString(),
        mesReferencia,
        pagamentos: []
      });
    } catch (erroFiado) {
      console.error("Erro ao registrar fiado:", erroFiado);
      fiadoFalhou = true;
    }
  }

  // Dispara a pesquisa de satisfação (NPS) pelo bot — não-fatal: se o bot estiver fora do
  // ar, o atendimento já foi concluído normalmente, só não sai a pesquisa pra esse cliente.
  if (agendamento) {
    try {
      await fetch(`${BOT_URL}/api/bot/nps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: agendamento.clienteTelefone,
          nomeCliente: agendamento.clienteNome,
          barbeiro: agendamento.barbeiro || "Equipe"
        })
      });
    } catch (errorBot) {
      console.error("Erro ao acionar o bot de NPS:", errorBot);
    }
  }

  return { fiadoFalhou };
}
