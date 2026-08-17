// Small shared helpers: dates, ids, formatting, health-math.

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO() {
  return dateToISO(new Date());
}

export function dateToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoToDate(iso) {
  // Treat as local date, not UTC midnight, so day boundaries match the
  // user's clock.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateToISO(d);
}

export function daysBetween(isoA, isoB) {
  const a = isoToDate(isoA).getTime();
  const b = isoToDate(isoB).getTime();
  return Math.round((b - a) / 86400000);
}

export function formatDateShort(iso) {
  const d = isoToDate(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateFull(iso) {
  const d = isoToDate(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function ageFromDOB(dobISO, atISO) {
  const dob = isoToDate(dobISO);
  const at = atISO ? isoToDate(atISO) : new Date();
  let age = at.getFullYear() - dob.getFullYear();
  const m = at.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) age--;
  return age;
}

export function daysUntilBirthday(dobISO) {
  const dob = isoToDate(dobISO);
  const now = new Date();
  let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
  }
  return Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}

// ---- Health math ----

export function bmi(kg, cm) {
  if (!kg || !cm) return null;
  const m = cm / 100;
  return kg / (m * m);
}

// Weight is always stored in kg internally (everything else — BMI, calorie
// math — assumes kg) so these are purely for display/entry in lbs.
const KG_PER_LB = 0.45359237;
export function kgToLbs(kg) {
  return kg / KG_PER_LB;
}
export function lbsToKg(lbs) {
  return lbs * KG_PER_LB;
}

export function bmiCategory(value) {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 18.5) return { label: "Underweight", tone: "warn" };
  if (value < 25) return { label: "Healthy range", tone: "good" };
  if (value < 30) return { label: "Overweight", tone: "warn" };
  return { label: "Obesity range", tone: "danger" };
}

// Mifflin-St Jeor equation — a commonly used, reasonably well-validated
// estimate of resting energy needs (BMR), then scaled up for activity level
// to suggest a daily calorie target. This is a starting point, not a
// prescription — actual needs vary by individual, and anyone with a
// specific medical or weight goal should get a number from their doctor or
// a dietitian instead.
export function estimateDailyCalorieTarget({ kg, cm, age, sex, activityFactor = 1.375 }) {
  if (!kg || !cm || !age) return null;
  const sexOffset = sex === "female" ? -161 : 5;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + sexOffset;
  return Math.round(bmr * activityFactor);
}

// Rough MET-based calorie estimate for walking: kcal = MET x 3.5 x kg / 200 x
// minutes (the standard ACSM formula). Uses tracked active minutes when
// available; if only a step count was logged (e.g. manual entry with no
// minutes), falls back to assuming a ~100 steps/minute walking cadence —
// a commonly used estimate for an average adult pace — to derive minutes.
// MET 3.5 is a moderate ("normal pace") walk; this is a ballpark, not a
// measurement, since actual effort varies with pace, terrain, and incline.
export function estimateWalkingCalories({ steps = 0, activeMinutes = 0, weightKg }) {
  if (!weightKg) return 0;
  const MET_WALK = 3.5;
  const minutes = activeMinutes > 0 ? activeMinutes : steps > 0 ? steps / 100 : 0;
  if (!minutes) return 0;
  return ((MET_WALK * 3.5 * weightKg) / 200) * minutes;
}

// Tanaka et al. (2001) age-predicted max heart rate — tracks better than
// 220-age for older adults.
export function hrMax(age) {
  return Math.round(208 - 0.7 * age);
}

export function hrZones(age) {
  const max = hrMax(age);
  return {
    max,
    zones: [
      { label: "Light", pct: [0.5, 0.6], lo: Math.round(max * 0.5), hi: Math.round(max * 0.6) },
      { label: "Moderate", pct: [0.6, 0.7], lo: Math.round(max * 0.6), hi: Math.round(max * 0.7) },
      { label: "Weight control / brisk", pct: [0.7, 0.8], lo: Math.round(max * 0.7), hi: Math.round(max * 0.8) },
      { label: "Vigorous / cardio", pct: [0.8, 0.9], lo: Math.round(max * 0.8), hi: Math.round(max * 0.9) },
    ],
  };
}

export function restingHrCategory(bpm) {
  if (bpm == null) return null;
  if (bpm < 50) return { label: "Very low (athletic or check with a doctor)", tone: "warn" };
  if (bpm <= 60) return { label: "Excellent", tone: "good" };
  if (bpm <= 70) return { label: "Good", tone: "good" };
  if (bpm <= 80) return { label: "Average", tone: "neutral" };
  if (bpm <= 100) return { label: "Above average", tone: "warn" };
  return { label: "High — consider a doctor visit", tone: "danger" };
}

// AHA 2017 blood-pressure categories.
export function bpCategory(sys, dia) {
  if (sys == null || dia == null) return null;
  if (sys >= 180 || dia >= 120) return { label: "Hypertensive crisis — seek care", tone: "danger" };
  if (sys >= 140 || dia >= 90) return { label: "High (Stage 2)", tone: "danger" };
  if (sys >= 130 || dia >= 80) return { label: "High (Stage 1)", tone: "warn" };
  if (sys >= 120) return { label: "Elevated", tone: "warn" };
  return { label: "Normal", tone: "good" };
}

export function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function round(v, dp = 1) {
  if (v == null) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function weekStartISO(iso) {
  const d = isoToDate(iso);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  return dateToISO(d);
}
