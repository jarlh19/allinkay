// The live app runs on a free plan that sleeps when idle. Waking it while the visitor reads
// this page means it is usually ready by the time they open it.
const APP = "https://allinkay.onrender.com";
// Served by the app itself (under /site/), the page asks its own origin, as the app's security
// policy allows; served anywhere else (such as GitHub Pages), it asks the live app.
const HEALTH = window.location.pathname.startsWith("/site/") ? "/health" : `${APP}/health`;
const status = document.getElementById("app-status");

async function wakeApp() {
  try {
    const response = await fetch(HEALTH, { cache: "no-store" });
    if (response.ok && status) {
      status.textContent = "The live app is ready. It runs a simulated Mars mission: one second is one hour.";
      status.classList.add("ready");
    }
  } catch {
    // The app is still waking up or unreachable; the request alone is enough to wake it.
    if (status) status.textContent = "The live app is waking up; the first visit can take up to a minute.";
  }
}

wakeApp();
