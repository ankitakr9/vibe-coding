import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, deleteDoc, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { auth, db };
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup, GoogleAuthProvider };
export { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, deleteDoc };
