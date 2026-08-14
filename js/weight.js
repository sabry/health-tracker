import { getWeightLog, addWeightEntry, deleteWeightEntry } from "./storage.js";
import { currentProfile } from "./profile.js";
import { bmi, bmiCategory, round, todayISO, formatDateShort, escapeHtml, daysBetween } from "./util.js";
import { renderLineChart } from "./charts.js";
import { showToast } from "./ui.js";

export function renderWeightView(container) {
  const profile = currentProfile();
  const log = getWeightLog(); // newest first

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
          <div class="field">
            <label for="w-kg">Weight (kg)</label>
            <input type="number" id="w-kg" min="30" max="300" step="0.1" placeholder="e.g. 84.5" required />
          </div>
          <div class="field" style="flex:2; min-width:200px;">
            <label for="w-note">Note (optional)</label>
            <input type="text" id="w-note" placeholder="e.g. after workout" />
          </div>
          <div class="field" style="min-width:auto;">
            <button type="submit" class="btn btn-primary">Add</button>
          </div>
        </div>
      </form>
    </div>

    <div class="card-row">
      <div class="card" id="weight-summary-card">
        <h3>Current</h3>
        <div id="weight-summary"></div>
      </div>
    </div>

    <div class="card">
      <h3>Trend (last 90 days)</h3>
      <div id="weight-chart"></div>
    </div>

    <div class="card">
      <h3>History</h3>
      <ul class="log-list" id="weight-log-list"></ul>
    </div>
  `;

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
    const delta7 = weekAgo ? round(latest.kg - weekAgo.kg, 1) : null;
    const delta30 = monthAgo ? round(latest.kg - monthAgo.kg, 1) : null;

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="stat-label">Latest</div>
          <div class="stat-value">${round(latest.kg, 1)}<span class="unit">kg</span></div>
          <div class="stat-sub">${formatDateShort(latest.dateISO)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">BMI</div>
          <div class="stat-value">${bmiValue ? round(bmiValue, 1) : "—"}</div>
          ${cat ? `<div class="stat-sub"><span class="badge badge-${cat.tone}">${cat.label}</span></div>` : `<div class="stat-sub">Add height in Profile</div>`}
        </div>
        <div class="stat-tile">
          <div class="stat-label">7-day change</div>
          <div class="stat-value">${delta7 != null ? `${delta7 > 0 ? "+" : ""}${delta7}<span class="unit">kg</span>` : "—"}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">30-day change</div>
          <div class="stat-value">${delta30 != null ? `${delta30 > 0 ? "+" : ""}${delta30}<span class="unit">kg</span>` : "—"}</div>
        </div>
      </div>
    `;
  }

  function renderChart(log) {
    const chartEl = container.querySelector("#weight-chart");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const points = [...log]
      .filter((e) => new Date(e.dateISO) >= cutoff)
      .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1))
      .map((e) => ({ iso: e.dateISO, value: e.kg }));
    renderLineChart(chartEl, points, {
      yLabel: (v) => round(v, 0),
      tooltipValue: (v) => `${round(v, 1)} kg`,
      ariaLabel: "Weight trend",
      emptyText: "No weigh-ins in the last 90 days.",
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
          <span class="log-value">${round(e.kg, 1)} kg</span>
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

  container.querySelector("#weight-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const kg = parseFloat(container.querySelector("#w-kg").value);
    const dateISO = container.querySelector("#w-date").value;
    const note = container.querySelector("#w-note").value.trim();
    addWeightEntry({ kg, dateISO, note: note || undefined });
    container.querySelector("#weight-form").reset();
    container.querySelector("#w-date").value = todayISO();
    showToast("Weight logged");
    refresh();
  });

  refresh();
}
