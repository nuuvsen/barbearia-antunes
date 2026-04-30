import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { Save, Palette, Image as ImageIcon, RefreshCcw, LayoutTemplate, CheckCircle2, PlusCircle } from 'lucide-react'

// Cores padrão do sistema
const TEMA_PADRAO = {
  cores: {
    primaria: '#dc2626',
    fundo: '#000000',
    card: '#111111',
    texto: '#ffffff',
    textoSecundario: '#6b7280',
    borda: '#1f1f1f'
  },
  favicon: '',
  presetCustomizado: null // Novo campo para salvar sua escolha
}

// Configurações de Presets Estáticos
const PRESETS = [
  {
    nome: 'Dark Red (Padrão)',
    cores: {
      primaria: '#dc2626',
      fundo: '#000000',
      card: '#111111',
      texto: '#ffffff',
      textoSecundario: '#6b7280',
      borda: '#1f1f1f'
    }
  },
  {
    nome: 'Midnight Blue',
    cores: {
      primaria: '#3b82f6',
      fundo: '#020617',
      card: '#0f172a',
      texto: '#f8fafc',
      textoSecundario: '#94a3b8',
      borda: '#1e293b'
    }
  },
  {
    nome: 'Slate Clean',
    cores: {
      primaria: '#10b981',
      fundo: '#0f172a',
      card: '#1e293b',
      texto: '#ffffff',
      textoSecundario: '#94a3b8',
      borda: '#334155'
    }
  },
  {
    nome: 'White Clean',
    cores: {
      primaria: '#2563eb',
      fundo: '#f3f4f6',
      card: '#ffffff',
      texto: '#111827',
      textoSecundario: '#6b7280',
      borda: '#e5e7eb'
    }
  }
]

