import { hasProfile, renderSetupModal, renderProfileView } from "./profile.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeightView } from "./weight.js";
import { renderVitalsView } from "./vitals.js";
import { renderActivityView } from "./activity.js";
import { renderExercisesView } from "./exercises.js";
import { renderHeartRateView } from "./heartrate.js";
import { renderScreeningsView } from "./screenings.js";

const BUILD_TIME = "2026-08-14";

const TABS = [
  { id: "today", label: "Today", icon: "🏠", render: (el) => renderDashboard(el, goToTab) },
  { id: "weight", label: "Weight", icon: "⚖️", render: renderWeightView },
  { id: "vitals", label: "Vitals", icon: "🩺", render: renderVitalsView },
  { id: "activity", label: "Activity", icon: "🚶", render: renderActivityView },
  { id: "exercises", label: "Exercises", icon: "💪", render: renderExercisesView },
  { id: "heartrate", label: "Heart Rate", icon: "❤️", render: renderHeartRateView },
  { id: "screenings", label: "Screenings", icon: "✅", render: renderScreeningsView },
  { id: "profile", label: "Profile", icon: "⚙️", render: renderProfileView },
];

const tabbar = document.getElementById("tabbar");
const viewRoot = document.getElementById("view-root");

let activeTab = localStorage.getItem("healthtracker.activeTab") || "today";
if (!TABS.some((t) => t.id === activeTab)) activeTab = "today";

function goToTab(id) {
  activeTab = id;
  localStorage.setItem("healthtracker.activeTab", id);
  render();
}

function render() {
  tabbar.innerHTML = TABS.map(
    (t) => `<button class="tab-btn ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}">${t.icon} ${t.label}</button>`
  ).join("");
  tabbar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToTab(btn.dataset.tab));
  });

  const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
  viewRoot.innerHTML = "";
  tab.render(viewRoot);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

document.getElementById("btn-profile").addEventListener("click", () => goToTab("profile"));

function boot() {
  if (!hasProfile()) {
    renderSetupModal(() => render());
  } else {
    render();
  }
}

boot();

// ---- Footer build info + service worker status ----
document.getElementById("build-time").textContent = BUILD_TIME;

const swStatusEl = document.getElementById("sw-status");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(() => {
      swStatusEl.textContent = "offline-ready";
    })
    .catch(() => {
      swStatusEl.textContent = "offline mode unavailable";
    });
} else {
  swStatusEl.textContent = "offline mode unsupported in this browser";
}
