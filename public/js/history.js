import { auth, db } from './firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const historyList = document.getElementById('historyList');
const emptyHistory = document.getElementById('emptyHistory');
const totalAlerts = document.getElementById('totalAlerts');
const monthAlerts = document.getElementById('monthAlerts');
const toastContainer = document.getElementById('toastContainer');

window.addEventListener('authReady', async (e) => { await loadHistory(e.detail.user); });

async function loadHistory(user) {
  if (!historyList) return;
  try {
    const snap = await getDocs(query(collection(db, 'users', user.uid, 'sos_history'), orderBy('timestamp', 'desc')));
    historyList.innerHTML = '';

    if (snap.empty) {
      if (emptyHistory) emptyHistory.classList.remove('hidden');
      if (totalAlerts) totalAlerts.textContent = '0';
      if (monthAlerts) monthAlerts.textContent = '0';
      return;
    }

    if (emptyHistory) emptyHistory.classList.add('hidden');
    let total = 0, thisMonth = 0;
    const now = new Date();

    snap.forEach((d) => {
      const data = d.data();
      total++;
      if (data.timestamp) {
        const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) thisMonth++;
      }
      historyList.appendChild(createHistoryItem(data));
    });

    if (totalAlerts) totalAlerts.textContent = total;
    if (monthAlerts) monthAlerts.textContent = thisMonth;
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to load history', 'error');
  }
}

function createHistoryItem(data) {
  const item = document.createElement('div');
  item.className = 'history-item';

  let dateStr = '--', timeStr = '--';
  if (data.timestamp) {
    const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
    dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  const smsOk = data.smsSent || (data.smsResults && data.smsResults.success > 0);
  const callOk = data.callSent || (data.callResults && data.callResults.success > 0);
  const emailOk = data.emailSent;

  item.innerHTML = `
    <div class="history-top">
      <div>
        <span class="history-date">${dateStr}</span>
        <span class="history-time">${timeStr}</span>
      </div>
      <a href="${esc(data.mapsLink || '#')}" target="_blank" rel="noopener noreferrer" class="history-link">📍 View Map</a>
    </div>
    <div class="history-bottom">
      <span class="history-status sent">SOS SENT</span>
      <span class="history-status ${smsOk ? 'sms-ok' : 'failed'}">SMS: ${smsOk ? '✅' : '⏳'}</span>
      <span class="history-status ${callOk ? 'call-ok' : 'failed'}">Call: ${callOk ? '✅' : '⏳'}</span>
      <span class="history-status ${emailOk ? 'email-ok' : 'failed'}">Email: ${emailOk ? '✅' : '⏳'}</span>
    </div>
  `;
  return item;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showToast(msg, type = 'info') {
  if (!toastContainer) return;
  const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg;
  toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4000);
}