import { getExerciseLog, addExerciseEntry, deleteExerciseEntry, getWeightLog } from "./storage.js";
import { todayISO, formatDateShort, formatDateTime, escapeHtml, round } from "./util.js";
import { showToast, requestWakeLock, releaseWakeLock, formatClock } from "./ui.js";

// Reference ranges below are general fitness guidelines gathered from
// commonly published norm tables (e.g. 30-second chair-stand / sit-to-stand
// norms, standard push-up/sit-up test bands, and single-leg-stance research
// summaries) for adults around 60-69. They're a rough compass, not a
// clinical assessment — form and consistency matter more than hitting a
// band, and anyone with joint pain, dizziness, or heart/lung conditions
// should check with a doctor before pushing hard on these.
export const EXERCISES = [
  {
    id: "pushups",
    name: "Push-ups",
    category: "Strength",
    unit: "reps",
    description: "Standard or knee/incline push-ups, to near failure with good form (chest to ~90°, no sagging hips).",
    howTo: "Hands shoulder-width, body in a straight line. Lower until elbows hit ~90°, push back up. Use an incline (counter, wall) or knees if needed — still counts.",
    hasTimer: false,
    met: 8.0,
    normTable: [
      { band: "Building up", range: "0–5", min: 0, max: 5, tone: "warn" },
      { band: "Average", range: "6–11", min: 6, max: 11, tone: "neutral" },
      { band: "Good", range: "12–19", min: 12, max: 19, tone: "good" },
      { band: "Excellent", range: "20+", min: 20, max: null, tone: "accent" },
    ],
  },
  {
    id: "situps",
    name: "Sit-ups / crunches",
    category: "Strength",
    unit: "reps in 1 minute",
    description: "As many controlled sit-ups (or crunches, easier on the low back) as you can in 60 seconds.",
    howTo: "Knees bent, feet anchored or flat. Curl up through the torso, don't yank the neck. Time yourself for exactly 60 seconds.",
    hasTimer: true,
    timerLabel: "60-second sit-up test",
    suggestedSeconds: 60,
    met: 8.0,
    normTable: [
      { band: "Building up", range: "0–7", min: 0, max: 7, tone: "warn" },
      { band: "Average", range: "8–12", min: 8, max: 12, tone: "neutral" },
      { band: "Good", range: "13–18", min: 13, max: 18, tone: "good" },
      { band: "Excellent", range: "19+", min: 19, max: null, tone: "accent" },
    ],
  },
  {
    id: "chair-stand",
    name: "Squats / chair stand",
    category: "Strength",
    unit: "reps in 30 seconds",
    description: "Bodyweight squats, or the classic sit-to-stand test: from a chair, stand fully then sit, as many times as possible in 30 seconds.",
    howTo: "Arms crossed over chest (or use them for balance if needed). Full stand, full sit, each rep. This is a validated test of lower-body strength and fall risk used with older adults.",
    hasTimer: true,
    timerLabel: "30-second chair-stand test",
    suggestedSeconds: 30,
    met: 5.0,
    normTable: [
      { band: "Below average", range: "0–11", min: 0, max: 11, tone: "warn" },
      { band: "Average", range: "12–13", min: 12, max: 13, tone: "neutral" },
      { band: "Good", range: "14–19", min: 14, max: 19, tone: "good" },
      { band: "Excellent", range: "20+", min: 20, max: null, tone: "accent" },
    ],
  },
  {
    id: "one-foot-balance",
    name: "Standing on one foot",
    category: "Balance",
    unit: "seconds",
    sides: true,
    description: "Eyes open, stand on one leg without touching down or using support. A strong single-leg balance is linked to lower fall risk with age.",
    howTo: "Stand near a wall or counter the first few times, just in case. Lift one foot, start the timer, stop it the moment you touch down, hop, or grab support. Log each leg separately below — the target time is the same for both legs, but a big gap between your left and right (more than a few seconds) is itself worth noticing, since it often points to one side being weaker or a past injury still affecting balance.",
    hasTimer: true,
    timerLabel: "One-foot balance hold",
    met: 2.0,
    normTable: [
      { band: "Building up", range: "<10s", min: 0, max: 9, tone: "warn" },
      { band: "Average", range: "10–19s", min: 10, max: 19, tone: "neutral" },
      { band: "Good", range: "20–29s", min: 20, max: 29, tone: "good" },
      { band: "Excellent", range: "30s+", min: 30, max: null, tone: "accent" },
    ],
  },
  {
    id: "plank",
    name: "Plank",
    category: "Strength",
    unit: "seconds",
    description: "Forearm plank, straight line from shoulders to ankles, core braced, breathing steady.",
    howTo: "Elbows under shoulders, glutes and abs engaged, don't let hips sag or pike up. Hold until form breaks.",
    hasTimer: true,
    timerLabel: "Plank hold",
    met: 3.5,
    normTable: [
      { band: "Building up", range: "<20s", min: 0, max: 19, tone: "warn" },
      { band: "Solid start", range: "20–44s", min: 20, max: 44, tone: "neutral" },
      { band: "Good", range: "45–89s", min: 45, max: 89, tone: "good" },
      { band: "Excellent", range: "90s+", min: 90, max: null, tone: "accent" },
    ],
  },
  {
    id: "wall-sit",
    name: "Wall sit",
    category: "Strength",
    unit: "seconds",
    description: "Back flat against a wall, knees at ~90°, thighs parallel to the floor.",
    howTo: "Slide down the wall until thighs are roughly parallel to the ground. Hold, keep weight through your heels.",
    hasTimer: true,
    timerLabel: "Wall sit hold",
    met: 3.0,
    normTable: [
      { band: "Building up", range: "<20s", min: 0, max: 19, tone: "warn" },
      { band: "Solid start", range: "20–44s", min: 20, max: 44, tone: "neutral" },
      { band: "Good", range: "45–89s", min: 45, max: 89, tone: "good" },
      { band: "Excellent", range: "90s+", min: 90, max: null, tone: "accent" },
    ],
  },
  {
    id: "calf-raises",
    name: "Standing calf raises",
    category: "Strength",
    unit: "reps",
    description: "Rise onto the balls of both feet, pause, lower with control. Hold a counter for balance if needed.",
    howTo: "Slow and controlled beats fast — 2 seconds up, pause, 2 seconds down. Builds ankle stability, which helps balance too.",
    hasTimer: false,
    met: 3.0,
    normTable: [
      { band: "Building up", range: "<10", min: 0, max: 9, tone: "warn" },
      { band: "Good", range: "10–19", min: 10, max: 19, tone: "good" },
      { band: "Excellent", range: "20+", min: 20, max: null, tone: "accent" },
    ],
  },
  {
    id: "stretch",
    name: "Stretching / mobility",
    category: "Flexibility",
    unit: "minutes",
    description: "Hamstrings, calves, hip flexors, shoulders, low back — hold each stretch 20–30 seconds, no bouncing.",
    howTo: "Best after a short warm-up or at the end of a session, while muscles are warm. Breathe through it, ease off if anything sharp shows up.",
    hasTimer: false,
    met: 2.5,
    normTable: [],
  },
];

