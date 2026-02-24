/**
 * ═══════════════════════════════════════════════════════════════
 * SOS MODULE
 * Features: GPS + WhatsApp + Email + Alarm + Voice Trigger + I'M SAFE
 * ═══════════════════════════════════════════════════════════════
 */
import { auth, db } from './firebase.js';
import { getCurrentUser } from './navigation.js';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const EMAILJS_PUBLIC_KEY = "iffnx5J7YOcNkpma3";       
const EMAILJS_SERVICE_ID = "service_enahgir";       
const EMAILJS_TEMPLATE_ID = "template_2b4t0sg";

// DOM REFERENCES
const sosButton = document.getElementById('sosButton');
const sosSection = document.getElementById('sosSection');
const sosModal = document.getElementById('sosModal');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const progressModal = document.getElementById('progressModal');
const progressGPS = document.getElementById('progressGPS');
const progressSave = document.getElementById('progressSave');
const progressEmail = document.getElementById('progressEmail');
const progressWhatsApp = document.getElementById('progressWhatsApp');
const progressAudio = document.getElementById('progressAudio');
const progressNote = document.getElementById('progressNote');
const progressClose = document.getElementById('progressClose');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const contactCount = document.getElementById('contactCount');
const alertCount = document.getElementById('alertCount');
const locationStatus = document.getElementById('locationStatus');
const locationPreview = document.getElementById('locationPreview');
const locationCoords = document.getElementById('locationCoords');
const locationMapLink = document.getElementById('locationMapLink');
const lastAlertSection = document.getElementById('lastAlertSection');
const lastAlertTime = document.getElementById('lastAlertTime');
const lastAlertLink = document.getElementById('lastAlertLink');
const lastWhatsappStatus = document.getElementById('lastWhatsappStatus');
const lastEmailStatus = document.getElementById('lastEmailStatus');
const toastContainer = document.getElementById('toastContainer');
const safeSection = document.getElementById('safeSection');
const safeButton = document.getElementById('safeButton');
const voiceToggleBtn = document.getElementById('voiceToggleBtn');
const voiceToggleIcon = document.getElementById('voiceToggleIcon');
const voiceToggleText = document.getElementById('voiceToggleText');
const voiceHint = document.getElementById('voiceHint');
const voiceDot = document.getElementById('voiceDot');
const voiceLabel = document.getElementById('voiceLabel');

// GLOBAL STATE
let isAlarmActive = false;
let currentAlertDocId = null;
let alarmAudio = null;
let currentLatitude = null;
let currentLongitude = null;
let currentMapsLink = null;
let allContacts = [];
let voiceRecognition = null;
let isVoiceActive = false;
let fallbackInterval = null;
let fallbackAudioCtx = null;

// INIT EMAILJS
if (typeof emailjs !== 'undefined') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// AUTH READY - Load data when user logs in
window.addEventListener('authReady', async (e) => {
  const user = e.detail.user;
  await loadDashboardData(user);
  await fetchCurrentLocation();
  await loadAllContacts(user);
});

// FEATURE 1: GPS LOCATION - EXACT COORDINATES
async function fetchCurrentLocation() {
  if (!navigator.geolocation) {
    if (locationStatus) locationStatus.textContent = 'Not Supported';
    return;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      });
    });

    currentLatitude = position.coords.latitude;
    currentLongitude = position.coords.longitude;
    currentMapsLink = `https://www.google.com/maps?q=${currentLatitude},${currentLongitude}`;

    // Update status
    if (locationStatus) {
      locationStatus.textContent = 'Active';
      locationStatus.style.color = 'var(--accent-success)';
    }

    // Show preview
    if (locationPreview) locationPreview.classList.remove('hidden');
    if (locationCoords) {
      locationCoords.textContent = `Lat: ${currentLatitude.toFixed(6)}, Lng: ${currentLongitude.toFixed(6)}`;
    }
    if (locationMapLink) {
      locationMapLink.href = currentMapsLink;
    }

    console.log('📍 Location ready:', currentLatitude, currentLongitude);

  } catch (error) {
    console.error('GPS Error:', error);
    if (locationStatus) {
      locationStatus.textContent = error.code === 1 ? 'Denied' : 'Error';
      locationStatus.style.color = 'var(--accent-danger)';
    }
  }
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });
  });
}

