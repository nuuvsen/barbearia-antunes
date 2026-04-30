import React, { useState, useEffect } from 'react';
import { auth, db } from './firebaseConfig'; // Verifique o caminho do seu arquivo firebase
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const AcessoAdmin = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [cores, setCores] = useState({
    primaria: '#2563eb',
    fundo: '#f3f4f6',
    card: '#ffffff',
    texto: '#111827',
    textoSecundario: '#6b7280',
    borda: '#c7c7c7'
  });
  
  const navigate = useNavigate();

  // Busca as cores personalizadas do banco ao carregar a página
  useEffect(() => {
    const buscarCores = async () => {
      try {
        const docRef = doc(db, 'configuracoes', 'personalizacao');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCores(docSnap.data().cores);
        }
      } catch (err) {
        console.error("Erro ao carregar cores:", err);
      }
    };
    buscarCores();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');

    try {
      // 1. Autenticação no Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // 2. Verificação de Permissão no Firestore (Coleção barbeiros)
      // Procuramos o documento onde o emailAcesso seja igual ao logado e permissaoAdmin seja true
      const q = query(
        collection(db, 'barbeiros'), 
        where('emailAcesso', '==', email),
        where('permissaoAdmin', '==', true)
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Sucesso total!
        navigate('/painel-admin'); 
      } else {
        setErro('Usuário não encontrado ou sem permissão de administrador.');
        await auth.signOut(); // Desloga se não for admin
      }
    } catch (error) {
      setErro('E-mail ou senha incorretos.');
    }
  };

  return (
    <div style={{ 
      backgroundColor: cores.fundo, 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ 
        backgroundColor: cores.card, 
        padding: '40px', 
        borderRadius: '12px', 
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        border: `1px solid ${cores.borda}`
      }}>
        <h1 style={{ color: cores.texto, fontSize: '24px', fontWeight: 'bold', margin: '0' }}>
          ANTUNES<span style={{ color: cores.primaria }}>.OS</span>
        </h1>
        <p style={{ color: cores.textoSecundario, fontSize: '12px', marginBottom: '30px', textTransform: 'uppercase' }}>
          Acesso Restrito a Profissionais Autorizados
        </p>

        {erro && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: '#dc2626', 
            padding: '10px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ textAlign: 'left', marginBottom: '15px' }}>
            <label style={{ color: cores.textoSecundario, fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              NOME DO USUÁRIO
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu e-mail de acesso"
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                border: `1px solid ${cores.borda}`,
                boxSizing: 'border-box',
                backgroundColor: '#000', // Conforme o design preto da imagem
                color: '#fff'
              }}
              required
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '25px' }}>
            <label style={{ color: cores.textoSecundario, fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              SENHA
            </label>
            <input 
              type="password" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                border: `1px solid ${cores.borda}`,
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <button type="submit" style={{ 
            width: '100%', 
            padding: '14px', 
            backgroundColor: cores.primaria, 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            ENTRAR NO PAINEL ➔
          </button>
        </form>

        <button 
          onClick={() => navigate('/')}
          style={{ 
            marginTop: '20px', 
            background: 'none', 
            border: 'none', 
            color: cores.textoSecundario, 
            fontSize: '11px', 
            cursor: 'pointer',
            textTransform: 'uppercase'
          }}
        >
          Voltar para o site principal
        </button>
      </div>
    </div>
  );
};

export default AcessoAdmin;