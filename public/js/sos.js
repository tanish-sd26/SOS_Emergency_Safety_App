import { auth, db } from './firebase.js';
import { getCurrentUser } from './navigation.js';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';


const emailjsConfig = window.APP_CONFIG?.emailjs || {};
const EMAILJS_PUBLIC_KEY = emailjsConfig.publicKey || '';
const EMAILJS_SERVICE_ID = emailjsConfig.serviceId || '';
const EMAILJS_TEMPLATE_ID = emailjsConfig.templateId || '';

// ═══════════════════════════════════════
// DOM REFERENCES
// ═══════════════════════════════════════
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


// ═══════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════
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
let voiceRestartCount = 0;
const MAX_VOICE_RESTARTS = 3;

// ═══════════════════════════════════════
// INIT EMAILJS
// ═══════════════════════════════════════
try {
  if (typeof emailjs !== 'undefined') {
    if (EMAILJS_PUBLIC_KEY) {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      console.log('📧 EmailJS initialized');
    } else {
      console.warn('📧 EmailJS public key missing. Set EMAILJS_PUBLIC_KEY in your env config.');
    }
  } else {
    console.warn('📧 EmailJS not loaded - email alerts will not work');
  }
} catch (e) {
  console.warn('📧 EmailJS init error:', e);
}

// ═══════════════════════════════════════
// AUTH READY
// ═══════════════════════════════════════
window.addEventListener('authReady', async (e) => {
  const user = e.detail.user;
  await loadDashboardData(user);
  await fetchCurrentLocation();
  await loadAllContacts(user);
});

// ═══════════════════════════════════════════════════════
// GPS LOCATION - WITH FALLBACK FOR LAPTOP
// ═══════════════════════════════════════════════════════

async function fetchCurrentLocation() {
  if (!navigator.geolocation) {
    if (locationStatus) locationStatus.textContent = 'Not Supported';
    return;
  }

  try {
    // Try HIGH accuracy first (GPS - works on phone)
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    setLocation(position);
    console.log('📍 High accuracy GPS location obtained');

  } catch (highAccError) {
    console.log('📍 High accuracy failed, trying low accuracy...');

    try {
      // Try LOW accuracy (WiFi/IP based - works on laptop)
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        });
      });

      setLocation(position);
      console.log('📍 Low accuracy location obtained (WiFi/IP based)');

    } catch (lowAccError) {
      console.log('📍 Browser geolocation failed, trying IP-based location...');

      // FALLBACK: IP-based location (works everywhere)
      try {
        await fetchIPLocation();
      } catch (ipError) {
        console.error('📍 All location methods failed');
        if (locationStatus) {
          locationStatus.textContent = 'Unavailable';
          locationStatus.style.color = 'var(--accent-danger)';
        }
      }
    }
  }
}

function setLocation(position) {
  currentLatitude = position.coords.latitude;
  currentLongitude = position.coords.longitude;
  currentMapsLink = `https://www.google.com/maps?q=${currentLatitude},${currentLongitude}`;

  if (locationStatus) {
    locationStatus.textContent = 'Active';
    locationStatus.style.color = 'var(--accent-success)';
  }
  if (locationPreview) locationPreview.classList.remove('hidden');
  if (locationCoords) {
    locationCoords.textContent = `Lat: ${currentLatitude.toFixed(6)}, Lng: ${currentLongitude.toFixed(6)}`;
  }
  if (locationMapLink) locationMapLink.href = currentMapsLink;
}

// IP-based location fallback (free API, no key needed)
async function fetchIPLocation() {
  const response = await fetch('https://ipapi.co/json/');
  const data = await response.json();

  if (data.latitude && data.longitude) {
    currentLatitude = data.latitude;
    currentLongitude = data.longitude;
    currentMapsLink = `https://www.google.com/maps?q=${currentLatitude},${currentLongitude}`;

    if (locationStatus) {
      locationStatus.textContent = 'Approx';
      locationStatus.style.color = 'var(--accent-warning)';
    }
    if (locationPreview) locationPreview.classList.remove('hidden');
    if (locationCoords) {
      locationCoords.textContent = `Lat: ${currentLatitude.toFixed(4)}, Lng: ${currentLongitude.toFixed(4)} (Approximate)`;
    }
    if (locationMapLink) locationMapLink.href = currentMapsLink;

    console.log('📍 IP-based location:', currentLatitude, currentLongitude);
  }
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(resolve,
      () => {
        // If high accuracy fails, try low accuracy
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// ═══════════════════════════════════════
// LOAD CONTACTS
// ═══════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
// I'M SAFE BUTTON
// ═══════════════════════════════════════════════════════

if (safeButton) {
  safeButton.addEventListener('click', async () => {
    console.log('🛡️ I AM SAFE pressed');

    // 1. Stop alarm
    stopAlarm();

    // 2. Reset UI
    resetStatusSafe();

    // 3. Update Firestore
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
          console.log('✅ Alert resolved in Firestore');
        }
      } catch (error) {
        console.error('Firestore update error:', error);
        // Don't block - alarm already stopped
      }
      currentAlertDocId = null;
    }

    // 4. Toast
    showToast('🛡️ You are marked as SAFE. Alarm stopped.', 'success');

    // 5. Re-enable SOS
    if (sosButton) {
      sosButton.disabled = false;
      const sublabel = sosButton.querySelector('.sos-sublabel');
      if (sublabel) sublabel.textContent = 'Tap for Emergency';
    }
  });
}

