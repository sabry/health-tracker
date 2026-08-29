import { getExerciseLog, addExerciseEntry, deleteExerciseEntry, getWeightLog } from "./storage.js";
import { todayISO, formatDateShort, formatDateTime, escapeHtml, round } from "./util.js";
import { showToast, requestWakeLock, releaseWakeLock, formatClock } from "./ui.js";
import { renderLineChart } from "./charts.js";

// Reference ranges below are general fitness guidelines gathered from
// commonly published norm tables (e.g. 30-second chair-stand / sit-to-stand
// norms, standard push-up/sit-up test bands, the Rikli & Jones Senior
// Fitness Test's 2-minute step test norms for men 60-69, and the tandem
// stance / SPPB balance-screening cutoffs used in fall-risk assessments)
// for adults around 60-69. They're a rough compass, not a clinical
// assessment — form and consistency matter more than hitting a band, and
// anyone with joint pain, dizziness, or heart/lung conditions should check
// with a doctor before pushing hard on these. A few exercises (glute
// bridge, bird dog, side leg raises, and the individual stretches) are
// left without a norm table on purpose — there's no well-established
// published standard for them to compare against, so the per-exercise
// trend chart below is the honest way to track progress on those.
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
    secPerRep: 4,
    normTable: [
      { band: "Building up", range: "<10", min: 0, max: 9, tone: "warn" },
      { band: "Good", range: "10–19", min: 10, max: 19, tone: "good" },
      { band: "Excellent", range: "20+", min: 20, max: null, tone: "accent" },
    ],
  },
  {
    id: "glute-bridge",
    name: "Glute bridge",
    category: "Strength",
    unit: "reps",
    description: "Strengthens the glutes and lower back — helps with standing up, stairs, and hip stability.",
    howTo: "Lie on your back, knees bent, feet flat on the floor hip-width apart, arms at your sides. Squeeze your glutes and lift your hips up until your body forms a straight line from shoulders to knees — don't overarch your lower back. Pause briefly at the top, then lower with control. That's one rep.",
    hasTimer: false,
    met: 3.5,
    secPerRep: 3,
    normTable: [],
  },
  {
    id: "bird-dog",
    name: "Bird dog",
    category: "Strength",
    unit: "reps",
    description: "Builds core stability and coordination — a controlled, low-back-friendly alternative to sit-ups.",
    howTo: "Start on hands and knees, hands under shoulders, knees under hips. Slowly extend one arm straight forward and the opposite leg straight back, keeping your hips and back level — don't let your back sag or twist. Hold briefly, then return to start and switch sides. One rep = both sides.",
    hasTimer: false,
    met: 3.0,
    secPerRep: 5,
    normTable: [],
  },
  {
    id: "side-leg-raises",
    name: "Side leg raises",
    category: "Strength",
    unit: "reps",
    description: "Strengthens the hip and outer thigh — supports balance and can help protect against falls.",
    howTo: "Stand tall holding onto a wall or sturdy chair for balance. Keeping your leg straight and toes pointing forward, lift one leg out to the side, then lower with control — don't lean or swing your body to gain height. Do a set on one side, then switch legs.",
    hasTimer: false,
    met: 3.0,
    secPerRep: 3,
    normTable: [],
  },
  {
    id: "step-test-2min",
    name: "2-minute step test",
    category: "Cardio",
    unit: "right-knee raises in 2 min",
    description: "A standard fitness test used with older adults to gauge aerobic endurance — march in place and count right-knee lifts.",
    howTo: "Find a wall or doorframe and mark a target height roughly midway between your kneecap and hip bone. March in place for 2 minutes, lifting your right knee to that target height each time, and count how many times it gets there. Pace yourself — this should feel like brisk, sustainable effort, not a sprint. Stop early if you feel unsteady or overly winded.",
    hasTimer: true,
    timerLabel: "2-minute step test",
    suggestedSeconds: 120,
    met: 4.5,
    normTable: [
      { band: "Building up", range: "<75", min: 0, max: 74, tone: "warn" },
      { band: "Average", range: "75–119", min: 75, max: 119, tone: "neutral" },
      { band: "Good", range: "120–149", min: 120, max: 149, tone: "good" },
      { band: "Excellent", range: "150+", min: 150, max: null, tone: "accent" },
    ],
  },
  {
    id: "tandem-stance",
    name: "Tandem stance (heel-to-toe balance)",
    category: "Balance",
    unit: "seconds",
    description: "A standard balance-screening test used in fall-risk assessments — standing heel-to-toe in a straight line.",
    howTo: "Stand near a wall or counter just in case. Place one foot directly in front of the other, heel touching toe, in a straight line, arms however feels natural. Hold as still as you can without stepping out of position or grabbing support. Time yourself, then switch which foot is in front next time.",
    hasTimer: true,
    timerLabel: "Tandem stance hold",
    met: 2.0,
    normTable: [
      { band: "Building up", range: "<3s", min: 0, max: 2, tone: "warn" },
      { band: "Improving", range: "3–9s", min: 3, max: 9, tone: "neutral" },
      { band: "Meets balance benchmark", range: "10s+", min: 10, max: null, tone: "good" },
    ],
  },
  {
    id: "hamstring-stretch",
    name: "Hamstring stretch",
    category: "Flexibility",
    unit: "seconds",
    sides: true,
    description: "Stretches the back of the thigh — helps with bending, walking stride, and lower-back tension.",
    howTo: "Sit on the edge of a sturdy chair or the floor with one leg extended straight, heel on the ground, toes pointing up. Keep your back straight and hinge forward from the hips (not the waist) until you feel a gentle pull behind the thigh — don't bounce. Hold, breathing steadily, then switch legs. Aim for about 20-30 seconds a side.",
    hasTimer: true,
    timerLabel: "Hamstring stretch hold",
    met: 2.3,
    normTable: [],
  },
  {
    id: "calf-stretch",
    name: "Calf stretch",
    category: "Flexibility",
    unit: "seconds",
    sides: true,
    description: "Stretches the back of the lower leg — helps with ankle mobility and can ease tightness that affects your walking stride.",
    howTo: "Stand facing a wall, hands on the wall for support. Step one foot back, keeping that back leg straight with its heel flat on the floor, front knee bent. Lean gently into the wall until you feel a stretch in the back calf. Hold, then switch legs. Aim for about 20-30 seconds a side.",
    hasTimer: true,
    timerLabel: "Calf stretch hold",
    met: 2.3,
    normTable: [],
  },
  {
    id: "hip-flexor-stretch",
    name: "Hip flexor stretch",
    category: "Flexibility",
    unit: "seconds",
    sides: true,
    description: "Stretches the front of the hip — tight hip flexors from sitting can affect posture and stride length.",
    howTo: "From a half-kneeling position (one knee on the floor, ideally on a cushion, other foot flat in front with the knee bent ~90°), gently shift your weight forward while staying upright until you feel a stretch across the front of the hip on the kneeling-leg side. Use a wall or chair for balance if needed. Hold, then switch legs. Aim for about 20-30 seconds a side.",
    hasTimer: true,
    timerLabel: "Hip flexor stretch hold",
    met: 2.3,
    normTable: [],
  },
  {
    id: "shoulder-stretch",
    name: "Shoulder stretch",
    category: "Flexibility",
    unit: "seconds",
    sides: true,
    description: "Stretches the back of the shoulder and upper arm — helps with overhead reach and shoulder mobility.",
    howTo: "Bring one arm straight across your chest at shoulder height. With your other hand (or forearm), gently press it closer to your chest until you feel a stretch in the shoulder. Keep both shoulders relaxed and down, away from your ears. Hold, then switch arms. Aim for about 20-30 seconds a side.",
    hasTimer: true,
    timerLabel: "Shoulder stretch hold",
    met: 2.3,
    normTable: [],
  },
  {
    id: "lower-back-stretch",
    name: "Lower back stretch",
    category: "Flexibility",
    unit: "seconds",
    description: "Gently stretches the lower back and glutes — can ease stiffness after sitting.",
    howTo: "Lie on your back on a mat or carpeted floor. Bring one or both knees up toward your chest and hold them there with your hands, keeping your lower back relaxed against the floor. If bringing both knees up is uncomfortable, do one leg at a time. Hold, breathing steadily, then release slowly. Aim for about 20-30 seconds.",
    hasTimer: true,
    timerLabel: "Lower back stretch hold",
    met: 2.3,
    normTable: [],
  },
];

