import React, { useState, useEffect } from 'react';
// CORREÇÃO AQUI: Mudamos de '../firebase' para './firebase'
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

  // Verifica se alguém já está logado ao abrir a página
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLogado(true);
        setBarbeiroLogado(user);
        await buscarAgendaDoBarbeiro(user.uid);
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
      // Cria o e-mail fictício para o Firebase Auth (ex: solano@antunes.com)
      const emailFicticio = `${nome.toLowerCase().replace(/\s/g, '')}@antunes.com`;
      await signInWithEmailAndPassword(auth, emailFicticio, senha);
      setErro('');
    } catch (err) {
      setErro("Nome ou senha incorretos.");
    }
  };

  // Busca apenas os clientes DESTE barbeiro no banco de dados
  const buscarAgendaDoBarbeiro = async (barbeiroId) => {
    try {
      const q = query(
        collection(db, "agendamentos"), 
        where("barbeiroId", "==", barbeiroId) 
      );
      const querySnapshot = await getDocs(q);
      const listaAgendamentos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAgendamentos(listaAgendamentos);
    } catch (error) {
      console.error("Erro ao buscar agenda:", error);
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

  // --- TELA 1: SE NÃO ESTIVER LOGADO (MOSTRA O LOGIN) ---
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
              className="w-full p-3 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-red-500 font-bold"
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

          {erro && <p className="text-red-500 mb-4 text-sm text-center font-bold">{erro}</p>}

          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 p-3 rounded font-black transition text-white uppercase tracking-wider">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // --- TELA 2: SE ESTIVER LOGADO (MOSTRA A AGENDA) ---
  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-6">
      <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-6 border-b-4 border-red-600">
        <h1 className="text-lg md:text-2xl font-black text-black italic tracking-tighter">
          ANTUNES.OS | <span className="text-red-600">Sua Agenda</span>
        </h1>
        <button 
          onClick={fazerLogout}
          className="bg-black hover:bg-zinc-800 text-white font-bold py-2 px-6 rounded transition"
        >
          Sair
        </button>
      </header>

      <main className="bg-white p-4 md:p-6 rounded-lg shadow max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4 border-b pb-2 text-zinc-800">Próximos Clientes</h2>
        
        {agendamentos.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {agendamentos.map((agendamento) => (
              <li key={agendamento.id} className="py-4 flex justify-between items-center hover:bg-zinc-50 px-2 rounded transition">
                <div>
                  <p className="font-bold text-lg text-black">{agendamento.nomeCliente}</p>
                  <p className="text-sm text-zinc-600 font-semibold">{agendamento.servico}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-red-600 text-lg">{agendamento.horario}</p>
                  <p className="font-bold text-zinc-500 text-sm">{agendamento.data}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-500 font-bold text-lg">Nenhum agendamento para hoje.</p>
            <p className="text-zinc-400">Aproveite para tomar um café!</p>
          </div>
        )}
      </main>
    </div>
  );
}