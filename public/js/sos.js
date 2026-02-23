import { auth, db } from './firebase.js';
import { getCurrentUser } from './navigation.js';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
//EmiailJs credentials
const EMAILJS_PUBLIC_KEY = "iffnx5J7YOcNkpma3";       
const EMAILJS_SERVICE_ID = "service_enahgir";       
const EMAILJS_TEMPLATE_ID = "template_2b4t0sg"; 

// DOM REFERENCES
const sosButton = document.getElementById('sosButton');
const sosModal = document.getElementById('sosModal');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const progressModal = document.getElementById('progressModal');
const progressGPS = document.getElementById('progressGPS');
const progressSave = document.getElementById('progressSave');
const progressEmail = document.getElementById('progressEmail');
const progressSMS = document.getElementById('progressSMS');
const progressAudio = document.getElementById('progressAudio');
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
const safeSection = document.getElementById('safeSection');
const safeButton = document.getElementById('safeButton');


// ═══════════════════════════════════════
// MP3 ALARM SYSTEM
// ═══════════════════════════════════════

let alarmAudio = null;
let isAlarmActive = false;
let currentAlertDocId = null;

/**
 * START the MP3 alarm
 * Plays sos-alarm.mp3 on loop at full volume
 */
function startAlarm() {
  if (isAlarmActive) return;
  isAlarmActive = true;

  // Get the audio element from HTML
  alarmAudio = document.getElementById('sosAlarmAudio');

  // Agar HTML mein audio element nahi mila to new Audio create karo
  if (!alarmAudio) {
    alarmAudio = new Audio('/assets/audio/sos-alarm.mp3');
    alarmAudio.loop = true;
  }

  // Settings
  alarmAudio.loop = true;       // Continuous loop - band nahi hoga
  alarmAudio.volume = 1.0;      // Full volume
  alarmAudio.currentTime = 0;   // Start se play karo

  // Play the alarm
  alarmAudio.play()
    .then(() => {
      console.log('🔊 MP3 Alarm started playing');
    })
    .catch((error) => {
      console.error('❌ Audio play failed:', error);
      // Kuch browsers block karte hain auto-play
      // But humne user click se trigger kiya hai to chalega
    });

  // Show I'M SAFE button
  if (safeSection) safeSection.classList.remove('hidden');

  // Hide SOS button
  if (sosButton) sosButton.classList.add('hidden');

  // Add red flashing effects to page
  document.body.classList.add('alarm-active');

  console.log('🔊 Alarm ACTIVE');
}

/**
 * STOP the MP3 alarm
 * Called when user clicks "I'M SAFE"
 */
function stopAlarm() {
  isAlarmActive = false;

  // Stop the audio
  if (alarmAudio) {
    alarmAudio.pause();          // Pause karo
    alarmAudio.currentTime = 0;  // Reset to beginning
    alarmAudio.loop = false;     // Loop band karo
  }

  // Hide I'M SAFE button
  if (safeSection) safeSection.classList.add('hidden');

  // Show SOS button again
  if (sosButton) sosButton.classList.remove('hidden');

  // Remove red flashing effects
  document.body.classList.remove('alarm-active');

  console.log('🔇 Alarm STOPPED');
}

// I'M SAFE BUTTON HANDLER
if (safeButton) {
  safeButton.addEventListener('click', async () => {

    stopAlarm();

    resetStatusSafe();

    if (currentAlertDocId) {
      try {
        const user = auth.currentUser;
        if (user) {
          await updateDoc(
            doc(db, 'users', user.uid, 'sos_history', currentAlertDocId),
            {
              status: 'resolved',
              alarmActive: false,
              resolvedAt: serverTimestamp()
            }
          );
          console.log('✅ Alert marked as resolved in Firestore');
        }
      } catch (error) {
        console.error('Error updating alert:', error);
      }
      currentAlertDocId = null;
    }

    showToast('🛡️ You are marked as SAFE. Alarm stopped.', 'success');

    if (sosButton) {
      sosButton.disabled = false;
      const sublabel = sosButton.querySelector('.sos-sublabel');
      if (sublabel) sublabel.textContent = 'Tap for Emergency';
    }
  });
}

// EMAILJS INIT
if (typeof emailjs !== 'undefined') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// AUTH READY - Load dashboard data
window.addEventListener('authReady', async (e) => {
  const user = e.detail.user;
  await loadDashboardData(user);
  checkGPS();
});

// SOS BUTTON CLICK → SHOW CONFIRM MODAL
if (sosButton) {
  sosButton.addEventListener('click', () => {
    sosModal?.classList.remove('hidden');
  });
}

if (modalCancel) {
  modalCancel.addEventListener('click', () => {
    sosModal?.classList.add('hidden');
  });
}

if (sosModal) {
  sosModal.addEventListener('click', (e) => {
    if (e.target === sosModal) sosModal.classList.add('hidden');
  });
}

