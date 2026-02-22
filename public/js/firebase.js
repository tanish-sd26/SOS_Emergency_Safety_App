import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js';

/*
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
*/

const firebaseConfig = {
  apiKey: "AIzaSyDurQrlGhvJUJRLTHGtzu986Ig5PEu_wqE",
  authDomain: "sos-emergency-safety-app.firebaseapp.com",
  projectId: "sos-emergency-safety-app",
  storageBucket: "sos-emergency-safety-app.firebasestorage.app",
  messagingSenderId: "186941103305",
  appId: "1:186941103305:web:d4fb7a3cace77a1377c118",
  measurementId: "G-HSNJJSJ6PZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

/*
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
*/

export { app, auth, db, functions };