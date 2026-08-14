import { getVitalsLog, addVitalsEntry, deleteVitalsEntry } from "./storage.js";
import { bpCategory, todayISO, formatDateShort, round, escapeHtml } from "./util.js";
import { renderLineChart } from "./charts.js";
import { showToast } from "./ui.js";

export function renderVitalsView(container) {
  container.innerHTML = `
    <div class="view-header">
      <h2>Vitals</h2>
      <p class="subtitle">Blood pressure, waist circumference, and sleep — three numbers worth tracking beyond weight.</p>
    </div>

    <div class="card">
      <h3>Log an entry</h3>
      <form id="vitals-form">
        <div class="form-grid">
          <div class="field">
            <label for="v-date">Date</label>
            <input type="date" id="v-date" value="${todayISO()}" max="${todayISO()}" required />
          </div>
          <div class="field">
            <label for="v-sys">Systolic</label>
            <input type="number" id="v-sys" min="60" max="260" placeholder="e.g. 122" />
          </div>
          <div class="field">
            <label for="v-dia">Diastolic</label>
            <input type="number" id="v-dia" min="30" max="160" placeholder="e.g. 78" />
          </div>
          <div class="field">
            <label for="v-waist">Waist (cm)</label>
            <input type="number" id="v-waist" min="40" max="200" step="0.5" placeholder="e.g. 96" />
          </div>
          <div class="field">
            <label for="v-sleep">Sleep (hrs)</label>
            <input type="number" id="v-sleep" min="0" max="14" step="0.25" placeholder="e.g. 7" />
          </div>
          <div class="field" style="min-width:auto;">
            <button type="submit" class="btn btn-primary">Add</button>
          </div>
        </div>
        <p class="field hint" style="margin-top:0.5rem;">Fill in whichever fields you're logging — you don't need all four every time.</p>
      </form>
    </div>

    <div class="card-row">
      <div class="card">
        <h3>Blood pressure</h3>
        <div id="bp-summary"></div>
        <div id="bp-chart" style="margin-top:0.8rem;"></div>
        <p class="field hint" style="margin-top:0.6rem;">AHA categories: Normal &lt;120/80 · Elevated 120–129/&lt;80 · Stage 1 130–139/80–89 · Stage 2 ≥140/90.</p>
      </div>
      <div class="card">
        <h3>Waist circumference</h3>
        <div id="waist-summary"></div>
        <div id="waist-chart" style="margin-top:0.8rem;"></div>
        <p class="field hint" style="margin-top:0.6rem;">Increased cardiometabolic risk above roughly 102 cm (40 in) for men, 88 cm (35 in) for women — measured at the navel, standing, after exhaling.</p>
      </div>
    </div>

    <div class="card">
      <h3>Sleep</h3>
      <div id="sleep-summary"></div>
      <div id="sleep-chart" style="margin-top:0.8rem;"></div>
      <p class="field hint" style="margin-top:0.6rem;">Most adults do best on 7–9 hours; consistency of sleep/wake times matters too.</p>
    </div>

    <div class="card">
      <h3>History</h3>
      <ul class="log-list" id="vitals-log-list"></ul>
    </div>
  `;

  function refresh() {
    const log = getVitalsLog();
    renderBp(log);
    renderWaist(log);
    renderSleep(log);
    renderList(log);
  }

  function last90(log, field) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    return log
      .filter((e) => e[field] != null && new Date(e.dateISO) >= cutoff)
      .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
  }

  function renderBp(log) {
    const withBp = log.filter((e) => e.sys != null && e.dia != null);
    const summaryEl = container.querySelector("#bp-summary");
    if (!withBp.length) {
      summaryEl.innerHTML = `<p class="log-empty">No blood pressure logged yet.</p>`;
    } else {
      const latest = withBp[0];
      const cat = bpCategory(latest.sys, latest.dia);
      summaryEl.innerHTML = `
        <div class="stat-tile" style="max-width:220px;">
          <div class="stat-label">Latest</div>
          <div class="stat-value">${latest.sys}<span class="unit">/${latest.dia}</span></div>
          <div class="stat-sub">${formatDateShort(latest.dateISO)} · <span class="badge badge-${cat.tone}">${cat.label}</span></div>
        </div>
      `;
    }
    const points = last90(log, "sys").map((e) => ({ iso: e.dateISO, value: e.sys }));
    renderLineChart(container.querySelector("#bp-chart"), points, {
      tooltipValue: (v) => `${v} systolic`,
      emptyText: "No blood pressure readings in the last 90 days.",
      height: 150,
    });
  }

  function renderWaist(log) {
    const withWaist = log.filter((e) => e.waistCm != null);
    const summaryEl = container.querySelector("#waist-summary");
    if (!withWaist.length) {
      summaryEl.innerHTML = `<p class="log-empty">No waist measurements yet.</p>`;
    } else {
      const latest = withWaist[0];
      summaryEl.innerHTML = `
        <div class="stat-tile" style="max-width:220px;">
          <div class="stat-label">Latest</div>
          <div class="stat-value">${round(latest.waistCm, 1)}<span class="unit">cm</span></div>
          <div class="stat-sub">${formatDateShort(latest.dateISO)}</div>
        </div>
      `;
    }
    const points = last90(log, "waistCm").map((e) => ({ iso: e.dateISO, value: e.waistCm }));
    renderLineChart(container.querySelector("#waist-chart"), points, {
      tooltipValue: (v) => `${round(v, 1)} cm`,
      emptyText: "No waist measurements in the last 90 days.",
      height: 150,
    });
  }

  function renderSleep(log) {
    const withSleep = log.filter((e) => e.sleepHours != null);
    const summaryEl = container.querySelector("#sleep-summary");
    if (!withSleep.length) {
      summaryEl.innerHTML = `<p class="log-empty">No sleep logged yet.</p>`;
    } else {
      const latest = withSleep[0];
      const avg7 = withSleep.slice(0, 7).reduce((a, e) => a + e.sleepHours, 0) / Math.min(7, withSleep.length);
      summaryEl.innerHTML = `
        <div class="stat-grid">
          <div class="stat-tile">
            <div class="stat-label">Last night</div>
            <div class="stat-value">${round(latest.sleepHours, 1)}<span class="unit">hrs</span></div>
            <div class="stat-sub">${formatDateShort(latest.dateISO)}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-label">7-entry average</div>
            <div class="stat-value">${round(avg7, 1)}<span class="unit">hrs</span></div>
          </div>
        </div>
      `;
    }
    const points = last90(log, "sleepHours").map((e) => ({ iso: e.dateISO, value: e.sleepHours }));
    renderLineChart(container.querySelector("#sleep-chart"), points, {
      goal: 7,
      tooltipValue: (v) => `${round(v, 1)} hrs`,
      emptyText: "No sleep entries in the last 90 days.",
      height: 150,
    });
  }

  function renderList(log) {
    const listEl = container.querySelector("#vitals-log-list");
    if (!log.length) {
      listEl.innerHTML = `<li class="log-empty">Nothing logged yet.</li>`;
      return;
    }
    listEl.innerHTML = log
      .map((e) => {
        const parts = [];
        if (e.sys != null && e.dia != null) parts.push(`BP ${e.sys}/${e.dia}`);
        if (e.waistCm != null) parts.push(`Waist ${round(e.waistCm, 1)}cm`);
        if (e.sleepHours != null) parts.push(`Sleep ${round(e.sleepHours, 1)}h`);
        return `
      <li class="log-item">
        <div class="log-main">
          <span class="log-value">${escapeHtml(parts.join(" · ") || "—")}</span>
          <span class="log-date">${formatDateShort(e.dateISO)}</span>
        </div>
        <button class="log-del" data-id="${e.id}" title="Delete">✕</button>
      </li>`;
      })
      .join("");
    listEl.querySelectorAll(".log-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteVitalsEntry(btn.dataset.id);
        refresh();
      });
    });
  }

  container.querySelector("#vitals-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const dateISO = container.querySelector("#v-date").value;
    const sys = container.querySelector("#v-sys").value;
    const dia = container.querySelector("#v-dia").value;
    const waistCm = container.querySelector("#v-waist").value;
    const sleepHours = container.querySelector("#v-sleep").value;
    if (!sys && !dia && !waistCm && !sleepHours) {
      showToast("Enter at least one value");
      return;
    }
    addVitalsEntry({
      dateISO,
      sys: sys ? parseInt(sys, 10) : undefined,
      dia: dia ? parseInt(dia, 10) : undefined,
      waistCm: waistCm ? parseFloat(waistCm) : undefined,
      sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
    });
    container.querySelector("#vitals-form").reset();
    container.querySelector("#v-date").value = todayISO();
    showToast("Vitals logged");
    refresh();
  });

  refresh();
}