// Rough MET-based calorie estimate for one logged exercise entry (ACSM
// formula: kcal = MET x 3.5 x kg / 200 x minutes). Duration is derived from
// what's actually logged: a direct time for seconds/minutes exercises, the
// test's fixed duration for the timed sit-up/chair-stand tests (the value
// logged there is a rep count *within* that fixed window, not a duration),
// or an assumed ~3 seconds per rep (~4s for slower calf raises) for the
// other rep-counted exercises. Approximate, not a measurement — actual
// effort varies with pace, bodyweight distribution, and form.
export function estimateExerciseCalories(entry, weightKg) {
  const ex = EXERCISES.find((x) => x.id === entry.exerciseId);
  if (!ex || !ex.met || !weightKg || entry.value == null) return 0;
  let minutes;
  if (ex.hasTimer && ex.suggestedSeconds) {
    minutes = ex.suggestedSeconds / 60;
  } else if (ex.unit === "seconds") {
    minutes = entry.value / 60;
  } else if (ex.unit === "minutes") {
    minutes = entry.value;
  } else {
    const secPerRep = ex.id === "calf-raises" ? 4 : 3;
    minutes = (entry.value * secPerRep) / 60;
  }
  if (!minutes) return 0;
  return ((ex.met * 3.5 * weightKg) / 200) * minutes;
}

function getBand(exercise, value) {
  if (value == null || !exercise.normTable.length) return null;
  return exercise.normTable.find((b) => value >= b.min && (b.max == null || value <= b.max)) || null;
}

