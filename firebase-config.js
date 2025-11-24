// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBEsELaZRKKqVJHrHr6NMRWIQNk7opA_-U",
    authDomain: "word-analyzer-c2287.firebaseapp.com",
    projectId: "word-analyzer-c2287",
    storageBucket: "word-analyzer-c2287.firebasestorage.app",
    messagingSenderId: "14073591688",
    appId: "1:14073591688:web:8344f1cba0ebbe277a2c3d",
    measurementId: "G-NFBBRMXZ42"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export for use in other modules
export { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where };
