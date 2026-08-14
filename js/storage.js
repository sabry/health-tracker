// localStorage-backed data store. Everything lives on this device only —
// nothing is sent anywhere. Use exportBackup()/importBackup() to move data
// between devices or keep a backup file.

import { uid, todayISO } from "./util.js";

const PREFIX = "healthtracker.";

const KEYS = {
  profile: PREFIX + "profile",
  weight: PREFIX + "weightLog",
  vitals: PREFIX + "vitalsLog",
  activity: PREFIX + "activityLog",
  exerciseLog: PREFIX + "exerciseLog",
  hr: PREFIX + "hrLog",
  screenings: PREFIX + "screeningState",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("storage read failed for", key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage write failed for", key, e);
  }
}

// ---- Profile ----

export function getProfile() {
  return readJSON(KEYS.profile, null);
}

export function saveProfile(profile) {
  writeJSON(KEYS.profile, profile);
}

// ---- Generic log helpers (array of entries with id + dateISO) ----

function getLog(key) {
  return readJSON(key, []);
}

function addEntry(key, entry) {
  const log = getLog(key);
  const full = { id: uid(), createdAt: Date.now(), ...entry };
  log.push(full);
  log.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : b.createdAt - a.createdAt));
  writeJSON(key, log);
  return full;
}

function deleteEntry(key, id) {
  const log = getLog(key).filter((e) => e.id !== id);
  writeJSON(key, log);
}

// Weight: { dateISO, kg, note? }
export const getWeightLog = () => getLog(KEYS.weight);
export const addWeightEntry = (e) => addEntry(KEYS.weight, e);
export const deleteWeightEntry = (id) => deleteEntry(KEYS.weight, id);

// Vitals: { dateISO, sys?, dia?, waistCm?, sleepHours? }
export const getVitalsLog = () => getLog(KEYS.vitals);
export const addVitalsEntry = (e) => addEntry(KEYS.vitals, e);
export const deleteVitalsEntry = (id) => deleteEntry(KEYS.vitals, id);

// Activity: { dateISO, steps?, activeMinutes?, source }
export const getActivityLog = () => getLog(KEYS.activity);
export const deleteActivityEntry = (id) => deleteEntry(KEYS.activity, id);
export function upsertActivityForDay(dateISO, patch) {
  const log = getActivityLog();
  const existing = log.find((e) => e.dateISO === dateISO);
  if (existing) {
    Object.assign(existing, patch);
    writeJSON(KEYS.activity, log);
    return existing;
  }
  return addEntry(KEYS.activity, { dateISO, steps: 0, activeMinutes: 0, ...patch });
}
export function addStepsToday(steps) {
  const dateISO = todayISO();
  const log = getActivityLog();
  const existing = log.find((e) => e.dateISO === dateISO);
  if (existing) {
    existing.steps = (existing.steps || 0) + steps;
    writeJSON(KEYS.activity, log);
    return existing;
  }
  return addEntry(KEYS.activity, { dateISO, steps, activeMinutes: 0, source: "sensor" });
}

// Merge a live-tracked walk (sensor steps + elapsed minutes) into today's entry.
export function addWalkSession(steps, minutes) {
  const dateISO = todayISO();
  const log = getActivityLog();
  const existing = log.find((e) => e.dateISO === dateISO);
  if (existing) {
    existing.steps = (existing.steps || 0) + steps;
    existing.activeMinutes = round2((existing.activeMinutes || 0) + minutes);
    existing.source = "sensor";
    writeJSON(KEYS.activity, log);
    return existing;
  }
  return addEntry(KEYS.activity, { dateISO, steps, activeMinutes: round2(minutes), source: "sensor" });
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// Exercise log: { dateISO, exerciseId, reps?, seconds?, sets? }
export const getExerciseLog = () => getLog(KEYS.exerciseLog);
export const addExerciseEntry = (e) => addEntry(KEYS.exerciseLog, e);
export const deleteExerciseEntry = (id) => deleteEntry(KEYS.exerciseLog, id);

// HR: { dateISO, bpm, method, context }
export const getHrLog = () => getLog(KEYS.hr);
export const addHrEntry = (e) => addEntry(KEYS.hr, e);
export const deleteHrEntry = (id) => deleteEntry(KEYS.hr, id);

// Screenings: { [itemId]: { done, doneDate } }
export function getScreeningState() {
  return readJSON(KEYS.screenings, {});
}
export function setScreeningState(itemId, patch) {
  const state = getScreeningState();
  state[itemId] = { ...state[itemId], ...patch };
  writeJSON(KEYS.screenings, state);
  return state[itemId];
}

// ---- Backup / restore ----

export function exportBackup() {
  const data = {};
  Object.entries(KEYS).forEach(([name, key]) => {
    data[name] = readJSON(key, name === "profile" || name === "screenings" ? {} : []);
  });
  data.exportedAt = new Date().toISOString();
  return data;
}

export function importBackup(data) {
  Object.entries(KEYS).forEach(([name, key]) => {
    if (data[name] !== undefined) writeJSON(key, data[name]);
  });
}
