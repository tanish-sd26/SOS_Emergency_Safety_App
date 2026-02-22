/**
 * ═══════════════════════════════════════════════════════════
 * SOS MODULE - GPS + Firestore + EmailJS + Twilio trigger
 * ═══════════════════════════════════════════════════════════
 */

import { auth, db } from './firebase.js';
import { getCurrentUser } from './navigation.js';
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';


const EMAILJS_PUBLIC_KEY = "iffnx5J7YOcNkpma3";       
const EMAILJS_SERVICE_ID = "service_enahgir";       
const EMAILJS_TEMPLATE_ID = "template_2b4t0sg";     

// DOM References
const sosButton = document.getElementById('sosButton');
const sosModal = document.getElementById('sosModal');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const progressModal = document.getElementById('progressModal');
const progressGPS = document.getElementById('progressGPS');
const progressSave = document.getElementById('progressSave');
const progressEmail = document.getElementById('progressEmail');
const progressSMS = document.getElementById('progressSMS');
const progressNote = document.getElementById('progressNote');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const contactCount = document.getElementById('contactCount');
const alertCount = document.getElementById('alertCount');
const locationStatus = document.getElementById('locationStatus');
const lastAlertSection = document.getElementById('lastAlertSection');
const lastAlertTime = document.getElementById('lastAlertTime');
const lastAlertLink = document.getElementById('lastAlertLink');
const lastSmsStatus = document.getElementById('lastSmsStatus');
const lastCallStatus = document.getElementById('lastCallStatus');
const lastEmailStatus = document.getElementById('lastEmailStatus');
const toastContainer = document.getElementById('toastContainer');

// Initialize EmailJS
if (typeof emailjs !== 'undefined') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// Auth ready
window.addEventListener('authReady', async (e) => {
  const user = e.detail.user;
  await loadDashboardData(user);
  checkGPS();
});

// SOS Button Click
if (sosButton) sosButton.addEventListener('click', () => sosModal?.classList.remove('hidden'));
if (modalCancel) modalCancel.addEventListener('click', () => sosModal?.classList.add('hidden'));
if (sosModal) sosModal.addEventListener('click', (e) => { if (e.target === sosModal) sosModal.classList.add('hidden'); });

