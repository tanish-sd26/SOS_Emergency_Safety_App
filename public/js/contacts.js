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