// Rough MET-based calorie estimate for one logged exercise entry (ACSM
// formula: kcal = MET x 3.5 x kg / 200 x minutes). Duration is derived from
// what's actually logged: a direct time for seconds/minutes exercises, the
// test's fixed duration for the timed sit-up/chair-stand/2-minute-step
// tests (the value logged there is a rep count *within* that fixed window,
// not a duration), or an assumed number of seconds per rep (each exercise's
// `secPerRep`, default 3) for the other rep-counted exercises. Approximate,
// not a measurement — actual effort varies with pace, bodyweight
// distribution, and form.
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
    minutes = (entry.value * (ex.secPerRep || 3)) / 60;
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
      renderProgress(card, ex, log.filter((e) => e.side === "left"), unitSuffix, "left");
      renderProgress(card, ex, log.filter((e) => e.side === "right"), unitSuffix, "right");
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
    renderProgress(card, ex, log, unitSuffix);
  }

  // Per-exercise (or per-side) progress: a compact best/first/change
  // summary plus a small trend chart, so improvement over time is visible
  // right on the card instead of buried in the combined log below. Higher
  // is better for every exercise here (more reps, longer hold), so a
  // positive change is always the "improved" direction.
  function renderProgress(card, ex, log, unitSuffix, side) {
    const suffix = side ? `-${side}` : "";
    const statsEl = card.querySelector(`.ex-progress-stats${suffix}`);
    const chartEl = card.querySelector(`.ex-progress-chart${suffix}`);
    if (!statsEl || !chartEl) return;

    const sorted = [...log].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!sorted.length) {
      statsEl.textContent = "Log a set to start tracking your trend.";
      chartEl.innerHTML = "";
      return;
    }

    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    const best = sorted.reduce((b, e) => (e.value > b.value ? e : b), sorted[0]);

    if (sorted.length === 1) {
      statsEl.innerHTML = `First logged: <strong>${first.value}${unitSuffix}</strong> on ${formatDateShort(first.dateISO)} — log again to see a trend.`;
    } else {
      const delta = round(latest.value - first.value, 1);
      const deltaSign = delta > 0 ? "+" : "";
      const deltaTone = delta > 0 ? "good" : delta < 0 ? "warn" : "neutral";
      statsEl.innerHTML = `Best <strong>${best.value}${unitSuffix}</strong> (${formatDateShort(best.dateISO)}) · First <strong>${first.value}${unitSuffix}</strong> (${formatDateShort(first.dateISO)}) · <span class="badge badge-${deltaTone}">${deltaSign}${delta}${unitSuffix} since first</span>`;
    }

    renderLineChart(chartEl, sorted.map((e) => ({ iso: e.dateISO, value: e.value })), {
      height: 100,
      yLabel: (v) => round(v, 0),
      tooltipValue: (v) => `${v}${unitSuffix}`,
      ariaLabel: `${ex.name}${side ? ` (${side})` : ""} trend`,
      emptyText: "Log a set to start tracking your trend.",
    });
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
    <div class="ex-progress">
      ${ex.sides ? `
        <div class="ex-progress-side">
          <p class="ex-progress-side-label">Left</p>
          <p class="ex-progress-stats-left"></p>
          <div class="ex-progress-chart-left"></div>
        </div>
        <div class="ex-progress-side">
          <p class="ex-progress-side-label">Right</p>
          <p class="ex-progress-stats-right"></p>
          <div class="ex-progress-chart-right"></div>
        </div>
      ` : `
        <p class="ex-progress-stats"></p>
        <div class="ex-progress-chart"></div>
      `}
    </div>
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
