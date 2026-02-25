
const params = new URLSearchParams(location.search);
const from = params.get("from");

// Allow 5 minutes
document.getElementById("allow5").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "tempAllow" }, () => {
    if (from) {
      window.location.href = decodeURIComponent(from);
    }
  });
});

// Go back (EXIT blocked site)
document.getElementById("goBack").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://newtab" }, () => {
    window.close(); // close blocked tab
  });
});