export default function Personalizacao() {
  const [tema, setTema] = useState(TEMA_PADRAO)
  const [salvando, setSalvando] = useState(false)

  const aplicarCoresNoSistema = (cores) => {
    if (!cores) return;
    const root = document.documentElement;
    root.style.setProperty('--cor-primaria', cores.primaria);
    root.style.setProperty('--cor-bg-geral', cores.fundo);
    root.style.setProperty('--cor-card', cores.card);
    root.style.setProperty('--cor-texto-principal', cores.texto);
    root.style.setProperty('--cor-texto-secundario', cores.textoSecundario);
    root.style.setProperty('--cor-borda', cores.borda);
    
    localStorage.setItem('tema_customizado', JSON.stringify(cores));
  }

  useEffect(() => {
    const carregarTema = async () => {
      const salvoLocal = localStorage.getItem('tema_customizado');
      if (salvoLocal) {
        const coresLocais = JSON.parse(salvoLocal);
        setTema(prev => ({ ...prev, cores: coresLocais }));
        aplicarCoresNoSistema(coresLocais);
      }

      try {
        const docRef = doc(db, "configuracoes", "personalizacao");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const dadosFirebase = docSnap.data();
          setTema(dadosFirebase);
          aplicarCoresNoSistema(dadosFirebase.cores);
          if (dadosFirebase.favicon) atualizarFavicon(dadosFirebase.favicon);
        }
      } catch (error) {
        console.error("Erro ao carregar tema do Firebase:", error);
      }
    }
    carregarTema();
  }, []);

  const atualizarFavicon = (url) => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  const handleCorChange = (campo, valor) => {
    const novasCores = { ...tema.cores, [campo]: valor };
    setTema({ ...tema, cores: novasCores });
    aplicarCoresNoSistema(novasCores); 
  }

  const aplicarPreset = (presetCores) => {
    setTema(prev => ({ ...prev, cores: presetCores }));
    aplicarCoresNoSistema(presetCores);
  }

  const salvarComoPresetPessoal = () => {
    setTema(prev => ({
      ...prev,
      presetCustomizado: { ...prev.cores }
    }));
    alert("Cores atuais definidas como seu preset! Não esqueça de 'Salvar Alterações' para gravar no banco.");
  }

  const salvarPersonalizacao = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, "configuracoes", "personalizacao"), tema);
      localStorage.setItem('tema_customizado', JSON.stringify(tema.cores));
      if (tema.favicon) localStorage.setItem('favicon_customizado', tema.favicon);
      alert("Identidade visual salva com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar no banco de dados.");
    }
    setSalvando(false);
  }

  const resetarPadrao = () => {
    if(window.confirm("Deseja voltar para as cores originais?")) {
      setTema(TEMA_PADRAO);
      aplicarCoresNoSistema(TEMA_PADRAO.cores);
      localStorage.removeItem('tema_customizado');
      localStorage.removeItem('favicon_customizado');
    }
  }

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      
      {/* HEADER DA SEÇÃO */}
      <div 
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl border transition-colors"
        style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}
      >
        <div>
          <h2 className="text-xl font-black uppercase flex items-center gap-3" style={{ color: 'var(--cor-texto-principal)' }}>
            <Palette size={24} style={{ color: 'var(--cor-primaria)' }} />
            Identidade Visual
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--cor-texto-secundario)' }}>
            Configure o branding da plataforma
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={resetarPadrao}
            className="p-3 rounded-xl transition-all hover:brightness-125 border"
            style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-secundario)' }}
            title="Resetar para o padrão"
          >
            <RefreshCcw size={18} />
          </button>
          <button 
            onClick={salvando ? null : salvarPersonalizacao}
            disabled={salvando}
            style={{ backgroundColor: 'var(--cor-primaria)' }}
            className="text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 shadow-lg"
          >
            {salvando ? "Salvando..." : <><Save size={16} /> Salvar Alterações</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLUNA DE CONFIGURAÇÃO */}
        <div className="space-y-4">
          <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2" style={{ color: 'var(--cor-texto-secundario)' }}>
              <ImageIcon size={14} /> Ícone da Aba (Favicon)
            </h3>
            <input 
              type="text" 
              placeholder="URL da imagem (Ex: https://sua-logo.png)"
              value={tema.favicon}
              onChange={(e) => {
                setTema({...tema, favicon: e.target.value});
                atualizarFavicon(e.target.value);
              }}
              className="w-full bg-black/5 dark:bg-black/20 border p-4 rounded-xl outline-none focus:ring-1 text-sm transition-all"
              style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-principal)' }}
            />
          </div>

          <div className="p-6 rounded-[2rem] border space-y-4" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: 'var(--cor-texto-secundario)' }}>
                <Palette size={14} /> Paleta de Cores
              </h3>
              <button 
                onClick={salvarComoPresetPessoal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all hover:bg-white/5"
                style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-primaria)' }}
              >
                <PlusCircle size={12} /> Salvar como meu preset
              </button>
            </div>

            {[
              { id: 'primaria', label: 'Cor Principal' },
              { id: 'fundo', label: 'Fundo da Tela' },
              { id: 'card', label: 'Fundo dos Cards' },
              { id: 'borda', label: 'Bordas e Divisores' },
              { id: 'texto', label: 'Texto Principal' },
              { id: 'textoSecundario', label: 'Texto de Apoio' },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 pr-4 rounded-2xl border" style={{ backgroundColor: 'var(--cor-bg-geral)', borderColor: 'var(--cor-borda)' }}>
                <span className="text-[10px] font-black uppercase tracking-wider pl-2" style={{ color: 'var(--cor-texto-secundario)' }}>
                  {item.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono opacity-50 uppercase" style={{ color: 'var(--cor-texto-principal)' }}>
                    {tema.cores[item.id]}
                  </span>
                  <input 
                    type="color" 
                    value={tema.cores[item.id]}
                    onChange={(e) => handleCorChange(item.id, e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0 overflow-hidden"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA DE PREVIEW E PRESETS */}
        <div className="space-y-6">
          <div className="sticky top-6 space-y-6">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2 ml-2">
                <LayoutTemplate size={14} /> Visualização em Tempo Real
              </h3>
              
              <div 
                className="p-8 rounded-[2.5rem] shadow-2xl transition-all duration-300 border"
                style={{ 
                  backgroundColor: tema.cores.fundo, 
                  borderColor: tema.cores.borda 
                }}
              >
                <div className="flex items-center justify-between pb-6 mb-6 border-b" style={{ borderColor: tema.cores.borda }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: tema.cores.primaria }}>
                      {tema.favicon && <img src={tema.favicon} className="w-full h-full object-cover" alt="Favicon" />}
                    </div>
                    <span className="font-black italic uppercase text-xs" style={{ color: tema.cores.texto }}>
                      Antunes<span style={{ color: tema.cores.primaria }}>.OS</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-2xl border" style={{ backgroundColor: tema.cores.card, borderColor: tema.cores.borda }}>
                    <h4 className="font-black uppercase text-[10px] mb-1" style={{ color: tema.cores.textoSecundario }}>Status do Sistema</h4>
                    <p className="text-2xl font-black" style={{ color: tema.cores.primaria }}>Online</p>
                  </div>

                  <div className="p-5 rounded-2xl border flex items-center justify-between" style={{ backgroundColor: tema.cores.card, borderColor: tema.cores.borda }}>
                    <div className="w-2/3 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full w-3/4" style={{ backgroundColor: tema.cores.primaria }}></div>
                    </div>
                    <button className="px-4 py-2 rounded-lg font-black uppercase text-[8px] text-white" style={{ backgroundColor: tema.cores.primaria }}>
                      Botão Exemplo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MENU DE PRESETS DE CORES */}
            <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2" style={{ color: 'var(--cor-texto-secundario)' }}>
                <Palette size={14} /> Presets Sugeridos
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => aplicarPreset(p.cores)}
                    className="flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 group"
                    style={{ 
                      backgroundColor: p.cores.fundo, 
                      borderColor: tema.cores.primaria === p.cores.primaria ? p.cores.primaria : 'var(--cor-borda)' 
                    }}
                  >
                    <div className="flex gap-1">
                      <div className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: p.cores.primaria }}></div>
                      <div className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: p.cores.card }}></div>
                    </div>
                    <span className="text-[9px] font-black uppercase text-center leading-tight" style={{ color: p.cores.texto }}>
                      {p.nome}
                    </span>
                    {tema.cores.primaria === p.cores.primaria && (
                      <CheckCircle2 size={14} style={{ color: p.cores.primaria }} />
                    )}
                  </button>
                ))}

                {/* SLOT DO PRESET CUSTOMIZADO PELO USUÁRIO */}
                <button
                  onClick={() => tema.presetCustomizado && aplicarPreset(tema.presetCustomizado)}
                  disabled={!tema.presetCustomizado}
                  className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${tema.presetCustomizado ? 'hover:scale-[1.02] active:scale-95' : 'opacity-40 cursor-not-allowed'}`}
                  style={{ 
                    backgroundColor: tema.presetCustomizado?.fundo || 'transparent', 
                    borderColor: tema.presetCustomizado ? 'var(--cor-primaria)' : 'var(--cor-borda)',
                    borderStyle: tema.presetCustomizado ? 'solid' : 'dashed'
                  }}
                >
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: tema.presetCustomizado?.primaria || '#333' }}></div>
                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: tema.presetCustomizado?.card || '#333' }}></div>
                  </div>
                  <span className="text-[9px] font-black uppercase text-center leading-tight" style={{ color: tema.presetCustomizado?.texto || 'var(--cor-texto-secundario)' }}>
                    {tema.presetCustomizado ? 'Meu Estilo' : 'Vazio'}
                  </span>
                  {tema.presetCustomizado && tema.cores.primaria === tema.presetCustomizado.primaria && (
                    <CheckCircle2 size={14} style={{ color: tema.cores.primaria }} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}