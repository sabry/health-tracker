import { getMealLog, addMealEntry, deleteMealEntry, getAiSettings, saveAiSettings, getWeightLog, saveProfile } from "./storage.js";
import { currentProfile } from "./profile.js";
import { todayISO, formatDateShort, formatDateTime, round, estimateDailyCalorieTarget, escapeHtml, ageFromDOB } from "./util.js";
import { renderLineChart } from "./charts.js";
import { showToast } from "./ui.js";
import { COMMON_FOODS, findFoodMatch } from "./foodDatabase.js";

// ---------------- Camera meal-photo analyzer ----------------
//
// This calls Claude's API directly from the browser (Anthropic's
// "anthropic-dangerous-direct-browser-access" CORS support) to identify
// what's on a plate and estimate calories/macros. It's explicitly opt-in:
// nothing here runs, and no network request happens, until you paste in
// your own Anthropic API key below.
//
// Two things worth knowing, named plainly rather than buried:
//  1. Your API key lives in this browser's local storage and is sent as a
//     request header on every analysis — visible to anyone with access to
//     this device/browser's dev tools. Fine for a personal device only you
//     use; don't paste a key here on a shared or public computer.
//  2. Each photo analyzed is a small, metered API call (a few cents at
//     most with the default fast model) — this is the one feature in this
//     app that costs money and needs an internet connection.
//
// Calorie/macro numbers are the model's best visual estimate from a single
// photo, not a lab measurement — treat them as "roughly this," useful for
// spotting patterns over time, not as precise nutrition facts.

const MODEL_OPTIONS = [
  { value: "claude-haiku-4-5", label: "Haiku — fast & inexpensive (recommended default)" },
  { value: "claude-sonnet-5", label: "Sonnet — more accurate, costs a bit more" },
  { value: "claude-opus-5", label: "Opus — most accurate, priciest" },
];

const ANALYSIS_PROMPT = `You are analyzing a photo of a meal for a personal nutrition-tracking app. Identify each distinct food item visible, estimate its portion size in plain household terms (e.g. "1 cup", "3 oz", "1 medium", "2 slices"), and estimate calories and macronutrients for that portion using your best judgment of typical nutritional values for that food and portion size. Note in "notes" anything that limits your confidence (unclear portion, hidden ingredients, sauces you can't fully see, etc.) — be honest that this is a rough visual estimate, not a precise measurement.

Respond with ONLY valid JSON — no markdown code fences, no other text before or after — in exactly this shape:
{"items": [{"name": string, "portion": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}], "notes": string}`;

async function analyzeMealPhoto(base64Jpeg, settings) {
  if (!settings.apiKey) {
    throw new Error("Add your Anthropic API key in the settings above first.");
  }
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: settings.model || "claude-haiku-4-5",
        max_tokens: 1200,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
              { type: "text", text: ANALYSIS_PROMPT },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    throw new Error("Couldn't reach Claude's API — check your internet connection and try again.");
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error("That API key was rejected — double-check it in the settings above.");
    if (response.status === 429) throw new Error("Rate limited by the API — wait a moment and try again.");
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message ? `: ${errJson.error.message}` : "";
    } catch (e) {}
    throw new Error(`Claude's API returned an error (${response.status})${detail}.`);
  }

  const data = await response.json();
  const text = (data.content || []).map((b) => b.text || "").join("").trim();
  let parsed;
  try {
    const jsonText = text.startsWith("{") ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error("Couldn't parse meal analysis response:", text);
    throw new Error("Got a response but couldn't parse it as food data — you can enter this meal manually instead.");
  }
  if (!Array.isArray(parsed.items)) throw new Error("The analysis didn't include any recognizable food items — try a clearer photo, or enter this meal manually.");
  return parsed;
}