// ═══════════════════════════════════════════════════════
// WHATSAPP MESSAGE + LOCATION
// ═══════════════════════════════════════════════════════

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
    `🗺️ *Click to open my location:*\n` +
    `${mapsLink}\n\n` +
    `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
    `Please respond IMMEDIATELY! 🆘`
  );

  phoneContacts.forEach((contact, index) => {
    let phone = contact.phone.replace(/[\s\-\(\)\+]/g, '');
    if (phone.length === 10 && !phone.startsWith('91')) {
      phone = '91' + phone;
    }

    const whatsappUrl = `https://wa.me/${phone}?text=${message}`;

    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
      console.log(`💬 WhatsApp opened for ${contact.name}`);
    }, index * 2000);
  });

  return phoneContacts.length;
}

// ═══════════════════════════════════════════════════════
// VOICE TRIGGER - FIXED FOR LAPTOP
// ═══════════════════════════════════════════════════════

function initVoiceTrigger() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('🎤 Speech Recognition not supported');
    if (voiceToggleBtn) {
      voiceToggleBtn.style.opacity = '0.5';
      voiceToggleText.textContent = 'Voice Not Supported';
    }
    if (voiceHint) voiceHint.textContent = 'Voice trigger not supported. Use Chrome or Edge browser.';
    return false;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = 'en-IN';
  voiceRecognition.maxAlternatives = 5;

  const TRIGGER_WORDS = [
    'help', 'help me', 'emergency', 'sos',
    'save me', 'danger', 'bachao', 'madad',
    'please help', 'i need help'
  ];

  voiceRecognition.onresult = (event) => {
    // Reset restart counter on successful result
    voiceRestartCount = 0;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();

      // Only log final results to reduce noise
      if (event.results[i].isFinal) {
        console.log('🎤 Heard (final):', transcript);
      }

      const triggered = TRIGGER_WORDS.some(word => transcript.includes(word));

      if (triggered && !isAlarmActive) {
        console.log('🚨 VOICE TRIGGER DETECTED!');
        showToast('🎤 Voice detected: "' + transcript + '" - Triggering SOS!', 'info');

        // Stop listening temporarily
        try { voiceRecognition.stop(); } catch (e) { /* ignore */ }

        setTimeout(() => {
          triggerSOSDirectly();
        }, 500);
        return;
      }
    }
  };

  voiceRecognition.onerror = (event) => {
    // Handle different error types
    switch (event.error) {
      case 'not-allowed':
        console.error('🎤 Microphone permission DENIED');
        showToast('🎤 Microphone blocked! Allow microphone in browser settings.', 'error');
        stopVoiceTrigger();
        break;

      case 'audio-capture':
        // This means no microphone found OR mic is busy
        console.warn('🎤 audio-capture error - mic may be unavailable');
        voiceRestartCount++;

        if (voiceRestartCount >= MAX_VOICE_RESTARTS) {
          console.error('🎤 Too many mic errors. Stopping voice trigger.');
          showToast('🎤 Microphone not available. Check mic settings.', 'error');
          stopVoiceTrigger();
        } else if (isVoiceActive) {
          // Retry after delay
          setTimeout(() => {
            if (isVoiceActive) {
              try { voiceRecognition.start(); } catch (e) { /* ignore */ }
            }
          }, 3000);
        }
        break;

      case 'no-speech':
        // No speech detected - this is normal, just restart
        if (isVoiceActive) {
          try { voiceRecognition.start(); } catch (e) { /* ignore */ }
        }
        break;

      case 'network':
        console.warn('🎤 Network error in speech recognition');
        if (isVoiceActive) {
          setTimeout(() => {
            if (isVoiceActive) {
              try { voiceRecognition.start(); } catch (e) { /* ignore */ }
            }
          }, 5000);
        }
        break;

      default:
        console.warn('🎤 Speech error:', event.error);
        if (isVoiceActive) {
          setTimeout(() => {
            if (isVoiceActive) {
              try { voiceRecognition.start(); } catch (e) { /* ignore */ }
            }
          }, 2000);
        }
    }
  };

  voiceRecognition.onend = () => {
    if (isVoiceActive) {
      // Small delay before restart to prevent rapid cycling
      setTimeout(() => {
        if (isVoiceActive) {
          try { voiceRecognition.start(); } catch (e) { /* ignore */ }
        }
      }, 500);
    }
  };

  console.log('🎤 Voice trigger initialized');
  return true;
}

