import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const authMessage = document.getElementById('authMessage');
const loadingOverlay = document.getElementById('loadingOverlay');

// Auth state check
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = '/pages/dashboard.html';
  } else {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }
});

// Form switching
if (showSignup) {
  showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    hideMessage(); clearErrors();
  });
}
if (showLogin) {
  showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    hideMessage(); clearErrors();
  });
}

// Password toggle
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (target) {
      const isPass = target.type === 'password';
      target.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁';
    }
  });
});

// LOGIN
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(); hideMessage();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    let hasError = false;

    if (!email) { showFieldError('loginEmailError', 'Email is required'); hasError = true; }
    else if (!isValidEmail(email)) { showFieldError('loginEmailError', 'Enter a valid email'); hasError = true; }
    if (!password) { showFieldError('loginPasswordError', 'Password is required'); hasError = true; }
    if (hasError) return;

    setLoading(document.getElementById('loginBtn'), true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(document.getElementById('loginBtn'), false);
      showMessage(getAuthError(error.code), 'error');
    }
  });
}

// SIGNUP
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(); hideMessage();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    let hasError = false;

    if (!name || name.length < 2) { showFieldError('signupNameError', 'Name must be at least 2 characters'); hasError = true; }
    if (!email || !isValidEmail(email)) { showFieldError('signupEmailError', 'Enter a valid email'); hasError = true; }
    if (!phone) { showFieldError('signupPhoneError', 'Phone number is required'); hasError = true; }
    if (!password || password.length < 6) { showFieldError('signupPasswordError', 'Password must be at least 6 characters'); hasError = true; }
    if (password !== confirm) { showFieldError('signupConfirmError', 'Passwords do not match'); hasError = true; }
    if (hasError) return;

    setLoading(document.getElementById('signupBtn'), true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        name, email, phone, createdAt: serverTimestamp()
      });
    } catch (error) {
      setLoading(document.getElementById('signupBtn'), false);
      showMessage(getAuthError(error.code), 'error');
    }
  });
}

// Helpers
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function showMessage(t, type) { if(authMessage){authMessage.textContent=t;authMessage.className=`auth-message show ${type}`;} }
function hideMessage() { if(authMessage){authMessage.className='auth-message';authMessage.textContent='';} }
function showFieldError(id, msg) { const el=document.getElementById(id);if(el)el.textContent=msg; }
function clearErrors() { document.querySelectorAll('.input-error').forEach(e=>e.textContent='');document.querySelectorAll('.input-group input').forEach(e=>e.classList.remove('error')); }
function setLoading(btn, loading) {
  if(!btn)return;
  const text=btn.querySelector('.btn-text'),loader=btn.querySelector('.btn-loader');
  if(loading){btn.disabled=true;if(text)text.classList.add('hidden');if(loader)loader.classList.remove('hidden');}
  else{btn.disabled=false;if(text)text.classList.remove('hidden');if(loader)loader.classList.add('hidden');}
}
function getAuthError(code) {
  const m={'auth/email-already-in-use':'Account already exists','auth/invalid-email':'Invalid email','auth/weak-password':'Password too weak','auth/user-not-found':'No account found','auth/wrong-password':'Incorrect password','auth/invalid-credential':'Invalid email or password','auth/too-many-requests':'Too many attempts. Try later','auth/network-request-failed':'Network error'};
  return m[code]||'An error occurred. Please try again.';
}

document.querySelectorAll('.input-group input').forEach(input => {
  input.addEventListener('focus', () => {
    input.classList.remove('error');
    const err = input.closest('.input-group')?.querySelector('.input-error');
    if(err) err.textContent = '';
  });
});