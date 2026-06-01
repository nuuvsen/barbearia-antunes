import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 
import { getStorage } from "firebase/storage";

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

// Inicializa o banco de dados COM suporte offline e "exporta" ele
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

// Inicializa a Autenticação e "exporta" ela (ISSO RESOLVE A TELA BRANCA)
export const auth = getAuth(app);

// Inicializa o Storage e "exporta" ele
export const storage = getStorage(app);