export function renderExercisesView(container) {
  container.innerHTML = `
    <div class="view-header">
      <h2>Home exercises</h2>
      <p class="subtitle">A simple bodyweight routine. Reference ranges are general fitness guidelines for adults around 60–69, not a clinical assessment — build up gradually and stop if anything hurts.</p>
    </div>

    <div class="exercise-grid" id="exercise-grid"></div>

    <div class="card">
      <h3>Recent log</h3>
      <ul class="log-list" id="exercise-log-list"></ul>
    </div>

    <p class="disclaimer">Check with your doctor before starting a new exercise routine, especially if you have heart, lung, or joint conditions. Stop and seek care for chest pain, unusual shortness of breath, dizziness, or joint pain that doesn't resolve.</p>
  `;

  const grid = container.querySelector("#exercise-grid");
  grid.innerHTML = EXERCISES.map((ex) => exerciseCardHTML(ex)).join("");

  let activeTimer = null; // { exerciseId, startTime, intervalId }

  function stopActiveTimerUI() {
    document.querySelectorAll(".exercise-card").forEach((card) => {
      card.querySelector(".timer-display")?.classList.remove("running");
      const startBtn = card.querySelector(".ex-timer-start");
      const stopBtn = card.querySelector(".ex-timer-stop");
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
    });
  }

  EXERCISES.forEach((ex) => {
    const card = grid.querySelector(`[data-exercise="${ex.id}"]`);

    card.querySelector(".ex-log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const valueInput = card.querySelector(".ex-value");
      const value = parseFloat(valueInput.value);
      if (Number.isNaN(value)) return;
      const entry = { dateISO: todayISO(), exerciseId: ex.id, value };
      if (ex.sides) {
        entry.side = card.querySelector(".ex-side").value;
      }
      addExerciseEntry(entry);
      valueInput.value = "";
      showToast(`${ex.name}${ex.sides ? ` (${entry.side})` : ""} logged`);
      refreshCard(ex);
      refreshLogList();
    });

    if (ex.hasTimer) {
      const startBtn = card.querySelector(".ex-timer-start");
      const stopBtn = card.querySelector(".ex-timer-stop");
      const clockEl = card.querySelector(".timer-display");

      startBtn.addEventListener("click", () => {
        if (activeTimer) return; // one timer at a time
        const startTime = Date.now();
        requestWakeLock();
        clockEl.classList.add("running");
        startBtn.disabled = true;
        stopBtn.disabled = false;
        const intervalId = setInterval(() => {
          clockEl.textContent = formatClock((Date.now() - startTime) / 1000);
        }, 200);
        activeTimer = { exerciseId: ex.id, startTime, intervalId };
      });

      stopBtn.addEventListener("click", () => {
        if (!activeTimer || activeTimer.exerciseId !== ex.id) return;
        clearInterval(activeTimer.intervalId);
        releaseWakeLock();
        const elapsedSeconds = Math.round((Date.now() - activeTimer.startTime) / 1000);
        activeTimer = null;
        stopActiveTimerUI();
        clockEl.textContent = "00:00";
        card.querySelector(".ex-value").value = elapsedSeconds;
        showToast(`${elapsedSeconds}s — review and hit Log`);
      });
    }

    refreshCard(ex);
  });

  function refreshCard(ex) {
    const card = grid.querySelector(`[data-exercise="${ex.id}"]`);
    const log = getExerciseLog().filter((e) => e.exerciseId === ex.id);
    const latestEl = card.querySelector(".ex-latest");
    const unitSuffix = ex.unit.includes("second") ? "s" : "";

    if (ex.sides) {
      const latestLeft = log.find((e) => e.side === "left");
      const latestRight = log.find((e) => e.side === "right");
      const bandLeft = latestLeft ? getBand(ex, latestLeft.value) : null;
      const bandRight = latestRight ? getBand(ex, latestRight.value) : null;
      const gap = latestLeft && latestRight ? Math.abs(latestLeft.value - latestRight.value) : null;
      if (latestEl) {
        latestEl.innerHTML = [
          `Left: ${latestLeft ? `<strong>${latestLeft.value}s</strong> (${formatDateShort(latestLeft.dateISO)}) ${bandLeft ? `<span class="badge badge-${bandLeft.tone}">${bandLeft.band}</span>` : ""}` : "not logged yet"}`,
          `Right: ${latestRight ? `<strong>${latestRight.value}s</strong> (${formatDateShort(latestRight.dateISO)}) ${bandRight ? `<span class="badge badge-${bandRight.tone}">${bandRight.band}</span>` : ""}` : "not logged yet"}`,
          gap != null && gap >= 5 ? `<span class="badge badge-warn">${gap}s gap between sides — worth mentioning to a doctor if it persists</span>` : "",
        ].filter(Boolean).join("<br>");
      }
      return;
    }

    const latest = log[0];
    const band = latest ? getBand(ex, latest.value) : null;
    if (latestEl) {
      latestEl.innerHTML = latest
        ? `Last: <strong>${latest.value}</strong>${unitSuffix} on ${formatDateShort(latest.dateISO)} ${band ? `<span class="badge badge-${band.tone}">${band.band}</span>` : ""}`
        : `Not logged yet.`;
    }
    if (ex.normTable.length) {
      card.querySelectorAll(".norm-table tr[data-band]").forEach((row) => {
        row.classList.toggle("current-band", band && row.dataset.band === band.band);
      });
    }
  }

  function refreshLogList() {
    const listEl = container.querySelector("#exercise-log-list");
    const log = getExerciseLog();
    if (!log.length) {
      listEl.innerHTML = `<li class="log-empty">Nothing logged yet — log a set from any card above.</li>`;
      return;
    }
    const weightKg = getWeightLog()[0]?.kg;
    listEl.innerHTML = log
      .slice(0, 40)
      .map((e) => {
        const ex = EXERCISES.find((x) => x.id === e.exerciseId);
        const kcal = weightKg ? round(estimateExerciseCalories(e, weightKg), 0) : null;
        return `
      <li class="log-item">
        <div class="log-main">
          <span class="log-value">${escapeHtml(ex ? ex.name : e.exerciseId)}${e.side ? ` (${e.side})` : ""}: ${e.value}</span>
          <span class="log-note">${kcal ? `~${kcal} kcal` : ""}</span>
          <span class="log-date">${formatDateTime(e.createdAt || Date.now())}</span>
        </div>
        <button class="log-del" data-id="${e.id}" title="Delete">✕</button>
      </li>`;
      })
      .join("");
    listEl.querySelectorAll(".log-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteExerciseEntry(btn.dataset.id);
        refreshLogList();
        EXERCISES.forEach(refreshCard);
      });
    });
  }

  refreshLogList();
}