// LOAD ALL CONTACTS FROM FIRESTORE
async function loadAllContacts(user) {
  try {
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'contacts'));
    allContacts = [];
    snapshot.forEach((d) => {
      allContacts.push({ id: d.id, ...d.data() });
    });
    console.log('👥 Loaded', allContacts.length, 'contacts');
  } catch (error) {
    console.error('Contact load error:', error);
  }
}

// FEATURE 2: I'M SAFE BUTTON - STOPS EVERYTHING
if (safeButton) {
  safeButton.addEventListener('click', async () => {
    console.log('🛡️ I AM SAFE pressed');

    // 1. Stop alarm sound
    stopAlarm();

    // 2. Reset UI to safe mode
    resetStatusSafe();

    // 3. Update Firestore alert status
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
          console.log('✅ Alert marked resolved');
        }
      } catch (error) {
        console.error('Firestore update error:', error);
      }
      currentAlertDocId = null;
    }

    // 4. Show confirmation
    showToast('🛡️ You are marked as SAFE. Alarm stopped.', 'success');

    // 5. Enable SOS button again
    if (sosButton) {
      sosButton.disabled = false;
      const sublabel = sosButton.querySelector('.sos-sublabel');
      if (sublabel) sublabel.textContent = 'Tap for Emergency';
    }
  });
}

// FEATURE 3: WHATSAPP MESSAGE + LOCATION
function sendWhatsAppToContacts(contacts, mapsLink, latitude, longitude) {
  const phoneContacts = contacts.filter(c => c.phone);
  if (phoneContacts.length === 0) {
    console.log('No contacts with phone for WhatsApp');
    return 0;
  }

  const message = encodeURIComponent(
    `🚨 *EMERGENCY SOS ALERT!*\n\n` +
    `I need help immediately!\n\n` +
    `📍 *My Exact Location:*\n` +
    `Latitude: ${latitude.toFixed(6)}\n` +
    `Longitude: ${longitude.toFixed(6)}\n\n` +
    `🗺️ *Click to see my location on Google Maps:*\n` +
    `${mapsLink}\n\n` +
    `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
    `Please respond IMMEDIATELY! 🆘`
  );

  let sentCount = 0;

  phoneContacts.forEach((contact, index) => {
    // Clean phone number
    let phone = contact.phone.replace(/[\s\-\(\)\+]/g, '');

    // Add India country code if 10 digit number
    if (phone.length === 10 && !phone.startsWith('91')) {
      phone = '91' + phone;
    }

    const whatsappUrl = `https://wa.me/${phone}?text=${message}`;

    // Open each with delay so browser doesn't block
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
      sentCount++;
      console.log(`💬 WhatsApp opened for ${contact.name} (${phone})`);
    }, index * 2000); // 2 second gap
  });

  return phoneContacts.length;
}

// FEATURE 4: VOICE TRIGGER - Say "HELP" / "EMERGENCY"

function initVoiceTrigger() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('Speech Recognition not supported in this browser');
    if (voiceToggleBtn) voiceToggleBtn.style.display = 'none';
    if (voiceHint) voiceHint.textContent = 'Voice trigger not supported in this browser';
    return;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = 'en-IN';
  voiceRecognition.maxAlternatives = 5;

  // Words that trigger SOS
  const TRIGGER_WORDS = [
    'help', 'help me', 'emergency', 'sos',
    'save me', 'danger', 'bachao', 'madad',
    'please help', 'i need help'
  ];

  voiceRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();
      console.log('🎤 Heard:', transcript);

      // Check for trigger words
      const triggered = TRIGGER_WORDS.some(word => transcript.includes(word));

      if (triggered && !isAlarmActive) {
        console.log('🚨 VOICE TRIGGER DETECTED!');
        showToast('🎤 Voice detected: "' + transcript + '" - Triggering SOS!', 'info');

        // Small delay then trigger SOS directly (no confirmation modal)
        setTimeout(() => {
          triggerSOSDirectly();
        }, 500);
        return;
      }
    }
  };

  voiceRecognition.onerror = (event) => {
    console.error('Speech error:', event.error);

    if (event.error === 'not-allowed') {
      showToast('🎤 Microphone permission denied. Allow microphone access.', 'error');
      stopVoiceTrigger();
      return;
    }

    // Auto restart on other errors
    if (isVoiceActive) {
      setTimeout(() => {
        try {
          if (isVoiceActive) voiceRecognition.start();
        } catch (e) { /* ignore */ }
      }, 1000);
    }
  };

  voiceRecognition.onend = () => {
    // Keep listening if voice trigger is ON
    if (isVoiceActive) {
      try {
        voiceRecognition.start();
      } catch (e) { /* ignore */ }
    }
  };

  console.log('🎤 Voice trigger initialized');
}

