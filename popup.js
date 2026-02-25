// --------------------
// Elements
// --------------------
const toggle = document.getElementById('toggleFocus');
const status = document.getElementById('status');
const siteInput = document.getElementById('siteInput');
const addBtn = document.getElementById('addBtn');
const listDiv = document.getElementById('list');
const durationInput = document.getElementById('duration');
const startTimerBtn = document.getElementById('startTimer');
const pauseTimerBtn = document.getElementById('pauseTimer');
const stopTimerBtn = document.getElementById('stopTimer');
const tempAllowBtn = document.getElementById('tempAllow');
const timerDiv = document.getElementById('timer');
const pinInput = document.getElementById('pinInput');
const setPinBtn = document.getElementById('setPin');
const schedStart = document.getElementById('schedStart');
const schedEnd = document.getElementById('schedEnd');
const dayCheckboxes = document.querySelectorAll('.day');
const saveScheduleBtn = document.getElementById('saveSchedule');
const clearScheduleBtn = document.getElementById('clearSchedule');
const blockedCountSpan = document.getElementById('blockedCount');
const resetStatsBtn = document.getElementById('resetStats');

// --------------------
// Timer UI Sync
// --------------------
function refreshTimerUI() {
  chrome.runtime.sendMessage({ action: "getTime" }, (res) => {
    if (!res || res.remaining == null) {
      timerDiv.textContent = "Not running";

      // sync focus toggle after timer ends
      chrome.storage.local.get(['focusOn'], d => {
        toggle.checked = !!d.focusOn;
        status.textContent = toggle.checked ? 'On' : 'Off';
      });
      return;
    }

    const r = res.remaining;
    const mm = String(Math.floor(r / 60)).padStart(2, '0');
    const ss = String(r % 60).padStart(2, '0');
    timerDiv.textContent = `${mm}:${ss}`;
  });
}

setInterval(refreshTimerUI, 1000);

// --------------------
// Timer Controls
// --------------------
startTimerBtn.addEventListener('click', () => {
  const mins = parseInt(durationInput.value) || 25;
  chrome.runtime.sendMessage(
    { action: "startTimer", minutes: mins },
    (res) => {
      if (res && res.status === 'started') {
        timerDiv.textContent =
          `${String(Math.floor(res.remaining / 60)).padStart(2, '0')}:00`;
      }
    }
  );
});


pauseTimerBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "pauseTimer" });
});

stopTimerBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "stopTimer" }, () => {
    timerDiv.textContent = "Not running";
  });
});

// --------------------
// Blocked Sites UI
// --------------------
function renderList(sites) {
  listDiv.innerHTML = '';
  (sites || []).forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <span>${s}</span>
      <div><button data-i="${i}" class="remove">Remove</button></div>
    `;
    listDiv.appendChild(el);
  });
}

function loadState() {
  chrome.storage.local.get(
    ['blockedSites','focusOn','pin','schedule','stats','timer'],
    data => {
      renderList(data.blockedSites || []);
      toggle.checked = !!data.focusOn;
      status.textContent = toggle.checked ? 'On' : 'Off';

      if (data.pin) pinInput.value = data.pin;

      if (data.schedule) {
        schedStart.value = data.schedule.start || '';
        schedEnd.value = data.schedule.end || '';
        const days = data.schedule.days || [];
        dayCheckboxes.forEach(cb =>
          cb.checked = days.includes(Number(cb.dataset.day))
        );
      }

      const stats = data.stats || { blockedAttempts: 0 };
      blockedCountSpan.textContent = stats.blockedAttempts || 0;

      if (data.timer && data.timer.remaining) {
        const r = data.timer.remaining;
        timerDiv.textContent =
          `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
      }
    }
  );
}

// --------------------
// Add / Remove Sites
// --------------------
addBtn.addEventListener('click', () => {
  const v = siteInput.value.trim();
  if (!v) return;

  chrome.storage.local.get(['blockedSites'], data => {
    const sites = data.blockedSites || [];
    if (!sites.includes(v)) sites.push(v);

    chrome.storage.local.set({ blockedSites: sites }, () => {
      renderList(sites);
      siteInput.value = '';
    });
  });
});

listDiv.addEventListener('click', e => {
  if (e.target.classList.contains('remove')) {
    const i = Number(e.target.dataset.i);
    chrome.storage.local.get(['blockedSites'], data => {
      const sites = data.blockedSites || [];
      sites.splice(i, 1);
      chrome.storage.local.set({ blockedSites: sites }, () => renderList(sites));
    });
  }
});

// --------------------
// Focus Toggle
// --------------------
toggle.addEventListener('change', () => {
  const on = toggle.checked;
  status.textContent = on ? 'On' : 'Off';

  chrome.storage.local.set({ focusOn: on }, () => {
    chrome.runtime.sendMessage({ action: "focusChanged" });
  });
});

// --------------------
// PIN / Temp Allow / Schedule
// --------------------
setPinBtn.addEventListener('click', () => {
  const p = pinInput.value.trim();
  if (p && /^[0-9]{4}$/.test(p)) {
    chrome.storage.local.set({ pin: p }, () => alert('PIN set'));
  } else if (!p) {
    chrome.storage.local.remove('pin', () => alert('PIN cleared'));
  } else {
    alert('Enter 4-digit PIN');
  }
});

tempAllowBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "tempAllow" }, res => {
    if (res && res.status === 'allowed') {
      alert('Allowed for 5 minutes');
    }
  });
});

saveScheduleBtn.addEventListener('click', () => {
  const start = schedStart.value;
  const end = schedEnd.value;
  const days = Array.from(dayCheckboxes)
    .filter(cb => cb.checked)
    .map(cb => Number(cb.dataset.day));

  chrome.storage.local.set({ schedule: { start, end, days } },
    () => alert('Schedule saved'));
});

clearScheduleBtn.addEventListener('click', () => {
  chrome.storage.local.remove('schedule', () => alert('Schedule cleared'));
});

resetStatsBtn.addEventListener('click', () => {
  chrome.storage.local.set(
    { stats: { blockedAttempts: 0 } },
    () => blockedCountSpan.textContent = '0'
  );
});

// --------------------
// INIT
// --------------------
loadState();
refreshTimerUI();
























