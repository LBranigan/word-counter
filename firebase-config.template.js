// Firebase Configuration Template
//
// SETUP INSTRUCTIONS:
// 1. Copy this file and rename it to: firebase-config.js
// 2. Replace all the placeholder values below with your actual Firebase project credentials
// 3. Get your credentials from: https://console.firebase.google.com/
//    - Go to Project Settings > General > Your apps > Web app
// 4. IMPORTANT: Never commit firebase-config.js to version control!

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Your web app's Firebase configuration
// REPLACE THESE VALUES WITH YOUR ACTUAL FIREBASE PROJECT CREDENTIALS
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export for use in other modules
export { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where };
