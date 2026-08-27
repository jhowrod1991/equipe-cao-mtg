import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAuId53jwl9DXY6g4rjlwSMmCLDc5aGews",
  authDomain: "database-equipe-cao.firebaseapp.com",
  projectId: "database-equipe-cao",
  storageBucket: "database-equipe-cao.firebasestorage.app",
  messagingSenderId: "415392201455",
  appId: "1:415392201455:web:f84d549120d62c2772b91a",
  measurementId: "G-DPNRR750C5"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
