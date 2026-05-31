import { useState } from 'react';
import { Info, Calendar, Scissors, Settings, MessageSquare, Palette, ChevronDown } from 'lucide-react';

export default function Sobre() {
  const [secaoAberta, setSecaoAberta] = useState(null);

  const topicos = [
    {
      id: 1,
      icone: <Info size={20} />,
      titulo: "Visão Geral do Sistema",
      conteudo: "O nosso sistema foi desenhado para automatizar 100% da sua barbearia. Desde o momento em que o cliente agenda um corte pelo site, até o lembrete via WhatsApp, o fechamento da comanda e a pesquisa de satisfação pós-corte. Aqui você tem o controle do financeiro, da sua equipe e do marketing, tudo em um só lugar."
    },
    {
      id: 2,
      icone: <Calendar size={20} />,
      titulo: "Site de Agendamentos (Cliente)",
      conteudo: "O cliente acessa o site, escolhe o profissional, os serviços e o horário disponível. Para confirmar, ele insere o número de telefone (que será seu cadastro). O sistema bloqueia horários ocupados para evitar choques. Após agendar, o cliente recebe uma confirmação imediata no WhatsApp!"
    },
    {
      id: 3,
      icone: <Scissors size={20} />,
      titulo: "Painel do Barbeiro",
      conteudo: "Cada barbeiro tem um acesso individual simplificado. Ele não vê as finanças da barbearia, apenas a sua Agenda do Dia. Ele visualiza o próximo cliente e o serviço. Assim que o corte termina, o barbeiro clica em 'Concluído', liberando o cliente para o caixa."
    },
    {
      id: 4,
      icone: <Settings size={20} />,
      titulo: "Gestão Administrativa",
      conteudo: "O administrador tem controle total. No Dashboard, vê o faturamento e o desempenho da equipe. Pode adicionar novos profissionais, serviços e produtos. Na área de Comandas, fecha a conta do cliente adicionando itens extras (como bebidas) e registra o pagamento no sistema."
    },
    {
      id: 5,
      icone: <MessageSquare size={20} />,
      titulo: "Robô do WhatsApp",
      conteudo: "O Assistente Virtual faz o trabalho duro! Ele envia Lembretes Automáticos de agendamentos, permite Disparo de Campanhas de marketing em massa, possui um 'Radar de Sumidos' (que chama clientes inativos de volta) e envia uma Pesquisa de Satisfação (NPS) após o corte."
    },
    {
      id: 6,
      icone: <Palette size={20} />,
      titulo: "Personalização Visual",
      conteudo: "Na aba de Personalização, você pode trocar as cores principais do sistema, alterar o logotipo e modificar os textos do site. Tudo reflete instantaneamente para os clientes, mantendo a identidade visual da sua marca."
    }
  ];

  const alternarSecao = (id) => {
    setSecaoAberta(secaoAberta === id ? null : id);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Cabeçalho */}
      <div className="border rounded-[2.5rem] p-8 md:p-10 shadow-sm transition-colors" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2" style={{ color: 'var(--cor-texto-principal)' }}>
          Central de <span style={{ color: 'var(--cor-primaria)' }}>Ajuda</span>
        </h2>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--cor-texto-secundario)' }}>
          Entenda como cada módulo do sistema funciona
        </p>
      </div>

      {/* Lista de Tópicos */}
      <div className="space-y-4">
        {topicos.map((topico) => (
          <div 
            key={topico.id} 
            className="border rounded-3xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md"
            style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}
          >
            <button 
              onClick={() => alternarSecao(topico.id)}
              className="w-full flex items-center justify-between p-6 text-left focus:outline-none transition-colors hover:brightness-95"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}>
                  {topico.icone}
                </div>
                <h3 className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--cor-texto-principal)' }}>
                  {topico.titulo}
                </h3>
              </div>
              <ChevronDown 
                size={20} 
                style={{ color: 'var(--cor-texto-secundario)' }}
                className={`transition-transform duration-300 ${secaoAberta === topico.id ? 'rotate-180' : ''}`}
              />
            </button>
            
            {/* Conteúdo Expansível */}
            <div 
              className={`transition-all duration-300 ease-in-out ${secaoAberta === topico.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div className="p-6 pt-0 border-t mt-2" style={{ borderColor: 'var(--cor-borda)' }}>
                <p className="text-sm font-medium leading-relaxed mt-4" style={{ color: 'var(--cor-texto-secundario)' }}>
                  {topico.conteudo}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}