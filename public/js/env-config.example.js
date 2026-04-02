/*
  Copy this file to public/js/env-config.js and replace the placeholders with your real values.
  Keep public/js/env-config.js out of source control.
*/

window.APP_CONFIG = window.APP_CONFIG || {};

window.APP_CONFIG.firebase = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID",
  measurementId: "FIREBASE_MEASUREMENT_ID",
};

window.APP_CONFIG.emailjs = {
  publicKey: "EMAILJS_PUBLIC_KEY",
  serviceId: "EMAILJS_SERVICE_ID",
  templateId: "EMAILJS_TEMPLATE_ID",
};
