import { useState, useRef, useEffect } from 'react';

// Campo de nome de cliente com sugestões: digita 2+ letras e aparece uma lista de
// clientes já cadastrados pra clicar, em vez de ter que digitar o nome inteiro toda vez.
// Ao clicar numa sugestão, o telefone do cliente (quando existir) vem junto — e quem
// estiver usando decide o que fazer com ele (autofill de outro campo, gravar junto no
// documento, etc). Se o nome digitado depois deixar de bater com o que foi selecionado,
// quem chama pode invalidar esse telefone (ver "nomeVinculado" no controle de cada tela).
export default function AutocompleteCliente({
  clientes = [],
  valor,
  onChangeTexto,
  onSelecionar,
  placeholder,
  inputClassName,
  inputStyle,
  dropdownStyle = {},
  itemHoverStyle = { backgroundColor: 'rgba(0,0,0,0.06)' },
}) {
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const containerRef = useRef(null);

  const termo = (valor || '').trim().toLowerCase();
  const sugestoes = termo.length >= 2
    ? clientes.filter(c => (c.nome || '').toLowerCase().includes(termo)).slice(0, 8)
    : [];

  useEffect(() => { setIndiceAtivo(-1); }, [valor]);

  useEffect(() => {
    const aoClicarFora = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const selecionar = (cliente) => {
    onSelecionar(cliente);
    setAberto(false);
  };

  const aoTeclar = (e) => {
    if (!aberto || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceAtivo(i => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceAtivo(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && indiceAtivo >= 0) {
      e.preventDefault();
      selecionar(sugestoes[indiceAtivo]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  const mostrarLista = aberto && sugestoes.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={valor}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { onChangeTexto(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        className={inputClassName}
        style={inputStyle}
      />
      {mostrarLista && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 rounded-2xl border shadow-2xl overflow-hidden max-h-56 overflow-y-auto"
          style={dropdownStyle}
        >
          {sugestoes.map((c, i) => (
            <li
              key={c.telefone || `${c.nome}-${i}`}
              onClick={() => selecionar(c)}
              onMouseEnter={() => setIndiceAtivo(i)}
              className="px-4 py-3 cursor-pointer text-sm font-bold flex items-center justify-between gap-3 transition-colors"
              style={i === indiceAtivo ? itemHoverStyle : undefined}
            >
              <span className="truncate">{c.nome}</span>
              {c.telefone && (
                <span className="text-[10px] font-black opacity-50 flex-shrink-0">{c.telefone}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
