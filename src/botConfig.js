// Endereço do servidor do bot do WhatsApp (Node.js separado deste projeto, veja a pasta
// Bot-barbearia). Antes esse endereço estava escrito direto como "http://localhost:3001"
// em 4 arquivos diferentes — o que só funcionava enquanto o navegador e o bot estivessem
// no mesmo computador (nunca funcionou para o cliente comum acessando o site de fora).
//
// Agora é configurável via VITE_BOT_URL no arquivo .env (veja .env.example). Assim, quando
// o bot estiver rodando local (Docker Desktop, teste) você aponta pra localhost:PORTA, e
// quando ele estiver no VPS você só troca essa variável pelo IP/domínio — sem mexer em
// nenhum componente.
export const BOT_URL = import.meta.env.VITE_BOT_URL || 'http://localhost:3001';
