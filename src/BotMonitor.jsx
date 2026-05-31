import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export default function BotMonitor() {
  const statusAnterior = useRef(null);

  useEffect(() => {
    // Função que vai perguntar direto para o seu servidor Node.js qual é o status
    const verificarStatus = async () => {
      try {
        // Tenta bater na mesma rota que o seu GerenciadorBot.jsx provavelmente usa
        const resposta = await fetch('http://localhost:3001/api/bot/status');
        const dados = await resposta.json();
        const statusAtual = String(dados.status || dados.state || '').toLowerCase();

        // Se o status mudou em relação ao que sabíamos antes...
        if (statusAtual !== statusAnterior.current) {
          
          // Evita mostrar o Toast logo no primeiro milissegundo que a página carrega,
          // a não ser que seja um erro ou desconectado. 
          // (Foca em avisar as MUDANÇAS de status)
          if (statusAnterior.current !== null) {
            if (statusAtual === 'conectado' || statusAtual === 'online' || statusAtual === 'connected') {
              toast.success('Bot conectado e operando!');
            } 
            else if (statusAtual === 'desconectado' || statusAtual === 'offline' || statusAtual === 'disconnected') {
              toast('Bot offline ou aguardando QR Code.', { icon: '💤' });
            }
            else if (statusAtual === 'iniciando' || statusAtual === 'starting') {
              toast('Iniciando sistema do Assistente...', { icon: '🤖' });
            }
          }

          // Atualiza a memória com o novo status
          statusAnterior.current = statusAtual;
        }
      } catch (error) {
        // Se o fetch der erro, significa que o servidor do Bot (Node.js) está totalmente desligado
        if (statusAnterior.current !== 'servidor_desligado') {
          if (statusAnterior.current !== null) {
            toast.error('O servidor do Bot foi desligado.');
          }
          statusAnterior.current = 'servidor_desligado';
        }
      }
    };

    // Verifica imediatamente ao carregar o site
    verificarStatus();

    // Fica verificando a cada 5 segundos (5000 milissegundos) invisivelmente
    const intervalo = setInterval(verificarStatus, 5000);

    // Se o componente for fechado, limpa o intervalo
    return () => clearInterval(intervalo);
  }, []);

  return null;
}