function startVoiceTrigger() {
  if (!voiceRecognition) initVoiceTrigger();
  if (!voiceRecognition) return;

  isVoiceActive = true;

  try {
    voiceRecognition.start();
  } catch (e) { /* already started */ }

  // Update UI
  if (voiceToggleIcon) voiceToggleIcon.textContent = '🔴';
  if (voiceToggleText) voiceToggleText.textContent = 'Voice Trigger ON - Listening...';
  if (voiceToggleBtn) voiceToggleBtn.classList.add('voice-active');
  if (voiceDot) voiceDot.classList.add('active');
  if (voiceLabel) voiceLabel.textContent = '🎤 ON';
  if (voiceHint) voiceHint.innerHTML = '🔴 Listening... Say <strong>"HELP"</strong> or <strong>"EMERGENCY"</strong>';

  showToast('🎤 Voice trigger ON - Say "HELP" to trigger SOS', 'success');
}

function stopVoiceTrigger() {
  isVoiceActive = false;

  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch (e) { /* ignore */ }
  }

  // Update UI
  if (voiceToggleIcon) voiceToggleIcon.textContent = '🎤';
  if (voiceToggleText) voiceToggleText.textContent = 'Enable Voice Trigger';
  if (voiceToggleBtn) voiceToggleBtn.classList.remove('voice-active');
  if (voiceDot) voiceDot.classList.remove('active');
  if (voiceLabel) voiceLabel.textContent = '🎤 OFF';
  if (voiceHint) voiceHint.innerHTML = 'Say <strong>"HELP"</strong> or <strong>"EMERGENCY"</strong> to trigger SOS';
}

// Voice toggle button click
if (voiceToggleBtn) {
  voiceToggleBtn.addEventListener('click', () => {
    if (isVoiceActive) {
      stopVoiceTrigger();
    } else {
      startVoiceTrigger();
    }
  });
}

// Initialize voice system
initVoiceTrigger();


// ALARM SOUND SYSTEM (MP3 + Fallback)

function startAlarm() {
  if (isAlarmActive) return;
  isAlarmActive = true;

  // Try MP3 first
  alarmAudio = document.getElementById('sosAlarmAudio');
  if (!alarmAudio) {
    alarmAudio = new Audio('/assets/audio/sos-alarm.mp3');
  }

  alarmAudio.loop = true;
  alarmAudio.volume = 1.0;
  alarmAudio.currentTime = 0;

  alarmAudio.play()
    .then(() => console.log('🔊 MP3 Alarm playing'))
    .catch(() => {
      console.log('🔊 MP3 failed, using fallback alarm');
      playFallbackAlarm();
    });

  // Show I'M SAFE button, hide SOS button
  if (safeSection) safeSection.classList.remove('hidden');
  if (sosSection) sosSection.classList.add('hidden');

  // Red flashing effects
  document.body.classList.add('alarm-active');

  console.log('🔊 Alarm STARTED');
}

function stopAlarm() {
  isAlarmActive = false;

  // Stop MP3
  if (alarmAudio) {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
    alarmAudio.loop = false;
  }

  // Stop fallback
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }

  // Show SOS button, hide I'M SAFE
  if (safeSection) safeSection.classList.add('hidden');
  if (sosSection) sosSection.classList.remove('hidden');

  // Remove red effects
  document.body.classList.remove('alarm-active');

  console.log('🔇 Alarm STOPPED');
}

function playFallbackAlarm() {
  try {
    fallbackAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.error('Web Audio not supported');
    return;
  }

  function beep() {
    if (!isAlarmActive) return;
    try {
      const osc = fallbackAudioCtx.createOscillator();
      const gain = fallbackAudioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, fallbackAudioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, fallbackAudioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.6, fallbackAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0, fallbackAudioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(fallbackAudioCtx.destination);
      osc.start();
      osc.stop(fallbackAudioCtx.currentTime + 0.5);
    } catch (e) { /* ignore */ }
  }

  beep();
  fallbackInterval = setInterval(beep, 800);
}

