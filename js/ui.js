// Tiny shared UI helpers: toast messages and screen wake-lock (used by
// timers so the phone doesn't sleep mid-plank).

let toastTimer;
export function showToast(message) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

let wakeLockSentinel = null;

export async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
    }
  } catch (e) {
    // Not fatal — timer still works, screen just might sleep.
    console.warn("wake lock unavailable", e);
  }
}

export function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wakeLockSentinel) {
    // Re-acquire after tab/app came back to foreground, since the OS
    // releases the lock automatically when it's hidden.
    requestWakeLock();
  }
});

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
