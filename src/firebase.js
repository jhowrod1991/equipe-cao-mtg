import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  // Suas credenciais do Firebase...
  apiKey: "SUA_API_KEY",
  authDomain: "database-equipe-cao.firebaseapp.com",
  projectId: "database-equipe-cao",
  storageBucket: "database-equipe-cao.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();