// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAwYCAQ7s4OvfL9WpK1YAiiQh0OQnkmtpo",
    authDomain: "word-analyzer-web-app-27ee4.firebaseapp.com",
    projectId: "word-analyzer-web-app-27ee4",
    storageBucket: "word-analyzer-web-app-27ee4.firebasestorage.app",
    messagingSenderId: "613470043919",
    appId: "1:613470043919:web:f30329b0379a7361d8087a",
    measurementId: "G-H0FDSL43GM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export for use in other modules
export { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where };
