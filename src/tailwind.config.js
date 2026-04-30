/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Usando uma sintaxe mais robusta para o Tailwind
        'primary': 'var(--cor-primaria)',
        'fundo': 'var(--cor-fundo)',
        'card': 'var(--cor-card)',
        'texto': 'var(--cor-texto)',
        'textoSec': 'var(--cor-texto-secundario)',
        'bordaCustom': 'var(--cor-borda)',
      }
    },
  },
  plugins: [],
}