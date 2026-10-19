import { getWeightLog, addWeightEntry, deleteWeightEntry, saveProfile } from "./storage.js";
import { currentProfile } from "./profile.js";
import { bmi, bmiCategory, round, todayISO, formatDateShort, escapeHtml, daysBetween, kgToLbs, lbsToKg } from "./util.js";
import { renderLineChart } from "./charts.js";
import { showToast } from "./ui.js";

const UNIT_LIMITS = {
  kg: { min: 30, max: 300, step: 0.1, placeholder: "e.g. 84.5" },
  lbs: { min: 66, max: 660, step: 0.5, placeholder: "e.g. 186" },
};

export function renderWeightView(container) {
  const profile = currentProfile();
  const log = getWeightLog(); // newest first
  let unit = profile.weightUnit === "lbs" ? "lbs" : "kg";

  container.innerHTML = `
    <div class="view-header">
      <h2>Weight &amp; BMI</h2>
      <p class="subtitle">${profile.heightCm ? `Height on file: ${profile.heightCm} cm` : `Set your height in Profile to see BMI`}</p>
    </div>

    <div class="card">
      <h3>Log a weigh-in</h3>
      <form id="weight-form">
        <div class="form-grid">
          <div class="field">
            <label for="w-date">Date</label>
            <input type="date" id="w-date" value="${todayISO()}" max="${todayISO()}" required />
          </div>
          <div class="field" style="max-width:100px;">
            <label for="w-unit">Unit</label>
            <select id="w-unit">
              <option value="kg" ${unit === "kg" ? "selected" : ""}>kg</option>
              <option value="lbs" ${unit === "lbs" ? "selected" : ""}>lbs</option>
            </select>
          </div>
          <div class="field">
            <label for="w-weight" id="w-weight-label">Weight (${unit})</label>
            <input type="number" id="w-weight" min="${UNIT_LIMITS[unit].min}" max="${UNIT_LIMITS[unit].max}" step="${UNIT_LIMITS[unit].step}" placeholder="${UNIT_LIMITS[unit].placeholder}" required />
          </div>
          <div class="field" style="flex:2; min-width:200px;">
            <label for="w-note">Note (optional)</label>
            <input type="text" id="w-note" placeholder="e.g. after workout" />
          </div>
          <div class="field" style="min-width:auto;">
            <button type="submit" class="btn btn-primary">Add</button>
          </div>
        </div>
        <p class="field hint" style="margin-top:0.5rem;">Switching units here also changes how weights are displayed throughout the app — it's remembered for next time.</p>
      </form>
    </div>

    <div class="card-row">
      <div class="card" id="weight-summary-card">
        <h3>Current</h3>
        <div id="weight-summary"></div>
      </div>
    </div>

    <div class="card">
      <h3>Trend (all time)</h3>
      <div id="weight-chart"></div>
    </div>

    <div class="card">
      <h3>History</h3>
      <ul class="log-list" id="weight-log-list"></ul>
    </div>
  `;

  // Weight is always stored in kg; these two just convert for display in
  // whichever unit is currently selected.
  function displayValue(kg) {
    return unit === "lbs" ? round(kgToLbs(kg), 1) : round(kg, 1);
  }
  function displayDelta(deltaKg) {
    return unit === "lbs" ? round(kgToLbs(deltaKg), 1) : round(deltaKg, 1);
  }

  function refresh() {
    const log = getWeightLog();
    renderSummary(log, profile);
    renderChart(log);
    renderList(log);
  }

  function renderSummary(log, profile) {
    const el = container.querySelector("#weight-summary");
    if (!log.length) {
      el.innerHTML = `<p class="log-empty">No weigh-ins yet.</p>`;
      return;
    }
    const latest = log[0];
    const bmiValue = bmi(latest.kg, profile.heightCm);
    const cat = bmiCategory(bmiValue);
    const weekAgo = log.find((e) => daysBetween(e.dateISO, latest.dateISO) >= 7);
    const monthAgo = log.find((e) => daysBetween(e.dateISO, latest.dateISO) >= 30);
    const delta7 = weekAgo ? displayDelta(latest.kg - weekAgo.kg) : null;
    const delta30 = monthAgo ? displayDelta(latest.kg - monthAgo.kg) : null;

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="stat-label">Latest</div>
          <div class="stat-value">${displayValue(latest.kg)}<span class="unit">${unit}</span></div>
          <div class="stat-sub">${formatDateShort(latest.dateISO)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">BMI</div>
          <div class="stat-value">${bmiValue ? round(bmiValue, 1) : "—"}</div>
          ${cat ? `<div class="stat-sub"><span class="badge badge-${cat.tone}">${cat.label}</span></div>` : `<div class="stat-sub">Add height in Profile</div>`}
        </div>
        <div class="stat-tile">
          <div class="stat-label">7-day change</div>
          <div class="stat-value">${delta7 != null ? `${delta7 > 0 ? "+" : ""}${delta7}<span class="unit">${unit}</span>` : "—"}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">30-day change</div>
          <div class="stat-value">${delta30 != null ? `${delta30 > 0 ? "+" : ""}${delta30}<span class="unit">${unit}</span>` : "—"}</div>
        </div>
      </div>
    `;
  }

  function renderChart(log) {
    const chartEl = container.querySelector("#weight-chart");
    const points = [...log]
      .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1))
      .map((e) => ({ iso: e.dateISO, value: unit === "lbs" ? kgToLbs(e.kg) : e.kg }));
    renderLineChart(chartEl, points, {
      yLabel: (v) => round(v, 0),
      tooltipValue: (v) => `${round(v, 1)} ${unit}`,
      ariaLabel: "Weight trend, all time",
      emptyText: "No weigh-ins yet.",
    });
  }

  function renderList(log) {
    const listEl = container.querySelector("#weight-log-list");
    if (!log.length) {
      listEl.innerHTML = `<li class="log-empty">Nothing logged yet.</li>`;
      return;
    }
    listEl.innerHTML = log
      .map(
        (e) => `
      <li class="log-item">
        <div class="log-main">
          <span class="log-value">${displayValue(e.kg)} ${unit}</span>
          <span class="log-date">${formatDateShort(e.dateISO)}</span>
          ${e.note ? `<span class="log-note">${escapeHtml(e.note)}</span>` : ""}
        </div>
        <button class="log-del" data-id="${e.id}" title="Delete">✕</button>
      </li>`
      )
      .join("");
    listEl.querySelectorAll(".log-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteWeightEntry(btn.dataset.id);
        refresh();
      });
    });
  }

  // ---- Unit toggle: updates the entry-field limits/placeholder, persists
  // as the preferred display unit, and re-renders summary/chart/history in
  // the newly chosen unit (no need to re-log anything). ----
  const unitSelect = container.querySelector("#w-unit");
  const weightInput = container.querySelector("#w-weight");
  const weightLabel = container.querySelector("#w-weight-label");
  unitSelect.addEventListener("change", () => {
    unit = unitSelect.value === "lbs" ? "lbs" : "kg";
    const limits = UNIT_LIMITS[unit];
    weightInput.min = limits.min;
    weightInput.max = limits.max;
    weightInput.step = limits.step;
    weightInput.placeholder = limits.placeholder;
    weightLabel.textContent = `Weight (${unit})`;
    saveProfile({ ...currentProfile(), weightUnit: unit });
    refresh();
  });

  container.querySelector("#weight-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const rawValue = parseFloat(container.querySelector("#w-weight").value);
    const kg = unit === "lbs" ? lbsToKg(rawValue) : rawValue;
    const dateISO = container.querySelector("#w-date").value;
    const note = container.querySelector("#w-note").value.trim();
    addWeightEntry({ kg, dateISO, note: note || undefined });
    container.querySelector("#weight-form").reset();
    container.querySelector("#w-date").value = todayISO();
    container.querySelector("#w-unit").value = unit;
    showToast("Weight logged");
    refresh();
  });

  refresh();
}
