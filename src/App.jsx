import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { db } from './firebase'
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore'

// Importação dos componentes
import Cliente from './Cliente'
import Admin from './Admin'
import PainelBarbeiro from './PainelBarbeiro'
import SuperAdmin from './SuperAdmin'

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

    // Atualiza o Favicon
    if (favicon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = favicon;
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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Cliente servicos={servicos} />} />
        <Route path="/admin" element={<Admin servicos={servicos} aoMudar={carregarDados} />} />
        <Route path="/barbeiro" element={<PainelBarbeiro />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
      </Routes>
    </BrowserRouter>
  );
}