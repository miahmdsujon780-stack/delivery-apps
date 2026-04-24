import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDoc, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';

// Default placeholder config
const placeholderConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

let firebaseConfig = placeholderConfig;

// Use a try-catch for the import to handle environments where the file might not exist or be invalid
try {
  // @ts-ignore
  const config = await import('../firebase-applet-config.json');
  if (config && config.default && config.default.apiKey !== "REPLACE_WITH_YOUR_API_KEY") {
    firebaseConfig = config.default;
  }
} catch (e) {
  console.warn("Firebase config not found or invalid, using placeholders.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// @ts-ignore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const googleProvider = new GoogleAuthProvider();

export const isConfigured = firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY";

export { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  getDoc, 
  doc, 
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  signInWithPopup,
  signOut
};
