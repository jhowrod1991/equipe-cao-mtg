import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSy...", // Cole a sua apiKey real aqui
  authDomain: "database-equipe-cao.firebaseapp.com",
  projectId: "database-equipe-cao",
  storageBucket: "database-equipe-cao.firebasestorage.app",
  messagingSenderId: "123456789...", // Cole o seu messagingSenderId real aqui
  appId: "1:123456789...:web:..." // Cole o seu appId real aqui
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