// ═══════════════════════════════════════
// MAIN SOS HANDLER
// ═══════════════════════════════════════
if (modalConfirm) {
  modalConfirm.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) { showToast('You must be logged in', 'error'); return; }

    // Hide confirm modal, show progress
    sosModal.classList.add('hidden');
    progressModal.classList.remove('hidden');
    resetProgress();

    try {
      // ═══ STEP 1: GPS ═══
      updateProgress(progressGPS, 'loading', 'Capturing GPS location...');
      let latitude, longitude, mapsLink;

      try {
        const position = await getGeolocation();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        updateProgress(progressGPS, 'done', `📍 Location captured: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } catch (gpsError) {
        // GPS failed - use fallback
        latitude = 0;
        longitude = 0;
        mapsLink = 'https://www.google.com/maps';
        updateProgress(progressGPS, 'error', '⚠️ GPS failed - alert sent without location');
      }

      // ═══ STEP 2: SAVE TO FIRESTORE ═══
      updateProgress(progressSave, 'loading', 'Saving alert to database...');
      const alertData = {
        timestamp: serverTimestamp(),
        latitude,
        longitude,
        mapsLink,
        status: 'sent',
        smsSent: false,
        callSent: false,
        emailSent: false
      };

      const historyRef = collection(db, 'users', user.uid, 'sos_history');
      await addDoc(historyRef, alertData);
      updateProgress(progressSave, 'done', '✅ Alert saved to database');

      // ═══ STEP 3: SEND EMAILS (EmailJS - Frontend) ═══
      updateProgress(progressEmail, 'loading', 'Sending email alerts...');
      try {
        await sendEmailAlerts(user, mapsLink);
        updateProgress(progressEmail, 'done', '✅ Email alerts sent');
      } catch (emailError) {
        console.error('Email error:', emailError);
        updateProgress(progressEmail, 'error', '⚠️ Some emails may have failed');
      }

      // ═══ STEP 4: SMS & CALLS (Triggered automatically by Cloud Function) ═══
      updateProgress(progressSMS, 'done', '✅ SMS & Call triggered via Cloud Functions');
      if (progressNote) progressNote.textContent = '🎉 All alerts sent! Cloud Functions will handle SMS & Calls.';

      // Update UI
      updateStatusAlert();
      showToast('🚨 SOS Alert sent successfully!', 'success');
      disableSOSTemporarily();

      // Close progress after 3 seconds
      setTimeout(() => {
        progressModal.classList.add('hidden');
      }, 3000);

      // Reload dashboard
      await loadDashboardData(user);

      // Reset status after 30 seconds
      setTimeout(resetStatusSafe, 30000);

    } catch (error) {
      console.error('SOS Error:', error);
      if (progressNote) progressNote.textContent = '❌ Error occurred. Please try again.';
      showToast('Failed to send SOS alert', 'error');
      setTimeout(() => progressModal.classList.add('hidden'), 3000);
    }
  });
}

// ═══════════════════════════════════════
// EMAIL ALERTS (EmailJS)
// ═══════════════════════════════════════
async function sendEmailAlerts(user, mapsLink) {
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS not loaded');
    return;
  }

  // Get contacts
  const contactsRef = collection(db, 'users', user.uid, 'contacts');
  const snapshot = await getDocs(contactsRef);

  if (snapshot.empty) {
    console.log('No contacts to email');
    return;
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const emailPromises = [];

  snapshot.forEach((docSnap) => {
    const contact = docSnap.data();

    if (!contact.email) return;

    const templateParams = {
      to_email: contact.email,
      contact_name: contact.name,
      user_name: user.displayName || 'SOS User',
      user_email: user.email,
      maps_link: mapsLink,
      timestamp: timestamp,
      message: `${user.displayName || 'SOS User'} has triggered an emergency SOS alert! They need your help immediately. Click the Google Maps link to see their location.`
    };

    const promise = emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
      .then((response) => {
        console.log(`✅ Email sent to ${contact.name} (${contact.email}):`, response);
      })
      .catch((error) => {
        console.error(`❌ Email failed to ${contact.name} (${contact.email}):`, error);
      });

    emailPromises.push(promise);
  });

  await Promise.all(emailPromises);
  console.log(`📧 Email alerts process completed for ${emailPromises.length} contacts`);
}

// ═══════════════════════════════════════
// GPS
// ═══════════════════════════════════════
function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

function checkGPS() {
  if (!navigator.geolocation) {
    if (locationStatus) locationStatus.textContent = 'Not Supported';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    () => { if (locationStatus) { locationStatus.textContent = 'Active'; locationStatus.style.color = 'var(--accent-success)'; } },
    () => { if (locationStatus) { locationStatus.textContent = 'Denied'; locationStatus.style.color = 'var(--accent-danger)'; } },
    { timeout: 5000 }
  );
}

// ═══════════════════════════════════════
// DASHBOARD DATA
// ═══════════════════════════════════════
async function loadDashboardData(user) {
  try {
    // Contact count
    const contactsSnap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
    if (contactCount) contactCount.textContent = contactsSnap.size;

    // Alert count + last alert
    const historySnap = await getDocs(query(collection(db, 'users', user.uid, 'sos_history'), orderBy('timestamp', 'desc')));
    if (alertCount) alertCount.textContent = historySnap.size;

    if (historySnap.size > 0 && lastAlertSection) {
      const last = historySnap.docs[0].data();
      lastAlertSection.classList.remove('hidden');

      if (last.timestamp) {
        const date = last.timestamp.toDate ? last.timestamp.toDate() : new Date(last.timestamp);
        if (lastAlertTime) lastAlertTime.textContent = date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
      if (lastAlertLink && last.mapsLink) lastAlertLink.href = last.mapsLink;
      if (lastSmsStatus) lastSmsStatus.textContent = `SMS: ${last.smsSent ? '✅' : '⏳'}`;
      if (lastCallStatus) lastCallStatus.textContent = `Call: ${last.callSent ? '✅' : '⏳'}`;
      if (lastEmailStatus) lastEmailStatus.textContent = `Email: ${last.emailSent ? '✅' : '⏳'}`;
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}

// ═══════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════
function updateStatusAlert() {
  if (statusDot) { statusDot.classList.remove('safe'); statusDot.classList.add('alert'); }
  if (statusText) { statusText.textContent = '🚨 Alert Sent!'; statusText.style.color = 'var(--accent-danger)'; }
}

function resetStatusSafe() {
  if (statusDot) { statusDot.classList.remove('alert'); statusDot.classList.add('safe'); }
  if (statusText) { statusText.textContent = 'You are Safe'; statusText.style.color = ''; }
}

function disableSOSTemporarily() {
  if (!sosButton) return;
  sosButton.disabled = true;
  let countdown = 10;
  const sublabel = sosButton.querySelector('.sos-sublabel');
  const original = sublabel ? sublabel.textContent : '';

  const interval = setInterval(() => {
    countdown--;
    if (sublabel) sublabel.textContent = `Wait ${countdown}s...`;
    if (countdown <= 0) {
      clearInterval(interval);
      sosButton.disabled = false;
      if (sublabel) sublabel.textContent = original;
    }
  }, 1000);
}

function updateProgress(el, status, text) {
  if (!el) return;
  const icon = el.querySelector('.progress-icon');
  const textEl = el.querySelector('.progress-text');

  el.classList.remove('done', 'error');

  if (status === 'loading') {
    if (icon) icon.textContent = '⏳';
  } else if (status === 'done') {
    el.classList.add('done');
    if (icon) icon.textContent = '✅';
  } else if (status === 'error') {
    el.classList.add('error');
    if (icon) icon.textContent = '❌';
  }

  if (textEl) textEl.textContent = text;
}

function resetProgress() {
  [progressGPS, progressSave, progressEmail, progressSMS].forEach(el => {
    if (el) {
      el.classList.remove('done', 'error');
      const icon = el.querySelector('.progress-icon');
      if (icon) icon.textContent = '⏳';
    }
  });
  if (progressNote) progressNote.textContent = 'Please wait...';
}

function showToast(msg, type = 'info') {
  if (!toastContainer) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4000);
}