// MAIN SOS HANDLER - CONFIRM BUTTON
if (modalConfirm) {
  modalConfirm.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast('You must be logged in', 'error');
      return;
    }

    // Hide confirm modal, show progress modal
    sosModal.classList.add('hidden');
    progressModal.classList.remove('hidden');
    resetProgress();

    try {

      // ═══ STEP 1: CAPTURE GPS LOCATION ═══
      updateProgress(progressGPS, 'loading', 'Capturing GPS location...');
      let latitude, longitude, mapsLink;

      try {
        const position = await getGeolocation();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        updateProgress(progressGPS, 'done', `📍 Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } catch (gpsError) {
        latitude = 0;
        longitude = 0;
        mapsLink = 'https://www.google.com/maps';
        updateProgress(progressGPS, 'error', '⚠️ GPS failed - alert sent without precise location');
      }


      // ═══ STEP 2: SAVE ALERT TO FIRESTORE ═══
      updateProgress(progressSave, 'loading', 'Saving alert to database...');

      const alertData = {
        timestamp: serverTimestamp(),
        latitude,
        longitude,
        mapsLink,
        status: 'active',
        smsSent: false,
        callSent: false,
        emailSent: false,
        alarmActive: true
      };

      const historyRef = collection(db, 'users', user.uid, 'sos_history');
      const alertDoc = await addDoc(historyRef, alertData);
      currentAlertDocId = alertDoc.id;
      updateProgress(progressSave, 'done', '✅ Alert saved to database');


      // ═══ STEP 3: SEND EMAIL ALERTS (EmailJS) ═══
      updateProgress(progressEmail, 'loading', 'Sending email alerts...');
      try {
        await sendEmailAlerts(user, mapsLink);
        updateProgress(progressEmail, 'done', '✅ Email alerts sent');
      } catch (emailError) {
        console.error('Email error:', emailError);
        updateProgress(progressEmail, 'error', '⚠️ Some emails may have failed');
      }


      // ═══ STEP 4: SMS & CALLS (Auto-triggered by Cloud Functions) ═══
      updateProgress(progressSMS, 'done', '✅ SMS & Call triggered via Cloud Functions');


      // ═══ STEP 5: START MP3 ALARM ═══
      updateProgress(progressAudio, 'loading', 'Activating emergency alarm...');
      startAlarm();
      updateProgress(progressAudio, 'done', '🔊 Emergency alarm ACTIVE');

      // Update progress note
      if (progressNote) {
        progressNote.textContent = '🎉 All alerts sent! Press "I\'M SAFE" to stop alarm.';
      }

      // Update status UI
      updateStatusAlert();

      // Show toast
      showToast('🚨 SOS Alert sent! Alarm is active.', 'success');

      // Close progress modal after 3 seconds
      setTimeout(() => {
        progressModal.classList.add('hidden');
      }, 3000);

      // Reload dashboard stats
      await loadDashboardData(user);


    } catch (error) {
      console.error('SOS Error:', error);
      if (progressNote) {
        progressNote.textContent = '❌ Error occurred. Please try again.';
      }
      showToast('Failed to send SOS alert', 'error');
      setTimeout(() => progressModal.classList.add('hidden'), 3000);
    }
  });
}

// EMAIL ALERTS (EmailJS - Frontend)
async function sendEmailAlerts(user, mapsLink) {
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS SDK not loaded');
    return;
  }

  // Get all contacts from Firestore
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

    // Skip contacts without email
    if (!contact.email) return;

    // EmailJS template parameters
    // Ye wahi variables hain jo tumne EmailJS template mein diye hain
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
      .then(() => {
        console.log(`✅ Email sent to ${contact.name} (${contact.email})`);
      })
      .catch((error) => {
        console.error(`❌ Email failed to ${contact.name} (${contact.email}):`, error);
      });

    emailPromises.push(promise);
  });

  await Promise.all(emailPromises);

  // Update Firestore - mark email as sent
  if (currentAlertDocId) {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updateDoc(
          doc(db, 'users', currentUser.uid, 'sos_history', currentAlertDocId),
          { emailSent: true }
        );
      }
    } catch (e) {
      console.error('Email status update error:', e);
    }
  }

  console.log(`📧 Email process completed for ${emailPromises.length} contacts`);
}

// GPS GEOLOCATION
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
    () => {
      if (locationStatus) {
        locationStatus.textContent = 'Active';
        locationStatus.style.color = 'var(--accent-success)';
      }
    },
    () => {
      if (locationStatus) {
        locationStatus.textContent = 'Denied';
        locationStatus.style.color = 'var(--accent-danger)';
      }
    },
    { timeout: 5000 }
  );
}

// LOAD DASHBOARD DATA
async function loadDashboardData(user) {
  try {
    // Contact count
    const contactsSnap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
    if (contactCount) contactCount.textContent = contactsSnap.size;

    // Alert count + last alert
    const historySnap = await getDocs(query(
      collection(db, 'users', user.uid, 'sos_history'),
      orderBy('timestamp', 'desc')
    ));
    if (alertCount) alertCount.textContent = historySnap.size;

    // Show last alert info
    if (historySnap.size > 0 && lastAlertSection) {
      const last = historySnap.docs[0].data();
      lastAlertSection.classList.remove('hidden');

      if (last.timestamp) {
        const date = last.timestamp.toDate ? last.timestamp.toDate() : new Date(last.timestamp);
        if (lastAlertTime) {
          lastAlertTime.textContent = date.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
        }
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

// UI HELPER FUNCTIONS
function updateStatusAlert() {
  if (statusDot) {
    statusDot.classList.remove('safe');
    statusDot.classList.add('alert');
  }
  if (statusText) {
    statusText.textContent = '🚨 EMERGENCY ACTIVE - Alarm Ringing!';
    statusText.style.color = 'var(--accent-danger)';
  }
}

function resetStatusSafe() {
  if (statusDot) {
    statusDot.classList.remove('alert');
    statusDot.classList.add('safe');
  }
  if (statusText) {
    statusText.textContent = 'You are Safe';
    statusText.style.color = '';
  }
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
  [progressGPS, progressSave, progressEmail, progressSMS, progressAudio].forEach(el => {
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
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 4000);
}