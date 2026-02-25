// ================================
// CONSTANTS
// ================================
const ALARM_TICK = "focus-tick";
const ALARM_TEMP_ALLOW = "temp-allow-expire";

// ================================
// HELPERS
// ================================
const now = () => Date.now();

function get(keys) {
  return new Promise(res => chrome.storage.local.get(keys, res));
}

function set(obj) {
  return new Promise(res => chrome.storage.local.set(obj, res));
}

function host(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isBlockedUrl(url, blockedSites = []) {
  const h = host(url);
  if (!h) return false;
  return blockedSites.some(site => h.includes(site));
}

function isBlockPage(url) {
  return url?.startsWith(chrome.runtime.getURL("block.html"));
}

// ================================
// BLOCK CHECK
// ================================
async function checkAndBlock(tabId, url) {
  if (!url || isBlockPage(url)) return;

  const { focusOn, blockedSites, tempAllowUntil } =
    await get(["focusOn", "blockedSites", "tempAllowUntil"]);

  if (!focusOn) return;
  if (tempAllowUntil && now() < tempAllowUntil) return;

  if (isBlockedUrl(url, blockedSites)) {
    chrome.tabs.update(tabId, {
      url:
        chrome.runtime.getURL("block.html") +
        "?from=" +
        encodeURIComponent(url)
    });
  }
}

function recheckAllTabs() {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(t => {
      if (t.id && t.url) checkAndBlock(t.id, t.url);
    });
  });
}

// ================================
// TIMER CONTROL PER TAB
// ================================
async function handleTab(tab) {
  if (!tab?.url) return;

  const { blockedSites, timer, activeBlockedTab } =
    await get(["blockedSites", "timer", "activeBlockedTab"]);

  const onBlockedSite = isBlockedUrl(tab.url, blockedSites);

  // ▶ Enter blocked site → start timer
  if (onBlockedSite && timer?.running && !activeBlockedTab) {
    chrome.alarms.create(ALARM_TICK, { periodInMinutes: 1 / 60 });
    await set({ activeBlockedTab: true });
  }

  // ⏸ Leave blocked site → pause timer
  if (!onBlockedSite && activeBlockedTab) {
    chrome.alarms.clear(ALARM_TICK);
    await set({ activeBlockedTab: false });
  }
}

// ================================
// TAB LISTENERS
// ================================
chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (info.status === "complete" || info.url) {
    handleTab(tab);
    checkAndBlock(id, tab.url);
  }
});

chrome.tabs.onActivated.addListener(info => {
  chrome.tabs.get(info.tabId, tab => {
    if (tab) {
      handleTab(tab);
      checkAndBlock(tab.id, tab.url);
    }
  });
});

// ================================
// ALARMS
// ================================
chrome.alarms.onAlarm.addListener(async alarm => {

  // ⏱ Focus timer tick
  if (alarm.name === ALARM_TICK) {
    const { timer, activeBlockedTab } =
      await get(["timer", "activeBlockedTab"]);

    if (!timer?.running || !activeBlockedTab) return;

    const remaining = timer.remaining - 1;

    if (remaining <= 0) {
      chrome.alarms.clear(ALARM_TICK);
      await set({
        timer: null,
        focusOn: true,
        activeBlockedTab: false
      });
      recheckAllTabs(); // 🔥 BLOCK NOW
    } else {
      await set({
        timer: { remaining, running: true }
      });
    }
  }

  // ⏳ TEMP ALLOW EXPIRED
  if (alarm.name === ALARM_TEMP_ALLOW) {
    await set({ tempAllowUntil: null });
    recheckAllTabs();
  }
});

// ================================
// MESSAGES
// ================================
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {

  // ▶ SET TIMER (does NOT start yet)
  if (msg.action === "startTimer") {
    const sec = (Number(msg.minutes) || 1) * 60;

    set({
      timer: { remaining: sec, running: true },
      focusOn: false,
      activeBlockedTab: false
    }).then(() => {
      sendResponse({ status: "started", remaining: sec });
    });

    return true;
  }

  // ⏹ STOP
  if (msg.action === "stopTimer") {
    chrome.alarms.clear(ALARM_TICK);
    set({
      timer: null,
      focusOn: false,
      activeBlockedTab: false
    }).then(() => sendResponse({ status: "stopped" }));
    return true;
  }

  // ⏱ GET TIME
  if (msg.action === "getTime") {
    get(["timer"]).then(d => {
      sendResponse({ remaining: d.timer?.remaining ?? null });
    });
    return true;
  }

  // ⏳ ALLOW 5 MIN
  if (msg.action === "tempAllow") {
    const until = now() + 5 * 60 * 1000;

    set({ tempAllowUntil: until }).then(() => {
      chrome.alarms.create(ALARM_TEMP_ALLOW, { when: until });
      sendResponse({ status: "allowed" });
    });
    return true;
  }

  // 🔁 MANUAL TOGGLE
  if (msg.action === "focusChanged") {
    recheckAllTabs();
  }
});




// ----------------------------------------------------------------------------------------------------------------------------------------
