import { useRef, useState } from 'react'

// Textarea com autocompletar de variáveis: digite "/" em qualquer ponto do texto e um
// menu aparece com as variáveis disponíveis PRA AQUELE CAMPO (cada mensagem tem seu
// próprio conjunto — ver VARIAVEIS_DISPONIVEIS em GerenciadorBot.jsx). Continuar digitando
// depois da "/" filtra a lista pelo nome; Esc ou clicar fora fecha o menu sem inserir nada.
// Existe pra eliminar o erro clássico de digitar "{Nome}" ou "{ nome }" na mão e a variável
// nunca ser substituída de verdade na mensagem enviada.
export default function CampoComVariaveis({ value, onChange, variaveis, className, style, placeholder, rows }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [posicaoSlash, setPosicaoSlash] = useState(null)
  const textareaRef = useRef(null)

  const variaveisFiltradas = (variaveis || []).filter(v =>
    v.nome.toLowerCase().includes(filtro.toLowerCase())
  )

  const handleChange = (e) => {
    const novoValor = e.target.value
    const cursorPos = e.target.selectionStart
    onChange(novoValor)

    // Procura uma "/" logo antes do cursor, sem espaço ou quebra de linha no meio —
    // é o que abre (ou mantém aberto, filtrando) o menu de variáveis.
    const textoAntesCursor = novoValor.slice(0, cursorPos)
    const match = textoAntesCursor.match(/\/([a-zA-Z0-9À-ÿ]*)$/)
    if (match) {
      setPosicaoSlash(cursorPos - match[0].length)
      setFiltro(match[1])
      setMenuAberto(true)
    } else {
      setMenuAberto(false)
    }
  }

  const inserirVariavel = (variavel) => {
    if (posicaoSlash === null || !textareaRef.current) return
    const cursorPos = textareaRef.current.selectionStart
    const antes = value.slice(0, posicaoSlash)
    const depois = value.slice(cursorPos)
    const novoValor = `${antes}${variavel.valor}${depois}`
    onChange(novoValor)
    setMenuAberto(false)
    setTimeout(() => {
      const novaPos = antes.length + variavel.valor.length
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(novaPos, novaPos)
    }, 0)
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => { if (e.key === 'Escape') setMenuAberto(false) }}
        placeholder={placeholder}
        rows={rows}
        className={className}
        style={style}
      />
      {menuAberto && variaveisFiltradas.length > 0 && (
        <div
          className="absolute z-20 left-1 right-1 bottom-full mb-1 rounded-xl border shadow-lg overflow-hidden max-h-44 overflow-y-auto"
          style={{ backgroundColor: 'var(--cor-card)', borderColor: 'var(--cor-primaria)' }}
        >
          {variaveisFiltradas.map(v => (
            <button
              key={v.valor}
              type="button"
              // preventDefault no mousedown evita que o textarea perca o foco ANTES do
              // clique registrar — sem isso, o menu sumiria (por perda de foco) antes de
              // inserirVariavel rodar.
              onMouseDown={(e) => { e.preventDefault(); inserirVariavel(v) }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:brightness-95"
              style={{ borderBottom: '1px solid var(--cor-borda)' }}
            >
              <span className="text-xs font-black" style={{ color: 'var(--cor-primaria)' }}>{v.valor}</span>
              <span className="text-[9px] font-medium text-right opacity-70" style={{ color: 'var(--cor-texto-secundario)' }}>{v.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