function exerciseCardHTML(ex) {
  return `
  <div class="exercise-card" data-exercise="${ex.id}">
    <h4>${ex.name} <span class="exercise-cat">${ex.category}</span></h4>
    <p>${ex.description}</p>
    <p class="ex-latest" style="font-size:0.82rem; color:var(--text-dim);"></p>
    ${ex.normTable.length ? `
      <table class="norm-table">
        <thead><tr><th>Band</th><th>${ex.unit}</th></tr></thead>
        <tbody>
          ${ex.normTable.map((b) => `<tr data-band="${b.band}"><td>${b.band}</td><td>${b.range}</td></tr>`).join("")}
        </tbody>
      </table>
    ` : ""}
    ${ex.hasTimer ? `
      <div class="timer-box" style="padding:0.8rem;">
        <div class="timer-display">00:00</div>
        ${ex.timerLabel ? `<div class="timer-note">${ex.timerLabel}</div>` : ""}
        <div class="btn-row" style="margin-top:0.4rem;">
          <button type="button" class="btn btn-sm ex-timer-start">▶ Start</button>
          <button type="button" class="btn btn-sm ex-timer-stop" disabled>■ Stop</button>
        </div>
      </div>
    ` : ""}
    <form class="ex-log-form" style="margin-top:0.4rem;">
      <div class="form-grid">
        ${ex.sides ? `
        <div class="field">
          <label>Leg</label>
          <select class="ex-side">
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>` : ""}
        <div class="field">
          <label>Log (${ex.unit})</label>
          <input type="number" class="ex-value" step="0.5" min="0" placeholder="value" required />
        </div>
        <div class="field" style="min-width:auto;">
          <button type="submit" class="btn btn-primary btn-sm">Log</button>
        </div>
      </div>
    </form>
    <details style="font-size:0.8rem; color:var(--text-dim);">
      <summary style="cursor:pointer;">How to</summary>
      <p style="margin:0.4rem 0 0;">${ex.howTo}</p>
    </details>
  </div>`;
}
