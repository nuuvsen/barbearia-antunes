import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function PainelBarbeiro() {
  // Estados para o Login
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [logado, setLogado] = useState(false);
  
  // Estados para a Agenda do Barbeiro
  const [barbeiroLogado, setBarbeiroLogado] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroAgenda, setErroAgenda] = useState('');

  // Verifica se alguém já está logado ao abrir a página
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLogado(true);
        setBarbeiroLogado(user);
        await buscarAgenda(user.uid); 
      } else {
        setLogado(false);
      }
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  // Função disparada ao clicar em "Entrar"
  const gerirLogin = async (e) => {
    e.preventDefault();
    
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 dígitos.");
      return;
    }

    try {
      const emailFicticio = `${nome.toLowerCase().replace(/\s/g, '')}@antunes.com`;
      await signInWithEmailAndPassword(auth, emailFicticio, senha);
      setErro('');
    } catch (err) {
      setErro("Nome ou senha incorretos.");
    }
  };

  // --- NOVA BUSCA: Espelhada no AdminDashboard ---
  const buscarAgenda = async (uidAuth) => {
    try {
      setErroAgenda('');
      
      // 1. Descobrir o NOME real do barbeiro logado
      const qPerfil = query(collection(db, "barbeiros"), where("uid", "==", uidAuth));
      const snapPerfil = await getDocs(qPerfil);

      if (snapPerfil.empty) {
        setErroAgenda("Perfil não encontrado. Verifique com o administrador.");
        return;
      }

      const nomeDoBarbeiro = snapPerfil.docs[0].data().nome;

      // 2. Buscar TODOS os agendamentos (igual no Admin)
      const snapAgendamentos = await getDocs(collection(db, "agendamentos"));
      let todosAgendamentos = snapAgendamentos.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 3. Filtrar apenas os agendamentos DESTE barbeiro e que estão ativos
      let agendaDoBarbeiro = todosAgendamentos.filter(ag => 
        ag.barbeiro === nomeDoBarbeiro && 
        ag.status !== 'Cancelado' && 
        ag.status !== 'Concluído'
      );

      // 4. Ordenar por Data e Hora
      agendaDoBarbeiro.sort((a, b) => {
        const dataA = a.data || "";
        const dataB = b.data || "";
        const horaA = a.hora || "";
        const horaB = b.hora || "";
        return dataA.localeCompare(dataB) || horaA.localeCompare(horaB);
      });

      // 5. Pegar apenas os 5 primeiros
      const proximos5 = agendaDoBarbeiro.slice(0, 5);

      setAgendamentos(proximos5);

    } catch (error) {
      console.error("Erro ao buscar agenda:", error);
      setErroAgenda("Erro ao carregar os clientes. Tente novamente.");
    }
  };

  const fazerLogout = () => {
    signOut(auth);
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-black text-red-600 text-2xl animate-pulse italic">
        Carregando painel...
      </div>
    );
  }

  // --- TELA 1: LOGIN ---
  if (!logado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <form onSubmit={gerirLogin} className="bg-zinc-900 p-8 rounded-lg shadow-lg w-96 border border-zinc-800">
          <h2 className="text-2xl font-black mb-6 text-center text-red-600 italic tracking-tighter">
            ACESSO BARBEIRO
          </h2>
          
          <div className="mb-4">
            <label className="block mb-2 font-bold text-sm text-zinc-300">Seu Nome:</label>
            <input 
              type="text" 
              className="w-full p-3 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-red-500 font-bold uppercase"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Joao"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-bold text-sm text-zinc-300">Senha:</label>
            <input 
              type="password" 
              className="w-full p-3 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-red-500 font-bold"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 dígitos"
              required
            />
          </div>

          {erro && <p className="text-red-500 mb-4 text-sm text-center font-bold uppercase tracking-widest">{erro}</p>}

          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 p-3 rounded font-black transition text-white uppercase tracking-wider">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // --- TELA 2: AGENDA ---
  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-6">
      <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-6 border-b-4 border-red-600">
        <h1 className="text-lg md:text-2xl font-black text-black italic tracking-tighter">
          ANTUNES.OS | <span className="text-red-600">Sua Agenda</span>
        </h1>
        <button 
          onClick={fazerLogout}
          className="bg-black hover:bg-zinc-800 text-white font-bold py-2 px-6 rounded transition uppercase tracking-widest text-xs"
        >
          Sair
        </button>
      </header>

      <main className="bg-white p-4 md:p-6 rounded-lg shadow max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-4 border-b pb-2">
          <h2 className="text-xl font-bold text-zinc-800 uppercase tracking-tighter">Próximos Clientes</h2>
          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Top 5</span>
        </div>
        
        {erroAgenda && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 font-bold text-sm">
            {erroAgenda}
          </div>
        )}

        {agendamentos.length > 0 ? (
          <ul className="space-y-3">
            {agendamentos.map((agendamento, index) => (
              <li 
                key={agendamento.id} 
                // AQUI FOI ALTERADO: Aplicado o estilo escuro idêntico ao AdminDashboard
                className={`py-4 px-4 flex justify-between items-center rounded-lg transition-all bg-[#111111] border border-[#1f1f1f] border-l-4 border-l-red-600 ${
                  index === 0 ? 'shadow-md' : ''
                }`}
              >
                <div>
                  {index === 0 && (
                    <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest mb-1 inline-block">
                      Próximo da Fila
                    </span>
                  )}
                  {/* Atualizado para usar clienteNome e ajustado a cor para branco e cinza claro */}
                  <p className="font-black text-lg text-white uppercase tracking-tighter">{agendamento.clienteNome}</p>
                  <p className="text-sm text-gray-400 font-bold uppercase">{agendamento.servico}</p>
                </div>
                <div className="text-right">
                  {/* Atualizado para usar hora e ajustado a cor para branco e cinza claro */}
                  <p className="font-black text-white text-xl tracking-tighter">{agendamento.hora}</p>
                  <p className="font-bold text-gray-400 text-xs uppercase tracking-widest">{agendamento.data}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !erroAgenda && (
            <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
              <p className="text-zinc-500 font-black text-lg uppercase tracking-tighter">Nenhum agendamento na fila.</p>
              <p className="text-zinc-400 font-bold text-sm">Aproveite para tomar um café!</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}