async function startVoiceTrigger() {
  if (!voiceRecognition) {
    const success = initVoiceTrigger();
    if (!success) {
      showToast('🎤 Voice trigger not available in this browser', 'error');
      return;
    }
  }

  // Reset restart counter
  voiceRestartCount = 0;
  isVoiceActive = true;

  // Request microphone permission explicitly first
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Got permission! Stop the test stream
    stream.getTracks().forEach(track => track.stop());
    console.log('🎤 Microphone permission granted');
  } catch (micError) {
    console.error('🎤 Microphone permission denied:', micError);
    showToast('🎤 Microphone access denied. Please allow microphone in browser settings.', 'error');
    isVoiceActive = false;
    return;
  }

  // Now start recognition
  try {
    voiceRecognition.start();
  } catch (e) {
    console.warn('🎤 Start error (may already be running):', e);
  }

  // Update UI
  if (voiceToggleIcon) voiceToggleIcon.textContent = '🔴';
  if (voiceToggleText) voiceToggleText.textContent = 'Voice Trigger ON';
  if (voiceToggleBtn) voiceToggleBtn.classList.add('voice-active');
  if (voiceDot) voiceDot.classList.add('active');
  if (voiceLabel) voiceLabel.textContent = '🎤 ON';
  if (voiceHint) voiceHint.innerHTML = '🔴 Listening... Say <strong>"HELP"</strong> or <strong>"EMERGENCY"</strong>';

  showToast('🎤 Voice trigger ON - Say "HELP" to trigger SOS', 'success');
}

function stopVoiceTrigger() {
  isVoiceActive = false;
  voiceRestartCount = 0;

  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch (e) { /* ignore */ }
  }

  if (voiceToggleIcon) voiceToggleIcon.textContent = '🎤';
  if (voiceToggleText) voiceToggleText.textContent = 'Enable Voice Trigger';
  if (voiceToggleBtn) voiceToggleBtn.classList.remove('voice-active');
  if (voiceDot) voiceDot.classList.remove('active');
  if (voiceLabel) voiceLabel.textContent = '🎤 OFF';
  if (voiceHint) voiceHint.innerHTML = 'Say <strong>"HELP"</strong> or <strong>"EMERGENCY"</strong> to trigger SOS';
}

// Voice toggle button
if (voiceToggleBtn) {
  voiceToggleBtn.addEventListener('click', () => {
    if (isVoiceActive) {
      stopVoiceTrigger();
    } else {
      startVoiceTrigger();
    }
  });
}

// ═══════════════════════════════════════════════════════
// ALARM SOUND (MP3 + Fallback)
// ═══════════════════════════════════════════════════════

function startAlarm() {
  if (isAlarmActive) return;
  isAlarmActive = true;

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
      console.log('🔊 MP3 failed, using fallback');
      playFallbackAlarm();
    });

  if (safeSection) safeSection.classList.remove('hidden');
  if (sosSection) sosSection.classList.add('hidden');
  document.body.classList.add('alarm-active');
  console.log('🔊 Alarm STARTED');
}

function stopAlarm() {
  isAlarmActive = false;

  if (alarmAudio) {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
    alarmAudio.loop = false;
  }

  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }

  if (safeSection) safeSection.classList.add('hidden');
  if (sosSection) sosSection.classList.remove('hidden');
  document.body.classList.remove('alarm-active');
  console.log('🔇 Alarm STOPPED');
}

function playFallbackAlarm() {
  try {
    fallbackAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }

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

// ═══════════════════════════════════════════════════════
// EMAIL ALERTS
// ═══════════════════════════════════════════════════════

async function sendEmailAlerts(user, mapsLink, latitude, longitude) {
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS not available');
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
      message: `🚨 EMERGENCY! ${user.displayName || 'SOS User'} needs help!\n📍 Location: Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)}\n🗺️ Google Maps: ${mapsLink}\nPlease respond immediately!`
    };

    const p = emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then(() => console.log('✅ Email sent to', contact.name))
      .catch((err) => console.error('❌ Email failed to', contact.name, err));

    promises.push(p);
  });

  await Promise.all(promises);
  return emailContacts.length;
}

