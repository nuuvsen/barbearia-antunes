import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { db } from './firebase'
import { collection, getDocs } from 'firebase/firestore'

// Aqui nós "puxamos" os arquivos que você acabou de criar!
import Cliente from './Cliente'
import Admin from './Admin'

export default function App() {
  const [servicos, setServicos] = useState([])
  const [loading, setLoading] = useState(true)

  const carregarDados = async () => {
    const snap = await getDocs(collection(db, "servicos"))
    setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoading(false)
  }

  useEffect(() => { 
    carregarDados() 
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-black text-red-600 text-3xl animate-pulse italic tracking-tighter">
        ANTUNES.OS
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Cliente servicos={servicos} />} />
        <Route path="/admin" element={<Admin servicos={servicos} aoMudar={carregarDados} />} />
      </Routes>
    </BrowserRouter>
  )
}