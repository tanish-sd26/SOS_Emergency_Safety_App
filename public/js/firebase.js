import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';


const firebaseConfig = window.APP_CONFIG?.firebase;

if (!firebaseConfig) {
  throw new Error('Missing Firebase config. Create public/js/env-config.js from .env or run scripts/generate-client-config.js');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);


export { app, auth, db, functions };