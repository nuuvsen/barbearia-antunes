import { app, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

// Garante que o diretório funcione em qualquer versão do Node/Vite
const isESM = typeof __dirname === 'undefined';
const currentDir = isESM ? path.dirname(fileURLToPath(import.meta.url)) : __dirname;

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 👈 Esconde a janela até estar carregada
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  win.setMenu(null) 

  // Carrega o site (Desenvolvimento vs Produção)
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // Aponta para o arquivo real compilado
    win.loadFile(path.join(currentDir, '../dist/index.html'))
  }

  // 👈 Só mostra a tela quando o React carregar para evitar tela branca
  win.once('ready-to-show', () => {
    win.show()
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})