// EMAIL ALERTS (EmailJS)
// ═══════════════════════════════════════════════════════
async function sendEmailAlerts(user, mapsLink, latitude, longitude) {
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS not loaded');
    return 0;
  }

  const emailContacts = allContacts.filter(c => c.email);
  if (emailContacts.length === 0) return 0;

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const promises = [];

  emailContacts.forEach((contact) => {
    const params = {
      to_email: contact.email,
      contact_name: contact.name,
      user_name: user.displayName || 'SOS User',
      user_email: user.email,
      maps_link: mapsLink,
      timestamp: timestamp,
      message: `🚨 EMERGENCY! ${user.displayName || 'SOS User'} needs help!\n\n📍 Location: Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)}\n🗺️ Google Maps: ${mapsLink}\n\nPlease respond immediately!`
    };

    const p = emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then(() => console.log('✅ Email sent to', contact.name))
      .catch((err) => console.error('❌ Email failed to', contact.name, err));

    promises.push(p);
  });

  await Promise.all(promises);
  return emailContacts.length;
}

// SOS BUTTON CLICK → SHOW MODAL
// ═══════════════════════════════════════════════════════
if (sosButton) {
  sosButton.addEventListener('click', () => {
    if (sosModal) sosModal.classList.remove('hidden');
  });
}

if (modalCancel) {
  modalCancel.addEventListener('click', () => {
    if (sosModal) sosModal.classList.add('hidden');
  });
}

if (sosModal) {
  sosModal.addEventListener('click', (e) => {
    if (e.target === sosModal) sosModal.classList.add('hidden');
  });
}

if (progressClose) {
  progressClose.addEventListener('click', () => {
    if (progressModal) progressModal.classList.add('hidden');
  });
}

// Confirm button → trigger SOS
if (modalConfirm) {
  modalConfirm.addEventListener('click', () => {
    if (sosModal) sosModal.classList.add('hidden');
    triggerSOSDirectly();
  });
}

