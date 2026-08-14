import { getProfile, saveProfile, exportBackup, importBackup } from "./storage.js";
import { ageFromDOB, daysUntilBirthday, escapeHtml } from "./util.js";
import { showToast } from "./ui.js";

// Sensible defaults so the first-run form isn't blank — edit freely.
const DEFAULTS = {
  dobISO: "1963-08-27",
  sex: "male",
  heightCm: 180,
};

export function hasProfile() {
  return !!getProfile();
}

export function currentProfile() {
  return getProfile() || { ...DEFAULTS };
}

export function currentAge() {
  const p = currentProfile();
  return p.dobISO ? ageFromDOB(p.dobISO) : null;
}

export function renderSetupModal(onDone) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <h2>Welcome — quick setup</h2>
      <p class="subtitle">A few details tailor your targets and reference ranges. Everything stays on this device; edit anytime from Profile.</p>
      <form id="setup-form">
        <div class="form-grid" style="margin-bottom:0.8rem;">
          <div class="field">
            <label for="setup-dob">Date of birth</label>
            <input type="date" id="setup-dob" value="${DEFAULTS.dobISO}" required />
          </div>
          <div class="field">
            <label for="setup-sex">Sex</label>
            <select id="setup-sex">
              <option value="male" selected>Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div class="field">
            <label for="setup-height">Height (cm)</label>
            <input type="number" id="setup-height" min="100" max="230" step="0.5" value="${DEFAULTS.heightCm}" required />
          </div>
        </div>
        <div class="btn-row">
          <button type="submit" class="btn btn-primary">Start tracking</button>
        </div>
      </form>
      <p class="disclaimer" style="margin-top:1rem;">This app is a personal tracker, not medical advice. Reference ranges are general guidelines — talk to your doctor about targets that make sense for you, especially before starting a new exercise routine.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const profile = {
      dobISO: overlay.querySelector("#setup-dob").value,
      sex: overlay.querySelector("#setup-sex").value,
      heightCm: parseFloat(overlay.querySelector("#setup-height").value),
    };
    saveProfile(profile);
    overlay.remove();
    onDone(profile);
  });
}

export function renderProfileView(container) {
  const p = currentProfile();
  const age = p.dobISO ? ageFromDOB(p.dobISO) : null;
  const daysToBday = p.dobISO ? daysUntilBirthday(p.dobISO) : null;

  container.innerHTML = `
    <div class="view-header">
      <h2>Profile &amp; settings</h2>
      <p class="subtitle">${age != null ? `${age} years old${daysToBday != null ? ` · birthday in ${daysToBday} day${daysToBday === 1 ? "" : "s"}` : ""}` : ""}</p>
    </div>

    <div class="card">
      <h3>Your details</h3>
      <form id="profile-form">
        <div class="form-grid" style="margin-bottom:0.8rem;">
          <div class="field">
            <label for="p-dob">Date of birth</label>
            <input type="date" id="p-dob" value="${p.dobISO || ""}" required />
          </div>
          <div class="field">
            <label for="p-sex">Sex</label>
            <select id="p-sex">
              <option value="male" ${p.sex === "male" ? "selected" : ""}>Male</option>
              <option value="female" ${p.sex === "female" ? "selected" : ""}>Female</option>
            </select>
          </div>
          <div class="field">
            <label for="p-height">Height (cm)</label>
            <input type="number" id="p-height" min="100" max="230" step="0.5" value="${p.heightCm || ""}" required />
          </div>
        </div>
        <div class="btn-row">
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h3>Backup &amp; restore</h3>
      <p style="font-size:0.85rem; color:var(--text-dim); margin:0 0 0.7rem;">
        All your data lives only in this browser (localStorage) — nothing is sent to a server. Export a backup file periodically, or before clearing browser data.
      </p>
      <div class="btn-row" style="margin-top:0;">
        <button id="btn-export" class="btn">⬇ Export backup (JSON)</button>
        <label class="btn" style="margin:0;">
          ⬆ Import backup
          <input type="file" id="import-file" accept="application/json" style="display:none;" />
        </label>
        <button id="btn-clear" class="btn btn-danger-outline">Clear all data</button>
      </div>
    </div>

    <p class="disclaimer">
      Health Tracker is a personal tool for logging your own numbers and general, evidence-informed reference ranges. It is not medical advice, diagnosis, or treatment, and it isn't a substitute for care from a qualified clinician. If you ever have chest pain, severe shortness of breath, fainting, or other concerning symptoms, seek medical care right away.
    </p>
  `;

  container.querySelector("#profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    saveProfile({
      dobISO: container.querySelector("#p-dob").value,
      sex: container.querySelector("#p-sex").value,
      heightCm: parseFloat(container.querySelector("#p-height").value),
    });
    showToast("Profile saved");
  });

  container.querySelector("#btn-export").addEventListener("click", () => {
    const data = exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importBackup(data);
      showToast("Backup imported — reloading…");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      alert("Could not read that file: " + err.message);
    }
  });

  container.querySelector("#btn-clear").addEventListener("click", () => {
    if (confirm("This deletes all logged data on this device permanently. Export a backup first if you want to keep it. Continue?")) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("healthtracker."))
        .forEach((k) => localStorage.removeItem(k));
      location.reload();
    }
  });
}
