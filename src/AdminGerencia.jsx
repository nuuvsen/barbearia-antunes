import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs } from 'firebase/firestore'

export default function AdminGerencia() {
  const [stats, setStats] = useState({ faturamento: 0, total: 0 })

  useEffect(() => {
    const calcular = async () => {
      const snap = await getDocs(collection(db, "agendamentos"))
      let soma = 0
      snap.docs.forEach(d => {
        const val = d.data().preco?.replace(/\D/g, '') || 0
        soma += parseInt(val) / 100 // Ajuste para centavos se necessário, ou direto se for inteiro
      })
      setStats({ faturamento: soma, total: snap.docs.length })
    }
    calcular()
  }, [])

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-10">Relatórios de <span className="text-red-600">Gerência</span></h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-red-600 p-8 rounded-3xl shadow-xl shadow-red-600/20">
          <p className="text-xs font-black uppercase opacity-80">Faturamento Bruto Total</p>
          <p className="text-5xl font-black mt-2">R$ {stats.faturamento.toFixed(2)}</p>
        </div>
        <div className="bg-[#111111] border border-[#1f1f1f] p-8 rounded-3xl">
          <p className="text-xs text-gray-500 font-black uppercase">Volume de Atendimentos</p>
          <p className="text-5xl font-black mt-2">{stats.total}</p>
        </div>
      </div>
    </div>
  )
}