// MAIN SOS FUNCTION - TRIGGERS EVERYTHING
// Called from: Button confirm OR Voice trigger
// ═══════════════════════════════════════════════════════
async function triggerSOSDirectly() {
  const user = auth.currentUser;
  if (!user) {
    showToast('You must be logged in', 'error');
    return;
  }

  if (isAlarmActive) {
    showToast('Alert already active! Press I\'M SAFE first.', 'error');
    return;
  }

  // Show progress
  if (progressModal) progressModal.classList.remove('hidden');
  if (progressClose) progressClose.classList.add('hidden');
  resetProgress();

  let latitude, longitude, mapsLink;

  try {

    // ═══ STEP 1: GET EXACT GPS ═══
    updateProgress(progressGPS, 'loading', 'Capturing exact GPS location...');

    try {
      const position = await getGeolocation();
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
      mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

      currentLatitude = latitude;
      currentLongitude = longitude;
      currentMapsLink = mapsLink;

      updateProgress(progressGPS, 'done',
        `📍 Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
      );

      // Update preview
      if (locationCoords) locationCoords.textContent = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
      if (locationMapLink) locationMapLink.href = mapsLink;
      if (locationPreview) locationPreview.classList.remove('hidden');

    } catch (gpsError) {
      if (currentLatitude && currentLongitude) {
        latitude = currentLatitude;
        longitude = currentLongitude;
        mapsLink = currentMapsLink;
        updateProgress(progressGPS, 'done', '📍 Using last known location');
      } else {
        latitude = 0;
        longitude = 0;
        mapsLink = 'https://www.google.com/maps';
        updateProgress(progressGPS, 'error', '⚠️ GPS unavailable');
      }
    }

    // ═══ STEP 2: SAVE TO FIRESTORE ═══
    updateProgress(progressSave, 'loading', 'Saving to database...');

    const alertData = {
      timestamp: serverTimestamp(),
      latitude,
      longitude,
      mapsLink,
      status: 'active',
      emailSent: false,
      whatsappSent: false,
      alarmActive: true
    };

    const alertDoc = await addDoc(
      collection(db, 'users', user.uid, 'sos_history'),
      alertData
    );
    currentAlertDocId = alertDoc.id;
    updateProgress(progressSave, 'done', '✅ Saved to database');

    // ═══ STEP 3: SEND EMAILS ═══
    updateProgress(progressEmail, 'loading', 'Sending emails...');
    try {
      const emailCount = await sendEmailAlerts(user, mapsLink, latitude, longitude);
      if (emailCount > 0) {
        updateProgress(progressEmail, 'done', `✅ ${emailCount} email(s) sent`);
        await updateDoc(doc(db, 'users', user.uid, 'sos_history', currentAlertDocId), { emailSent: true });
      } else {
        updateProgress(progressEmail, 'error', '⚠️ No contacts with email');
      }
    } catch (emailErr) {
      console.error('Email error:', emailErr);
      updateProgress(progressEmail, 'error', '⚠️ Email failed');
    }

    // ═══ STEP 4: SEND WHATSAPP ═══
    updateProgress(progressWhatsApp, 'loading', 'Opening WhatsApp...');
    try {
      const waCount = sendWhatsAppToContacts(allContacts, mapsLink, latitude, longitude);
      if (waCount > 0) {
        updateProgress(progressWhatsApp, 'done', `✅ WhatsApp opening for ${waCount} contact(s)`);
        await updateDoc(doc(db, 'users', user.uid, 'sos_history', currentAlertDocId), { whatsappSent: true });
      } else {
        updateProgress(progressWhatsApp, 'error', '⚠️ No contacts with phone number');
      }
    } catch (waErr) {
      console.error('WhatsApp error:', waErr);
      updateProgress(progressWhatsApp, 'error', '⚠️ WhatsApp failed');
    }

    // ═══ STEP 5: START ALARM ═══
    updateProgress(progressAudio, 'loading', 'Starting alarm...');
    startAlarm();
    updateProgress(progressAudio, 'done', '🔊 Alarm ACTIVE');

    // Done!
    if (progressNote) progressNote.textContent = '🎉 All alerts sent! Press "I\'M SAFE" when safe.';
    if (progressClose) progressClose.classList.remove('hidden');

    updateStatusAlert();
    showToast('🚨 SOS sent! Press I\'M SAFE to stop alarm.', 'success');

    await loadDashboardData(user);

  } catch (error) {
    console.error('SOS Error:', error);
    if (progressNote) progressNote.textContent = '❌ Error: ' + error.message;
    if (progressClose) progressClose.classList.remove('hidden');
    showToast('SOS Error: ' + error.message, 'error');
  }
}

// DASHBOARD DATA LOADER
async function loadDashboardData(user) {
  try {
    // Contacts count
    const contactsSnap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
    if (contactCount) contactCount.textContent = contactsSnap.size;

    // Alerts count + last alert
    const historySnap = await getDocs(query(
      collection(db, 'users', user.uid, 'sos_history'),
      orderBy('timestamp', 'desc')
    ));
    if (alertCount) alertCount.textContent = historySnap.size;

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
      if (lastWhatsappStatus) lastWhatsappStatus.textContent = `WhatsApp: ${last.whatsappSent ? '✅' : '⏳'}`;
      if (lastEmailStatus) lastEmailStatus.textContent = `Email: ${last.emailSent ? '✅' : '⏳'}`;
    }
  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

// UI HELPER FUNCTIONS
function updateStatusAlert() {
  if (statusDot) { statusDot.classList.remove('safe'); statusDot.classList.add('alert'); }
  if (statusText) {
    statusText.textContent = '🚨 EMERGENCY ACTIVE - Press I\'M SAFE to stop';
    statusText.style.color = 'var(--accent-danger)';
  }
}

function resetStatusSafe() {
  if (statusDot) { statusDot.classList.remove('alert'); statusDot.classList.add('safe'); }
  if (statusText) { statusText.textContent = 'You are Safe'; statusText.style.color = ''; }
}

function updateProgress(el, status, text) {
  if (!el) return;
  const icon = el.querySelector('.progress-icon');
  const textEl = el.querySelector('.progress-text');
  el.classList.remove('done', 'error');

  if (status === 'loading' && icon) icon.textContent = '⏳';
  else if (status === 'done') { el.classList.add('done'); if (icon) icon.textContent = '✅'; }
  else if (status === 'error') { el.classList.add('error'); if (icon) icon.textContent = '❌'; }
  if (textEl) textEl.textContent = text;
}

function resetProgress() {
  [progressGPS, progressSave, progressEmail, progressWhatsApp, progressAudio].forEach(el => {
    if (el) { el.classList.remove('done', 'error'); const i = el.querySelector('.progress-icon'); if (i) i.textContent = '⏳'; }
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