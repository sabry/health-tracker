import { getWeightLog, getVitalsLog, getActivityLog, getExerciseLog, getHrLog } from "./storage.js";
import { currentProfile } from "./profile.js";
import {
  bmi, bmiCategory, restingHrCategory, bpCategory, round, todayISO, daysAgoISO,
  formatDateShort, ageFromDOB,
} from "./util.js";
import { DEFAULT_STEP_GOAL } from "./activity.js";

function exerciseStreak() {
  const log = getExerciseLog();
  if (!log.length) return 0;
  const days = new Set(log.map((e) => e.dateISO));
  let streak = 0;
  let cursor = todayISO();
  // Allow today to be "in progress" — start counting from today if present,
  // otherwise check if yesterday keeps a streak alive.
  if (!days.has(cursor)) {
    cursor = daysAgoISO(1);
    if (!days.has(cursor)) return 0;
  }
  while (days.has(cursor)) {
    streak++;
    cursor = daysAgoISOFrom(cursor, 1);
  }
  return streak;
}

function daysAgoISOFrom(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function renderDashboard(container, goToTab) {
  const profile = currentProfile();
  const weightLog = getWeightLog();
  const vitalsLog = getVitalsLog();
  const activityLog = getActivityLog();
  const hrLog = getHrLog();

  const latestWeight = weightLog[0];
  const bmiValue = latestWeight ? bmi(latestWeight.kg, profile.heightCm) : null;
  const bmiCat = bmiCategory(bmiValue);

  const todayActivity = activityLog.find((a) => a.dateISO === todayISO());
  const steps = todayActivity ? todayActivity.steps || 0 : 0;
  const stepGoal = profile.stepGoal || DEFAULT_STEP_GOAL;
  const stepPct = Math.min(100, Math.round((steps / stepGoal) * 100));

  const latestHr = hrLog[0];
  const hrCat = latestHr ? restingHrCategory(latestHr.bpm) : null;

  const latestBp = vitalsLog.find((v) => v.sys != null);
  const bpCat = latestBp ? bpCategory(latestBp.sys, latestBp.dia) : null;

  const streak = exerciseStreak();
  const age = profile.dobISO ? ageFromDOB(profile.dobISO) : null;

  container.innerHTML = `
    <div class="view-header">
      <h2>Today</h2>
      <p class="subtitle">${formatDateShort(todayISO())}${age != null ? ` · age ${age}` : ""}</p>
    </div>

    <div class="stat-grid">
      <div class="stat-tile ${latestWeight ? "" : "empty"}" data-goto="weight">
        <div class="stat-label">Weight</div>
        <div class="stat-value">${latestWeight ? `${round(latestWeight.kg, 1)}<span class="unit">kg</span>` : "Log one →"}</div>
        <div class="stat-sub">${bmiCat ? `BMI ${round(bmiValue, 1)} · ${bmiCat.label}` : latestWeight ? `BMI needs height in Profile` : ""}</div>
      </div>

      <div class="stat-tile accent-good" data-goto="activity">
        <div class="stat-label">Steps today</div>
        <div class="stat-value">${steps.toLocaleString()}<span class="unit">/ ${stepGoal.toLocaleString()}</span></div>
        <div class="progress-bar-track" style="margin-top:0.4rem;"><div class="progress-bar-fill ${stepPct >= 100 ? "over" : ""}" style="width:${stepPct}%"></div></div>
      </div>

      <div class="stat-tile ${streak > 0 ? "accent-good" : "empty"}" data-goto="exercises">
        <div class="stat-label">Exercise streak</div>
        <div class="stat-value">${streak > 0 ? `${streak}<span class="unit">day${streak === 1 ? "" : "s"}</span>` : "Start today →"}</div>
      </div>

      <div class="stat-tile ${latestHr ? "accent-hr" : "empty"}" data-goto="heartrate">
        <div class="stat-label">Resting heart rate</div>
        <div class="stat-value">${latestHr ? `${latestHr.bpm}<span class="unit">bpm</span>` : "Log one →"}</div>
        <div class="stat-sub">${hrCat ? hrCat.label : ""}</div>
      </div>

      <div class="stat-tile ${latestBp ? "" : "empty"}" data-goto="vitals">
        <div class="stat-label">Blood pressure</div>
        <div class="stat-value">${latestBp ? `${latestBp.sys}/${latestBp.dia}` : "Log one →"}</div>
        <div class="stat-sub">${bpCat ? bpCat.label : ""}</div>
      </div>
    </div>

    <div class="card">
      <h3>This week</h3>
      <p style="font-size:0.85rem; color:var(--text-dim); margin:0;">
        Open <strong>Activity</strong> for your weekly active-minutes goal, <strong>Exercises</strong> for home workouts with age-adjusted targets, and <strong>Screenings</strong> for preventive-care reminders.
      </p>
    </div>

    <p class="disclaimer">Personal tracking only — not medical advice. See Profile for details.</p>
  `;

  container.querySelectorAll("[data-goto]").forEach((tile) => {
    tile.style.cursor = "pointer";
    tile.addEventListener("click", () => goToTab(tile.dataset.goto));
  });
}
