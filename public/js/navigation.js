import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const loadingOverlay = document.getElementById('loadingOverlay');
const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const dropdownName = document.getElementById('dropdownName');
const dropdownEmail = document.getElementById('dropdownEmail');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '/index.html'; return; }
  currentUser = user;
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
  if (dropdownName) dropdownName.textContent = user.displayName || 'User';
  if (dropdownEmail) dropdownEmail.textContent = user.email || '';
  window.dispatchEvent(new CustomEvent('authReady', { detail: { user } }));
});

if (profileBtn && dropdownMenu) {
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.contains('show') ? closeDropdown() : openDropdown();
  });
  document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && !profileBtn.contains(e.target)) closeDropdown();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDropdown(); });
}

function openDropdown() {
  if (dropdownMenu) {
    dropdownMenu.classList.remove('hidden');
    requestAnimationFrame(() => dropdownMenu.classList.add('show'));
    if (profileBtn) profileBtn.setAttribute('aria-expanded', 'true');
  }
}

function closeDropdown() {
  if (dropdownMenu) {
    dropdownMenu.classList.remove('show');
    if (profileBtn) profileBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!dropdownMenu.classList.contains('show')) dropdownMenu.classList.add('hidden'); }, 200);
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try { await signOut(auth); } catch (e) { window.location.href = '/index.html'; }
  });
}

export { currentUser };
export function getCurrentUser() { return auth.currentUser; }