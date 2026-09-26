import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { db } from './firebase'
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore'
import { Toaster } from 'react-hot-toast';
import BotMonitor from './BotMonitor';
import ConnectionBanner from './ConnectionBanner';

// Importação dos componentes
import Cliente from './Cliente'
import Admin from './Admin'
import PainelBarbeiro from './PainelBarbeiro'
import SuperAdmin from './SuperAdmin'
import RequireAdminAuth from './RequireAdminAuth'

// Este mesmo build/container atende dois domínios diferentes (ver index.html):
// o principal (site do cliente) e um subdomínio próprio pro barbeiro
// (teamantunes.app.nuuvsen.com.br). Usamos subdomínio em vez de só um caminho
// porque o Chrome/Android não deixa instalar dois PWAs separados numa mesma
// origem — assim os dois apps instalados ficam de verdade independentes.
const EH_DOMINIO_BARBEIRO = typeof window !== 'undefined'
  && window.location.hostname === 'teamantunes.app.nuuvsen.com.br'

export default function App() {
  const [servicos, setServicos] = useState([])
  const [loading, setLoading] = useState(true)

  // Função para aplicar o tema no Documento
  const aplicarTema = (dados) => {
    if (!dados || !dados.cores) return;
    
    const root = document.documentElement;
    const { cores, favicon } = dados;

    // Mapeamento exato para as variáveis que o Admin.jsx utiliza
    root.style.setProperty('--cor-primaria', cores.primaria);
    root.style.setProperty('--cor-bg-geral', cores.fundo);
    root.style.setProperty('--cor-card', cores.card);
    root.style.setProperty('--cor-borda', cores.borda);
    root.style.setProperty('--cor-texto-principal', cores.texto);
    root.style.setProperty('--cor-texto-secundario', cores.textoSecundario);

    // Atualiza o Favicon — mesmo fix do Personalizacao.jsx: sem o removeAttribute('type'),
    // um favicon customizado que não seja SVG podia simplesmente não aparecer (o <link>
    // continuava anunciado como image/svg+xml pro navegador). E quando não tem favicon
    // customizado (campo vazio/resetado), volta pro ícone padrão em vez de não fazer nada.
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (favicon) {
      link.href = favicon;
      link.removeAttribute('type');
    } else {
      link.href = '/favicon.svg';
      link.setAttribute('type', 'image/svg+xml');
    }

    // Salva no cache local para o próximo carregamento ser instantâneo
    localStorage.setItem('tema_cache', JSON.stringify(dados));
  };

  // 1. Efeito para carregar o TEMA em Tempo Real
  useEffect(() => {
    // Tenta carregar do localStorage primeiro (evita tela branca/pulo de cor)
    const cache = localStorage.getItem('tema_cache');
    if (cache) {
      aplicarTema(JSON.parse(cache));
    }

    // Escuta mudanças no Firebase (Documento "personalizacao" conforme seu componente anterior)
    const unsub = onSnapshot(doc(db, "configuracoes", "personalizacao"), (docSnap) => {
      if (docSnap.exists()) {
        aplicarTema(docSnap.data());
      }
    }, (error) => {
      console.error("Erro ao carregar tema:", error);
    });

    return () => unsub();
  }, []);

  // 2. Efeito para carregar os SERVIÇOS
  const carregarDados = async () => {
    try {
      const snap = await getDocs(collection(db, "servicos"));
      setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    carregarDados(); 
  }, []);

  // 3. Tela de Loading
  if (loading) {
    return (
      <div 
        style={{ backgroundColor: 'var(--cor-bg-geral, #000)' }}
        className="min-h-screen flex flex-col items-center justify-center font-black italic tracking-tighter"
      >
        <div className="text-4xl animate-pulse">
          <span style={{ color: 'var(--cor-texto-principal, #fff)' }}>ANTUNES</span>
          <span style={{ color: 'var(--cor-primaria, #dc2626)' }}>.OS</span>
        </div>
        <div 
          className="mt-4 w-12 h-1 rounded-full overflow-hidden bg-white/10"
        >
          <div className="h-full bg-[var(--cor-primaria)] animate-progress-loading"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Aviso de "sem conexão" — fica de fora do BrowserRouter, então aparece em
          QUALQUER rota (cliente, /admin, /barbeiro, /superadmin) sem precisar duplicar. */}
      <ConnectionBanner />

      {/* 2. O Toaster injeta os avisos flutuantes em todas as telas do site */}
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#333', // Fundo escuro
            color: '#fff',      // Texto branco
            borderRadius: '10px',
          },
          success: {
            iconTheme: {
              primary: '#16a34a', // Verde
              secondary: '#fff',
            },
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={EH_DOMINIO_BARBEIRO ? <PainelBarbeiro /> : <Cliente servicos={servicos} />} />
          <Route path="/admin" element={
            <RequireAdminAuth configDoc="acessoAdmin" titulo="Acesso Restrito — Painel Admin">
              {/* BotMonitor fica só aqui dentro (painel admin logado). Antes ele estava
                  renderizado no App inteiro, então TODO visitante do site — inclusive o
                  cliente comum na tela de agendamento — ficava, pra sempre, tentando bater
                  a cada 5s em "http://localhost:3001" (um endereço que só existe na máquina
                  do admin). Isso nunca vai funcionar no navegador do cliente. */}
              <BotMonitor />
              <Admin servicos={servicos} aoMudar={carregarDados} />
            </RequireAdminAuth>
          } />
          <Route path="/barbeiro" element={<PainelBarbeiro />} />
          <Route path="/superadmin" element={
            <RequireAdminAuth configDoc="superAdmin" titulo="Acesso Restrito — Super Admin">
              <SuperAdmin />
            </RequireAdminAuth>
          } />
        </Routes>
      </BrowserRouter>
    </>
  );
}