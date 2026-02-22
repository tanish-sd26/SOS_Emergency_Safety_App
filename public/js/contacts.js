import { auth, db } from './firebase.js';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const addContactForm = document.getElementById('addContactForm');
const contactName = document.getElementById('contactName');
const contactPhone = document.getElementById('contactPhone');
const contactEmail = document.getElementById('contactEmail');
const contactRelation = document.getElementById('contactRelation');
const addContactBtn = document.getElementById('addContactBtn');
const contactsList = document.getElementById('contactsList');
const emptyContacts = document.getElementById('emptyContacts');
const contactsBadge = document.getElementById('contactsBadge');
const deleteModal = document.getElementById('deleteModal');
const deleteCancel = document.getElementById('deleteCancel');
const deleteConfirm = document.getElementById('deleteConfirm');
const deleteContactNameEl = document.getElementById('deleteContactName');
const toastContainer = document.getElementById('toastContainer');

let deleteTargetId = null;
let deleteTargetName = '';

window.addEventListener('authReady', async (e) => { await loadContacts(e.detail.user); });

// ADD CONTACT
if (addContactForm) {
  addContactForm.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors();
    const user = auth.currentUser;
    if (!user) { showToast('You must be logged in', 'error'); return; }

    const name = contactName.value.trim();
    const phone = contactPhone.value.trim();
    const email = contactEmail.value.trim();
    const relation = contactRelation ? contactRelation.value : '';
    let hasError = false;

    if (!name || name.length < 2) { showFieldError('contactNameError', 'Name is required (min 2 chars)'); hasError = true; }
    if (!phone || !isValidPhone(phone)) { showFieldError('contactPhoneError', 'Enter a valid phone number'); hasError = true; }
    if (!email || !isValidEmail(email)) { showFieldError('contactEmailError', 'Enter a valid email address'); hasError = true; }
    if (hasError) return;

    setButtonLoading(addContactBtn, true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'contacts'), {
        name, phone, email, relation, createdAt: serverTimestamp()
      });
      addContactForm.reset();
      showToast('✅ Contact added successfully!', 'success');
      await loadContacts(user);
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to add contact', 'error');
    } finally {
      setButtonLoading(addContactBtn, false);
    }
  });
}

// LOAD CONTACTS
async function loadContacts(user) {
  if (!contactsList) return;
  try {
    const snap = await getDocs(query(collection(db, 'users', user.uid, 'contacts'), orderBy('createdAt', 'desc')));
    contactsList.innerHTML = '';
    if (snap.empty) {
      if (emptyContacts) emptyContacts.classList.remove('hidden');
      if (contactsBadge) contactsBadge.textContent = '0';
      return;
    }
    if (emptyContacts) emptyContacts.classList.add('hidden');
    if (contactsBadge) contactsBadge.textContent = snap.size;

    snap.forEach((d) => {
      const data = d.data();
      contactsList.appendChild(createContactElement(d.id, data));
    });
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to load contacts', 'error');
  }
}

function createContactElement(id, data) {
  const item = document.createElement('div');
  item.className = 'contact-item';
  item.innerHTML = `
    <div class="contact-info">
      <span class="contact-name">${esc(data.name)}</span>
      <span class="contact-phone">📱 ${esc(data.phone)}</span>
      <span class="contact-email">📧 ${esc(data.email || 'No email')}</span>
      ${data.relation ? `<span class="contact-relation">👤 ${esc(data.relation)}</span>` : ''}
    </div>
    <button class="contact-delete" aria-label="Delete ${esc(data.name)}" title="Delete">🗑️</button>
  `;
  item.querySelector('.contact-delete').addEventListener('click', () => {
    deleteTargetId = id; deleteTargetName = data.name;
    if (deleteContactNameEl) deleteContactNameEl.textContent = data.name;
    if (deleteModal) deleteModal.classList.remove('hidden');
  });
  return item;
}

// DELETE
if (deleteCancel) deleteCancel.addEventListener('click', () => { deleteModal.classList.add('hidden'); deleteTargetId = null; });
if (deleteModal) deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) { deleteModal.classList.add('hidden'); deleteTargetId = null; } });
if (deleteConfirm) {
  deleteConfirm.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || !deleteTargetId) return;
    deleteConfirm.disabled = true; deleteConfirm.textContent = 'Deleting...';
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'contacts', deleteTargetId));
      deleteModal.classList.add('hidden');
      showToast(`${deleteTargetName} removed`, 'success');
      deleteTargetId = null; deleteTargetName = '';
      await loadContacts(user);
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to delete', 'error');
    } finally {
      deleteConfirm.disabled = false; deleteConfirm.textContent = 'Delete';
    }
  });
}

// HELPERS
function isValidPhone(p) { return /^\+?[0-9]{7,15}$/.test(p.replace(/[\s\-\(\)]/g, '')); }
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showFieldError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearErrors() { document.querySelectorAll('.input-error').forEach(e => e.textContent = ''); document.querySelectorAll('.input-group input').forEach(e => e.classList.remove('error')); }
function setButtonLoading(btn, l) {
  if(!btn)return; const t=btn.querySelector('.btn-text'),lo=btn.querySelector('.btn-loader');
  if(l){btn.disabled=true;if(t)t.classList.add('hidden');if(lo)lo.classList.remove('hidden');}
  else{btn.disabled=false;if(t)t.classList.remove('hidden');if(lo)lo.classList.add('hidden');}
}
function showToast(msg, type='info') {
  if(!toastContainer)return;
  const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;
  toastContainer.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},4000);
}
document.querySelectorAll('.input-group input').forEach(i=>{i.addEventListener('focus',()=>{i.classList.remove('error');const e=i.closest('.input-group')?.querySelector('.input-error');if(e)e.textContent='';});});