// Resize a source canvas down to a max dimension and return a base64 JPEG
// (no data: prefix) at the given quality — keeps API payload size and
// stored-thumbnail size small.
function resizeToBase64Jpeg(sourceCanvas, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(sourceCanvas.width, sourceCanvas.height));
  const w = Math.round(sourceCanvas.width * scale);
  const h = Math.round(sourceCanvas.height * scale);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d").drawImage(sourceCanvas, 0, 0, w, h);
  const dataUrl = out.toDataURL("image/jpeg", quality);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function sumItems(items) {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + (Number(it.calories) || 0),
      proteinG: acc.proteinG + (Number(it.protein_g ?? it.proteinG) || 0),
      carbsG: acc.carbsG + (Number(it.carbs_g ?? it.carbsG) || 0),
      fatG: acc.fatG + (Number(it.fat_g ?? it.fatG) || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}

export function renderMealsView(container) {
  const profile = currentProfile();
  const age = profile.dobISO ? ageFromDOB(profile.dobISO) : null;
  const aiSettings = getAiSettings();
  const latestWeight = getWeightLog()[0];
  const suggestedGoal = estimateDailyCalorieTarget({ kg: latestWeight ? latestWeight.kg : null, cm: profile.heightCm, age, sex: profile.sex });

  container.innerHTML = `
    <div class="view-header">
      <h2>Meals</h2>
      <p class="subtitle">Snap a photo before you eat and Claude will inventory the plate and estimate calories/macros — or log a meal manually. Estimates are a rough visual read, not lab measurements.</p>
    </div>

    <div class="card">
      <h3>AI food analysis settings</h3>
      <div class="form-grid">
        <div class="field" style="flex:2; min-width:220px;">
          <label for="meal-api-key">Anthropic API key</label>
          <input type="password" id="meal-api-key" placeholder="sk-ant-..." value="${aiSettings.apiKey ? aiSettings.apiKey : ""}" autocomplete="off" />
        </div>
        <div class="field">
          <label for="meal-model">Model</label>
          <select id="meal-model">
            ${MODEL_OPTIONS.map((m) => `<option value="${m.value}" ${(aiSettings.model || MODEL_OPTIONS[0].value) === m.value ? "selected" : ""}>${m.label}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="min-width:auto;">
          <button id="meal-save-settings" class="btn btn-sm">Save</button>
        </div>
      </div>
      <p class="field hint" style="margin-top:0.5rem;">
        Stored only in this browser, on this device — never included in your data backup export. Sent directly from your phone to Anthropic's API for each photo you analyze; nothing passes through any other server. Each analysis is a small metered API call and needs internet access.
      </p>
    </div>

    <div class="card">
      <h3>Log a meal from a photo</h3>
      <div class="camera-hr-box">
        <div class="camera-preview-wrap" id="meal-camera-wrap">
          <video id="meal-video" muted playsinline></video>
        </div>
        <canvas id="meal-canvas" style="display:none;"></canvas>
        <p class="timer-note" id="meal-camera-note">Tap "Open camera," frame the plate, then "Take photo."</p>
        <div class="btn-row" id="meal-camera-controls">
          <button id="meal-cam-open" class="btn btn-primary">📷 Open camera</button>
          <button id="meal-cam-shoot" class="btn" disabled>Take photo</button>
          <button id="meal-cam-retake" class="btn" disabled>Retake</button>
          <button id="meal-cam-analyze" class="btn btn-primary" disabled>Analyze photo</button>
        </div>
      </div>
      <div id="meal-review" class="hidden"></div>
    </div>

    <div class="card">
      <h3>Log a meal manually</h3>
      <p class="field hint" style="margin-top:-0.2rem;">Start typing a common food (e.g. "banana") and pick it from the suggestions — calories and macros fill in automatically, scaled by servings. Anything not in the list still works, just enter the numbers yourself.</p>
      <form id="meal-manual-form">
        <div class="form-grid">
          <div class="field" style="flex:2; min-width:200px;">
            <label for="mm-name">What did you eat</label>
            <input type="text" id="mm-name" list="mm-food-list" placeholder="e.g. chicken sandwich" required autocomplete="off" />
            <datalist id="mm-food-list">
              ${COMMON_FOODS.map((f) => `<option value="${escapeHtml(f.name)}"></option>`).join("")}
            </datalist>
          </div>
          <div class="field" style="max-width:110px;">
            <label for="mm-servings">Servings</label>
            <input type="number" id="mm-servings" min="0.25" max="20" step="0.25" value="1" />
          </div>
          <div class="field">
            <label for="mm-cal">Calories</label>
            <input type="number" id="mm-cal" min="0" max="5000" step="any" required placeholder="e.g. 450" />
          </div>
          <div class="field">
            <label for="mm-protein">Protein (g)</label>
            <input type="number" id="mm-protein" min="0" max="400" step="any" placeholder="optional" />
          </div>
          <div class="field">
            <label for="mm-carbs">Carbs (g)</label>
            <input type="number" id="mm-carbs" min="0" max="600" step="any" placeholder="optional" />
          </div>
          <div class="field">
            <label for="mm-fat">Fat (g)</label>
            <input type="number" id="mm-fat" min="0" max="300" step="any" placeholder="optional" />
          </div>
          <div class="field" style="min-width:auto;">
            <button type="submit" class="btn btn-primary">Log</button>
          </div>
        </div>
        <p class="field hint" id="mm-match-hint" style="margin-top:0.5rem; display:none;"></p>
      </form>
    </div>

    <div class="card">
      <h3>Today</h3>
      <div id="meal-today-stats"></div>
    </div>

    <div class="card">
      <h3>Daily calorie target</h3>
      <div class="form-grid">
        <div class="field">
          <label for="calorie-goal">Target (kcal/day)</label>
          <input type="number" id="calorie-goal" min="800" max="6000" step="50" value="${profile.calorieGoal || suggestedGoal || ""}" />
        </div>
        <div class="field" style="min-width:auto;">
          <button id="save-calorie-goal" class="btn btn-sm">Save</button>
        </div>
      </div>
      <p class="field hint" style="margin-top:0.5rem;">${suggestedGoal ? `Rough starting estimate from your profile (Mifflin-St Jeor, lightly active): ~${suggestedGoal} kcal/day. ` : ""}This is a general estimate, not a prescription — use a number from your doctor or a dietitian if you have one.</p>
    </div>

    <div class="card">
      <h3>Calories — last 30 days</h3>
      <div id="meal-chart"></div>
    </div>

    <div class="card">
      <h3>History</h3>
      <ul class="log-list" id="meal-log-list"></ul>
    </div>

    <p class="disclaimer">AI-estimated calories and macros are a rough visual read from a photo, not a lab measurement or medical advice — accuracy varies with lighting, portion visibility, and hidden ingredients (sauces, oils, dressings). Useful for spotting patterns over time; if you're managing a specific medical condition or diet, verify with actual nutrition labels or a dietitian.</p>
  `;

  // ---- Settings ----
  container.querySelector("#meal-save-settings").addEventListener("click", () => {
    const apiKey = container.querySelector("#meal-api-key").value.trim();
    const model = container.querySelector("#meal-model").value;
    saveAiSettings({ apiKey, model });
    showToast("Settings saved");
  });

  // ---- Calorie goal ----
  container.querySelector("#save-calorie-goal").addEventListener("click", () => {
    const value = parseInt(container.querySelector("#calorie-goal").value, 10);
    saveProfile({ ...currentProfile(), calorieGoal: value || undefined });
    showToast("Calorie target saved");
    refresh();
  });

  // ---- Camera capture ----
  const video = container.querySelector("#meal-video");
  const wrap = container.querySelector("#meal-camera-wrap");
  const canvas = container.querySelector("#meal-canvas");
  const noteEl = container.querySelector("#meal-camera-note");
  const openBtn = container.querySelector("#meal-cam-open");
  const shootBtn = container.querySelector("#meal-cam-shoot");
  const retakeBtn = container.querySelector("#meal-cam-retake");
  const analyzeBtn = container.querySelector("#meal-cam-analyze");
  const reviewEl = container.querySelector("#meal-review");

  let stream = null;
  let capturedCanvas = null; // full-res captured frame, kept only in memory

  async function openCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      video.srcObject = stream;
      video.style.display = "";
      await video.play();
      openBtn.disabled = true;
      shootBtn.disabled = false;
      retakeBtn.disabled = true;
      analyzeBtn.disabled = true;
      noteEl.textContent = "Frame the plate, then tap \"Take photo.\"";
    } catch (err) {
      noteEl.textContent = "Couldn't access the camera (" + err.message + "). You can log this meal manually below instead.";
    }
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  shootBtn.addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    capturedCanvas = canvas;
    stopStream();
    video.style.display = "none";
    // Show the captured frame as a still preview in place of the video.
    wrap.querySelectorAll("img.meal-shot-preview").forEach((n) => n.remove());
    const img = document.createElement("img");
    img.className = "meal-shot-preview";
    img.src = canvas.toDataURL("image/jpeg", 0.85);
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    wrap.appendChild(img);

    shootBtn.disabled = true;
    retakeBtn.disabled = false;
    analyzeBtn.disabled = false;
    noteEl.textContent = "Looks good? Tap \"Analyze photo,\" or \"Retake\" for another shot.";
  });

  retakeBtn.addEventListener("click", () => {
    wrap.querySelectorAll("img.meal-shot-preview").forEach((n) => n.remove());
    capturedCanvas = null;
    reviewEl.classList.add("hidden");
    reviewEl.innerHTML = "";
    openCamera();
  });

  openBtn.addEventListener("click", openCamera);

  analyzeBtn.addEventListener("click", async () => {
    if (!capturedCanvas) return;
    const settings = getAiSettings();
    analyzeBtn.disabled = true;
    retakeBtn.disabled = true;
    noteEl.textContent = "Analyzing photo…";
    try {
      const fullResBase64 = resizeToBase64Jpeg(capturedCanvas, 1024, 0.75);
      const thumbBase64 = resizeToBase64Jpeg(capturedCanvas, 120, 0.55);
      const result = await analyzeMealPhoto(fullResBase64, settings);
      showReview(result.items, result.notes, `data:image/jpeg;base64,${thumbBase64}`);
      noteEl.textContent = "Review the estimate below, edit anything that looks off, then save.";
    } catch (err) {
      noteEl.textContent = err.message;
      showToast("Analysis failed");
    } finally {
      analyzeBtn.disabled = false;
      retakeBtn.disabled = false;
    }
  });

  function showReview(items, notes, thumbnailDataUrl) {
    reviewEl.classList.remove("hidden");
    const rows = items
      .map(
        (it, i) => `
      <div class="meal-item-row" data-i="${i}">
        <input type="text" class="mi-name" value="${escapeHtml(it.name || "")}" placeholder="food" />
        <input type="text" class="mi-portion" value="${escapeHtml(it.portion || "")}" placeholder="portion" />
        <input type="number" class="mi-cal" value="${Math.round(it.calories || 0)}" min="0" placeholder="kcal" />
        <input type="number" class="mi-protein" value="${Math.round(it.protein_g || 0)}" min="0" placeholder="protein g" />
        <input type="number" class="mi-carbs" value="${Math.round(it.carbs_g || 0)}" min="0" placeholder="carbs g" />
        <input type="number" class="mi-fat" value="${Math.round(it.fat_g || 0)}" min="0" placeholder="fat g" />
        <button type="button" class="log-del mi-remove" title="Remove">✕</button>
      </div>`
      )
      .join("");

    reviewEl.innerHTML = `
      <div class="meal-review-box">
        <div class="meal-item-row meal-item-header">
          <span>Food</span><span>Portion</span><span>Kcal</span><span>Protein</span><span>Carbs</span><span>Fat</span><span></span>
        </div>
        ${rows}
        <div class="btn-row" style="margin-top:0.5rem;">
          <button type="button" id="meal-add-row" class="btn btn-sm">+ Add item</button>
        </div>
        ${notes ? `<p class="field hint" style="margin-top:0.6rem;"><strong>Model notes:</strong> ${escapeHtml(notes)}</p>` : ""}
        <div class="stat-tile" style="max-width:260px; margin-top:0.8rem;">
          <div class="stat-label">Total</div>
          <div class="stat-value" id="meal-review-total">0<span class="unit">kcal</span></div>
        </div>
        <div class="btn-row">
          <button type="button" id="meal-save-review" class="btn btn-primary">Save meal</button>
          <button type="button" id="meal-discard-review" class="btn btn-danger-outline">Discard</button>
        </div>
      </div>
    `;

    function readRows() {
      return Array.from(reviewEl.querySelectorAll(".meal-item-row:not(.meal-item-header)")).map((row) => ({
        name: row.querySelector(".mi-name").value.trim(),
        portion: row.querySelector(".mi-portion").value.trim(),
        calories: parseFloat(row.querySelector(".mi-cal").value) || 0,
        protein_g: parseFloat(row.querySelector(".mi-protein").value) || 0,
        carbs_g: parseFloat(row.querySelector(".mi-carbs").value) || 0,
        fat_g: parseFloat(row.querySelector(".mi-fat").value) || 0,
      }));
    }

    function updateTotal() {
      const totals = sumItems(readRows());
      reviewEl.querySelector("#meal-review-total").innerHTML = `${Math.round(totals.calories)}<span class="unit">kcal</span>`;
    }

    reviewEl.addEventListener("input", updateTotal);
    reviewEl.querySelectorAll(".mi-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.closest(".meal-item-row").remove();
        updateTotal();
      });
    });
    reviewEl.querySelector("#meal-add-row").addEventListener("click", () => {
      const div = document.createElement("div");
      div.className = "meal-item-row";
      div.innerHTML = `
        <input type="text" class="mi-name" placeholder="food" />
        <input type="text" class="mi-portion" placeholder="portion" />
        <input type="number" class="mi-cal" min="0" placeholder="kcal" />
        <input type="number" class="mi-protein" min="0" placeholder="protein g" />
        <input type="number" class="mi-carbs" min="0" placeholder="carbs g" />
        <input type="number" class="mi-fat" min="0" placeholder="fat g" />
        <button type="button" class="log-del mi-remove" title="Remove">✕</button>
      `;
      reviewEl.querySelector("#meal-add-row").before(div);
      div.querySelector(".mi-remove").addEventListener("click", () => {
        div.remove();
        updateTotal();
      });
    });

    reviewEl.querySelector("#meal-discard-review").addEventListener("click", () => {
      reviewEl.classList.add("hidden");
      reviewEl.innerHTML = "";
      wrap.querySelectorAll("img.meal-shot-preview").forEach((n) => n.remove());
      capturedCanvas = null;
      openBtn.disabled = false;
      shootBtn.disabled = true;
      retakeBtn.disabled = true;
      analyzeBtn.disabled = true;
      noteEl.textContent = "Tap \"Open camera,\" frame the plate, then \"Take photo.\"";
    });

    reviewEl.querySelector("#meal-save-review").addEventListener("click", () => {
      const items = readRows().filter((it) => it.name);
      if (!items.length) {
        showToast("Add at least one item");
        return;
      }
      const totals = sumItems(items);
      addMealEntry({
        dateISO: todayISO(),
        items,
        totalCalories: Math.round(totals.calories),
        totalProteinG: Math.round(totals.proteinG),
        totalCarbsG: Math.round(totals.carbsG),
        totalFatG: Math.round(totals.fatG),
        thumbnail: thumbnailDataUrl,
        source: "camera",
      });
      showToast("Meal logged");
      reviewEl.querySelector("#meal-discard-review").click();
      refresh();
    });

    updateTotal();
  }

  // ---- Manual entry: auto-fill from the common-foods reference table ----
  const mmForm = container.querySelector("#meal-manual-form");
  const mmName = container.querySelector("#mm-name");
  const mmServings = container.querySelector("#mm-servings");
  const mmCal = container.querySelector("#mm-cal");
  const mmProtein = container.querySelector("#mm-protein");
  const mmCarbs = container.querySelector("#mm-carbs");
  const mmFat = container.querySelector("#mm-fat");
  const mmHint = container.querySelector("#mm-match-hint");

  function applyFoodMatch() {
    const match = findFoodMatch(mmName.value);
    if (!match) {
      mmHint.style.display = "none";
      mmHint.textContent = "";
      return;
    }
    const servings = parseFloat(mmServings.value) || 1;
    mmCal.value = round(match.calories * servings, 0);
    mmProtein.value = round(match.proteinG * servings, 1);
    mmCarbs.value = round(match.carbsG * servings, 1);
    mmFat.value = round(match.fatG * servings, 1);
    mmHint.style.display = "";
    const isExact = match.name.trim().toLowerCase() === mmName.value.trim().toLowerCase();
    mmHint.textContent = `${isExact ? "Matched" : "Closest match:"} "${match.name}" — ${match.portion} = ${match.calories} kcal, ${match.proteinG}g protein, ${match.carbsG}g carbs, ${match.fatG}g fat. Filled in for ${servings} serving${servings === 1 ? "" : "s"} — edit any field if yours differs, or if this isn't the right food.`;
  }

  mmName.addEventListener("input", applyFoodMatch);
  mmName.addEventListener("change", applyFoodMatch);
  mmServings.addEventListener("input", applyFoodMatch);

  mmForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const match = findFoodMatch(mmName.value);
    const servings = parseFloat(mmServings.value) || 1;
    // Use the matched food's canonical name (not necessarily what was typed
    // — matching is approximate) so the log stays accurate even after a
    // typo or partial-name match.
    const name = match ? `${match.name}${servings !== 1 ? ` (x${servings})` : ""}` : mmName.value.trim();
    const calories = parseFloat(mmCal.value) || 0;
    const proteinG = parseFloat(mmProtein.value) || 0;
    const carbsG = parseFloat(mmCarbs.value) || 0;
    const fatG = parseFloat(mmFat.value) || 0;
    addMealEntry({
      dateISO: todayISO(),
      items: [{ name, portion: match ? match.portion : "", calories, protein_g: proteinG, carbs_g: carbsG, fat_g: fatG }],
      totalCalories: Math.round(calories),
      totalProteinG: Math.round(proteinG),
      totalCarbsG: Math.round(carbsG),
      totalFatG: Math.round(fatG),
      source: "manual",
    });
    mmForm.reset();
    mmHint.style.display = "none";
    mmHint.textContent = "";
    showToast("Meal logged");
    refresh();
  });

  // ---- Refresh: today stats, chart, history ----
  function refresh() {
    const log = getMealLog();
    const p = currentProfile();

    const todayEntries = log.filter((e) => e.dateISO === todayISO());
    const todayTotals = todayEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.totalCalories || 0),
        proteinG: acc.proteinG + (e.totalProteinG || 0),
        carbsG: acc.carbsG + (e.totalCarbsG || 0),
        fatG: acc.fatG + (e.totalFatG || 0),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
    const goal = p.calorieGoal;
    const pct = goal ? Math.min(100, Math.round((todayTotals.calories / goal) * 100)) : null;

    container.querySelector("#meal-today-stats").innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="stat-label">Calories</div>
          <div class="stat-value">${todayTotals.calories}${goal ? `<span class="unit">/ ${goal}</span>` : ""}</div>
          ${goal ? `<div class="progress-bar-track" style="margin-top:0.4rem;"><div class="progress-bar-fill ${pct >= 100 ? "over" : ""}" style="width:${pct}%"></div></div>` : ""}
        </div>
        <div class="stat-tile">
          <div class="stat-label">Protein</div>
          <div class="stat-value">${todayTotals.proteinG}<span class="unit">g</span></div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Carbs</div>
          <div class="stat-value">${todayTotals.carbsG}<span class="unit">g</span></div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Fat</div>
          <div class="stat-value">${todayTotals.fatG}<span class="unit">g</span></div>
        </div>
      </div>
    `;

    // 30-day daily-total chart
    const byDay = {};
    log.forEach((e) => {
      byDay[e.dateISO] = (byDay[e.dateISO] || 0) + (e.totalCalories || 0);
    });
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, value: byDay[iso] || null });
    }
    renderLineChart(container.querySelector("#meal-chart"), days.filter((d) => d.value != null), {
      goal: p.calorieGoal,
      tooltipValue: (v) => `${Math.round(v)} kcal`,
      emptyText: "No meals logged in the last 30 days.",
    });

    // History
    const listEl = container.querySelector("#meal-log-list");
    if (!log.length) {
      listEl.innerHTML = `<li class="log-empty">Nothing logged yet.</li>`;
    } else {
      listEl.innerHTML = log
        .slice(0, 60)
        .map((e) => {
          const itemNames = (e.items || []).map((it) => it.name).filter(Boolean).join(", ");
          return `
        <li class="log-item" style="align-items:center;">
          <div class="log-main" style="align-items:center;">
            ${e.thumbnail ? `<img src="${e.thumbnail}" alt="" style="width:36px; height:36px; object-fit:cover; border-radius:6px; margin-right:0.4rem;" />` : ""}
            <span class="log-value">${e.totalCalories || 0} kcal</span>
            <span class="log-note">${escapeHtml(itemNames)}</span>
            <span class="log-date">${formatDateTime(e.createdAt || Date.now())} ${e.source === "camera" ? "· photo" : "· manual"}</span>
          </div>
          <button class="log-del" data-id="${e.id}" title="Delete">✕</button>
        </li>`;
        })
        .join("");
      listEl.querySelectorAll(".log-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          deleteMealEntry(btn.dataset.id);
          refresh();
        });
      });
    }
  }

  refresh();
}
