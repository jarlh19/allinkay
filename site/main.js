// The live app runs on a free plan that sleeps when idle. Waking it while the visitor reads
// this page means it is usually ready by the time they open it.
const APP = "https://allinkay.onrender.com";
const status = document.getElementById("app-status");

async function wakeApp() {
  try {
    const response = await fetch(`${APP}/health`, { cache: "no-store" });
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
