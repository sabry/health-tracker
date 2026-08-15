import { getActivityLog, upsertActivityForDay, addWalkSession, deleteActivityEntry, saveProfile } from "./storage.js";
import { currentProfile } from "./profile.js";
import { todayISO, daysAgoISO, formatDateShort, round, weekStartISO } from "./util.js";
import { renderBarChart } from "./charts.js";
import { showToast, requestWakeLock, releaseWakeLock, formatClock } from "./ui.js";

export const DEFAULT_STEP_GOAL = 7000;
export const DEFAULT_WEEKLY_MINUTES_GOAL = 150; // CDC/AHA: 150 min/week moderate aerobic activity

// ---------------- Pedometer (accelerometer-based step counter) ----------------
//
// Simple peak-detection pedometer: low-pass filter the accelerometer
// magnitude to estimate the gravity baseline, then count a "step" each time
// the deviation from that baseline rises through a threshold, with a
// refractory period so a single footfall isn't double-counted. This is the
// same basic approach most phone pedometers use; it's approximate, not a
// clinical-grade sensor.
class Pedometer {
  constructor() {
    this.steps = 0;
    this.filtered = null;
    this.lastStepTime = 0;
    this.rising = false;
    this.threshold = 1.15; // m/s^2 deviation from smoothed baseline
    this.refractoryMs = 300; // ~200 steps/min max
    this.onStep = null;
    this._handler = this._handler.bind(this);
  }

  _handler(event) {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x == null) return;
    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    if (this.filtered == null) this.filtered = mag;
    this.filtered = this.filtered * 0.92 + mag * 0.08;
    const deviation = mag - this.filtered;

    const now = event.timeStamp ? performance.timeOrigin + event.timeStamp : Date.now();
    if (!this.rising && deviation > this.threshold) {
      this.rising = true;
      if (now - this.lastStepTime > this.refractoryMs) {
        this.steps++;
        this.lastStepTime = now;
        if (this.onStep) this.onStep(this.steps);
      }
    } else if (this.rising && deviation < this.threshold * 0.3) {
      this.rising = false;
    }
  }

  async start() {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      const result = await DeviceMotionEvent.requestPermission();
      if (result !== "granted") throw new Error("Motion sensor permission was denied.");
    }
    if (typeof DeviceMotionEvent === "undefined") {
      throw new Error("This device/browser doesn't expose motion sensors.");
    }
    this.steps = 0;
    this.filtered = null;
    this.lastStepTime = 0;
    window.addEventListener("devicemotion", this._handler);
  }

  stop() {
    window.removeEventListener("devicemotion", this._handler);
  }
}