// ═══════════════════════════════════════════════════════
// SOS BUTTON HANDLERS
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
if (modalConfirm) {
  modalConfirm.addEventListener('click', () => {
    if (sosModal) sosModal.classList.add('hidden');
    triggerSOSDirectly();
  });
}

// ═══════════════════════════════════════════════════════
// MAIN SOS FUNCTION
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

  if (progressModal) progressModal.classList.remove('hidden');
  if (progressClose) progressClose.classList.add('hidden');
  resetProgress();

  let latitude, longitude, mapsLink;

  try {
    // ═══ STEP 1: GPS ═══
    updateProgress(progressGPS, 'loading', 'Capturing GPS location...');

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

      if (locationCoords) locationCoords.textContent = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
      if (locationMapLink) locationMapLink.href = mapsLink;
      if (locationPreview) locationPreview.classList.remove('hidden');

    } catch (gpsError) {
      // Use saved location or IP location
      if (currentLatitude && currentLongitude) {
        latitude = currentLatitude;
        longitude = currentLongitude;
        mapsLink = currentMapsLink;
        updateProgress(progressGPS, 'done', '📍 Using previously captured location');
      } else {
        // Last resort: try IP location
        try {
          await fetchIPLocation();
          latitude = currentLatitude;
          longitude = currentLongitude;
          mapsLink = currentMapsLink;
          updateProgress(progressGPS, 'done', '📍 Using approximate IP location');
        } catch (e) {
          latitude = 0;
          longitude = 0;
          mapsLink = 'https://www.google.com/maps';
          updateProgress(progressGPS, 'error', '⚠️ Location unavailable');
        }
      }
    }

    // ═══ STEP 2: SAVE TO FIRESTORE ═══
    updateProgress(progressSave, 'loading', 'Saving to database...');

    const alertDoc = await addDoc(
      collection(db, 'users', user.uid, 'sos_history'),
      {
        timestamp: serverTimestamp(),
        latitude,
        longitude,
        mapsLink,
        status: 'active',
        emailSent: false,
        whatsappSent: false,
        alarmActive: true
      }
    );
    currentAlertDocId = alertDoc.id;
    updateProgress(progressSave, 'done', '✅ Saved to database');

    // ═══ STEP 3: EMAIL ═══
    updateProgress(progressEmail, 'loading', 'Sending emails...');
    try {
      const emailCount = await sendEmailAlerts(user, mapsLink, latitude, longitude);
      if (emailCount > 0) {
        updateProgress(progressEmail, 'done', `✅ ${emailCount} email(s) sent`);
        // Update Firestore (don't await - non-blocking)
        updateDoc(doc(db, 'users', user.uid, 'sos_history', currentAlertDocId), { emailSent: true }).catch(e => console.warn('Email status update failed:', e));
      } else {
        updateProgress(progressEmail, 'error', '⚠️ No contacts with email');
      }
    } catch (emailErr) {
      updateProgress(progressEmail, 'error', '⚠️ Email failed');
    }

    // ═══ STEP 4: WHATSAPP ═══
    updateProgress(progressWhatsApp, 'loading', 'Opening WhatsApp...');
    try {
      const waCount = sendWhatsAppToContacts(allContacts, mapsLink, latitude, longitude);
      if (waCount > 0) {
        updateProgress(progressWhatsApp, 'done', `✅ WhatsApp opening for ${waCount} contact(s)`);
        updateDoc(doc(db, 'users', user.uid, 'sos_history', currentAlertDocId), { whatsappSent: true }).catch(e => console.warn('WA status update failed:', e));
      } else {
        updateProgress(progressWhatsApp, 'error', '⚠️ No contacts with phone');
      }
    } catch (waErr) {
      updateProgress(progressWhatsApp, 'error', '⚠️ WhatsApp failed');
    }

    // ═══ STEP 5: ALARM ═══
    updateProgress(progressAudio, 'loading', 'Starting alarm...');
    startAlarm();
    updateProgress(progressAudio, 'done', '🔊 Alarm ACTIVE');

    if (progressNote) progressNote.textContent = '🎉 All alerts sent! Press "I\'M SAFE" when safe.';
    if (progressClose) progressClose.classList.remove('hidden');

    updateStatusAlert();
    showToast('🚨 SOS sent! Press I\'M SAFE to stop.', 'success');

    await loadDashboardData(user);

  } catch (error) {
    console.error('SOS Error:', error);
    if (progressNote) progressNote.textContent = '❌ Error: ' + error.message;
    if (progressClose) progressClose.classList.remove('hidden');
    showToast('Error: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════
// DASHBOARD DATA
// ═══════════════════════════════════════════════════════

async function loadDashboardData(user) {
  try {
    const contactsSnap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
    if (contactCount) contactCount.textContent = contactsSnap.size;

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

// ═══════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════

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