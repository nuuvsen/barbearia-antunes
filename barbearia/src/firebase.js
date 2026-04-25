import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDvHAf6GShqzUFTbopXXlN39uMzL0leLIY",
  authDomain: "barbearia-antunes-eb17d.firebaseapp.com",
  projectId: "barbearia-antunes-eb17d",
  storageBucket: "barbearia-antunes-eb17d.firebasestorage.app",
  messagingSenderId: "142047287122",
  appId: "1:142047287122:web:0148f7a69fe74500a0cc8b",
  measurementId: "G-4Z7P50KMVF"
};

// Inicializa a conexão com o Google
const app = initializeApp(firebaseConfig);

// Inicializa o Banco de Dados e "exporta" ele para podermos usar no App.jsx
export const db = getFirestore(app);