export function renderActivityView(container) {
  const profile = currentProfile();
  const stepGoal = profile.stepGoal || DEFAULT_STEP_GOAL;
  const weeklyGoal = profile.weeklyMinutesGoal || DEFAULT_WEEKLY_MINUTES_GOAL;

  container.innerHTML = `
    <div class="view-header">
      <h2>Activity</h2>
      <p class="subtitle">Live step tracking uses your phone's motion sensor. General guidance for adults: aim for around 7,000&ndash;8,000 steps/day and 150 minutes/week of moderate activity.</p>
    </div>

    <div class="card">
      <h3>Track a walk now</h3>
      <div class="timer-box">
        <div class="hr-live-value" id="walk-steps">0<span class="unit" style="font-size:1rem;"> steps</span></div>
        <div class="timer-display" id="walk-clock">00:00</div>
        <div class="timer-note" id="walk-note">Uses your phone's accelerometer to count steps while this screen is open. Keep your phone in your hand or pocket and walk normally.</div>
        <div class="btn-row">
          <button id="walk-start" class="btn btn-primary">▶ Start walk</button>
          <button id="walk-stop" class="btn" disabled>■ Stop &amp; save</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Log activity manually</h3>
      <form id="activity-form">
        <div class="form-grid">
          <div class="field">
            <label for="a-date">Date</label>
            <input type="date" id="a-date" value="${todayISO()}" max="${todayISO()}" required />
          </div>
          <div class="field">
            <label for="a-steps">Steps</label>
            <input type="number" id="a-steps" min="0" max="100000" placeholder="e.g. 6500" />
          </div>
          <div class="field">
            <label for="a-minutes">Active minutes</label>
            <input type="number" id="a-minutes" min="0" max="600" placeholder="e.g. 30" />
          </div>
          <div class="field" style="min-width:auto;">
            <button type="submit" class="btn btn-primary">Save day</button>
          </div>
        </div>
        <p class="field hint" style="margin-top:0.5rem;">This overwrites the totals for the chosen day — use it for days you tracked activity another way.</p>
      </form>
    </div>

    <div class="card-row">
      <div class="card">
        <h3>Steps &mdash; last 7 days</h3>
        <div id="steps-chart"></div>
      </div>
      <div class="card">
        <h3>This week's active minutes</h3>
        <div id="weekly-minutes"></div>
      </div>
    </div>

    <div class="card">
      <h3>Daily goal</h3>
      <div class="form-grid">
        <div class="field">
          <label for="goal-steps">Step goal</label>
          <input type="number" id="goal-steps" min="1000" max="30000" step="500" value="${stepGoal}" />
        </div>
        <div class="field">
          <label for="goal-minutes">Weekly active-minutes goal</label>
          <input type="number" id="goal-minutes" min="30" max="1000" step="10" value="${weeklyGoal}" />
        </div>
        <div class="field" style="min-width:auto;">
          <button id="save-goals" class="btn btn-sm">Save goals</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>History</h3>
      <ul class="log-list" id="activity-log-list"></ul>
    </div>
  `;

  // ---- Live walk tracker ----
  //
  // A phone browser can't keep counting steps once the screen locks or the
  // app is backgrounded — iOS discards a backgrounded standalone PWA
  // outright, and Android freezes its JS. That's a platform limit, not
  // something fixable from here. What IS fixable: not silently losing
  // progress when that happens mid-walk. So this flushes counted steps to
  // storage periodically and immediately on backgrounding, and leaves a
  // marker that gets checked on next launch — if the app never got a clean
  // "Stop", whatever was saved before the interruption is still there, and
  // the person finds out rather than just losing the walk.
  const ACTIVE_WALK_KEY = "healthtracker.activeWalkMarker";
  const FLUSH_INTERVAL_MS = 20000;

  const pedometer = new Pedometer();
  let walkTimer = null;
  let flushTimer = null;
  let walkStartTime = null;
  let lastSavedSteps = 0;
  let lastFlushTime = null;

  const stepsEl = container.querySelector("#walk-steps");
  const clockEl = container.querySelector("#walk-clock");
  const noteEl = container.querySelector("#walk-note");
  const startBtn = container.querySelector("#walk-start");
  const stopBtn = container.querySelector("#walk-stop");

  pedometer.onStep = (n) => {
    stepsEl.innerHTML = `${n}<span class="unit" style="font-size:1rem;"> steps</span>`;
  };

  function flushProgress() {
    if (!walkStartTime) return;
    const now = Date.now();
    const deltaSteps = pedometer.steps - lastSavedSteps;
    const deltaMinutes = (now - lastFlushTime) / 60000;
    if (deltaSteps > 0) {
      addWalkSession(deltaSteps, deltaMinutes);
      lastSavedSteps = pedometer.steps;
      lastFlushTime = now;
      localStorage.setItem(ACTIVE_WALK_KEY, JSON.stringify({ startedAt: walkStartTime, lastFlushAt: now, savedSteps: lastSavedSteps }));
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden" && walkStartTime) flushProgress();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flushProgress);

  // If a previous walk never got a clean "Stop" (app was killed by the OS
  // mid-walk), let the person know their progress up to that point is safe.
  (function checkInterruptedWalk() {
    const raw = localStorage.getItem(ACTIVE_WALK_KEY);
    if (!raw) return;
    try {
      const marker = JSON.parse(raw);
      if (marker.savedSteps > 0) {
        showToast(`Your last walk was interrupted — ${marker.savedSteps} steps were already saved.`);
      }
    } catch (e) {}
    localStorage.removeItem(ACTIVE_WALK_KEY);
  })();

  startBtn.addEventListener("click", async () => {
    try {
      await pedometer.start();
    } catch (err) {
      noteEl.textContent = err.message + " You can still log steps manually below.";
      return;
    }
    walkStartTime = Date.now();
    lastSavedSteps = 0;
    lastFlushTime = walkStartTime;
    localStorage.setItem(ACTIVE_WALK_KEY, JSON.stringify({ startedAt: walkStartTime, lastFlushAt: walkStartTime, savedSteps: 0 }));
    requestWakeLock();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    noteEl.textContent = "Tracking… progress auto-saves every 20s, so a screen lock or interruption won't lose the whole walk — but counting itself still needs this screen open and the app in front.";
    walkTimer = setInterval(() => {
      clockEl.textContent = formatClock((Date.now() - walkStartTime) / 1000);
    }, 500);
    flushTimer = setInterval(flushProgress, FLUSH_INTERVAL_MS);
    clockEl.classList.add("running");
  });

  stopBtn.addEventListener("click", () => {
    pedometer.stop();
    releaseWakeLock();
    clearInterval(walkTimer);
    clearInterval(flushTimer);
    clockEl.classList.remove("running");
    flushProgress(); // save whatever's accumulated since the last periodic flush
    const totalSaved = lastSavedSteps;
    localStorage.removeItem(ACTIVE_WALK_KEY);
    if (totalSaved > 0) {
      showToast(`Saved ${totalSaved} steps for this walk`);
    }
    walkStartTime = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    noteEl.textContent = "Uses your phone's accelerometer to count steps while this screen is open. Keep your phone in your hand or pocket and walk normally.";
    stepsEl.innerHTML = `0<span class="unit" style="font-size:1rem;"> steps</span>`;
    clockEl.textContent = "00:00";
    refresh();
  });

  // ---- Manual entry ----
  container.querySelector("#activity-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const dateISO = container.querySelector("#a-date").value;
    const steps = container.querySelector("#a-steps").value;
    const minutes = container.querySelector("#a-minutes").value;
    if (!steps && !minutes) {
      showToast("Enter steps or minutes");
      return;
    }
    upsertActivityForDay(dateISO, {
      steps: steps ? parseInt(steps, 10) : 0,
      activeMinutes: minutes ? parseFloat(minutes) : 0,
      source: "manual",
    });
    container.querySelector("#activity-form").reset();
    container.querySelector("#a-date").value = todayISO();
    showToast("Activity saved");
    refresh();
  });

  container.querySelector("#save-goals").addEventListener("click", () => {
    saveProfile({
      ...currentProfile(),
      stepGoal: parseInt(container.querySelector("#goal-steps").value, 10) || DEFAULT_STEP_GOAL,
      weeklyMinutesGoal: parseInt(container.querySelector("#goal-minutes").value, 10) || DEFAULT_WEEKLY_MINUTES_GOAL,
    });
    showToast("Goals saved");
    refresh();
  });

  function refresh() {
    const log = getActivityLog();
    const p = currentProfile();
    const goal = p.stepGoal || DEFAULT_STEP_GOAL;
    const wGoal = p.weeklyMinutesGoal || DEFAULT_WEEKLY_MINUTES_GOAL;

    // Last 7 days bar chart (fill missing days with 0)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const iso = daysAgoISO(i);
      const entry = log.find((e) => e.dateISO === iso);
      days.push({ iso, value: entry ? entry.steps || 0 : 0 });
    }
    renderBarChart(container.querySelector("#steps-chart"), days, { goal, unit: " steps", todayISO: todayISO() });

    // Weekly active minutes (Mon-start week)
    const thisWeekStart = weekStartISO(todayISO());
    const weekMinutes = log
      .filter((e) => e.dateISO >= thisWeekStart)
      .reduce((sum, e) => sum + (e.activeMinutes || 0), 0);
    const pct = Math.min(100, Math.round((weekMinutes / wGoal) * 100));
    container.querySelector("#weekly-minutes").innerHTML = `
      <div class="stat-tile" style="max-width:260px;">
        <div class="stat-label">Active minutes since Monday</div>
        <div class="stat-value">${round(weekMinutes, 0)}<span class="unit">/ ${wGoal} min</span></div>
        <div class="progress-bar-track" style="margin-top:0.5rem;"><div class="progress-bar-fill ${pct >= 100 ? "over" : ""}" style="width:${pct}%"></div></div>
      </div>
    `;

    // History list
    const listEl = container.querySelector("#activity-log-list");
    if (!log.length) {
      listEl.innerHTML = `<li class="log-empty">Nothing logged yet.</li>`;
    } else {
      listEl.innerHTML = log
        .slice()
        .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))
        .map(
          (e) => `
        <li class="log-item">
          <div class="log-main">
            <span class="log-value">${(e.steps || 0).toLocaleString()} steps</span>
            <span class="log-note">${round(e.activeMinutes || 0, 0)} min</span>
            <span class="log-date">${formatDateShort(e.dateISO)} ${e.source === "sensor" ? "· sensor" : "· manual"}</span>
          </div>
          <button class="log-del" data-id="${e.id}" title="Delete">✕</button>
        </li>`
        )
        .join("");
      listEl.querySelectorAll(".log-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          deleteActivityEntry(btn.dataset.id);
          refresh();
        });
      });
    }
  }

  refresh();

  // Called by the router when navigating away from this tab. Without this,
  // the visibilitychange/pagehide listeners below would pile up on every
  // visit to this tab, and a walk left running (no "Stop" tapped) would
  // keep its accelerometer listener alive in the background indefinitely —
  // and double-count steps if a second walk gets started later.
  return function cleanup() {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flushProgress);
    if (walkStartTime) {
      pedometer.stop();
      releaseWakeLock();
      clearInterval(walkTimer);
      clearInterval(flushTimer);
      flushProgress();
      localStorage.removeItem(ACTIVE_WALK_KEY);
      walkStartTime = null;
    }
  };
}
