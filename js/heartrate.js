import { getHrLog, addHrEntry, deleteHrEntry } from "./storage.js";
import { currentProfile } from "./profile.js";
import { hrZones, restingHrCategory, todayISO, formatDateShort, ageFromDOB, escapeHtml } from "./util.js";
import { renderLineChart } from "./charts.js";
import { showToast } from "./ui.js";

// ---------------- Camera-based pulse reader (PPG) ----------------
//
// Classic phone-camera pulse trick: cover the rear camera lens (and flash,
// if present) with a fingertip. Blood volume changes with each heartbeat
// change how much light reaches the sensor, showing up as a small,
// periodic brightness ripple in the video feed. We sample the average red
// channel every frame, detrend it, and count peaks to estimate BPM.
//
// A single beat-to-beat interval is noisy (motion, a missed peak, a stray
// early one) — showing that raw "snapshot" number jumping around isn't
// useful. Instead this smooths the displayed BPM over a rolling window of
// recent beats, and separately watches how *consistent* that window is: once
// several beats in a row agree closely (low variation) for long enough, the
// reading is "stable" and we say so and stop automatically, rather than
// leaving you staring at the screen. If it never settles down, we give up
// after a timeout and say that too, instead of reading forever.
//
// This is a fun, genuinely-uses-your-phone-sensor feature, not a medical
// device — lighting, motion, and finger pressure all affect accuracy more
// than they would on a dedicated pulse oximeter.
const BEAT_WINDOW = 10; // how many recent beats we keep
const STABILITY_WINDOW = 6; // how many of the most recent beats must agree
const STABILITY_CV_THRESHOLD = 0.08; // <8% coefficient of variation = "agree"
const CONSECUTIVE_GOOD_BEATS_REQUIRED = 3; // ...and stay that consistent for this many beats in a row
const MIN_ELAPSED_MS_FOR_STABILITY = 6000; // don't declare stable too early
const MAX_READING_MS = 30000; // give up after this long either way

class CameraHR {
  constructor({ onSample, onBpm, onStable, onTimeout }) {
    this.stream = null;
    this.video = null;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 24;
    this.canvas.height = 24;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.running = false;
    this.baseline = null;
    this.rising = false;
    this.lastBeat = 0;
    this.startTime = 0;
    this.intervals = [];
    this.stableFired = false;
    this.timedOut = false;
    this.consecutiveGood = 0;
    this.onSample = onSample;
    this.onBpm = onBpm;
    this.onStable = onStable;
    this.onTimeout = onTimeout;
    this._raf = this._raf.bind(this);
  }

  async start(videoEl) {
    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 320 }, height: { ideal: 240 } },
      audio: false,
    });
    videoEl.srcObject = this.stream;
    await videoEl.play();

    const track = this.stream.getVideoTracks()[0];
    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: true }] });
      }
    } catch (e) {
      // Torch control isn't available on every device/browser — fine,
      // ambient light or the screen's glow can still work.
      console.warn("torch unavailable", e);
    }

    this.baseline = null;
    this.rising = false;
    this.intervals = [];
    this.lastBeat = 0;
    this.startTime = performance.now();
    this.stableFired = false;
    this.timedOut = false;
    this.consecutiveGood = 0;
    this.running = true;
    this._raf();
  }

  _raf() {
    if (!this.running) return;
    if (this.video.readyState >= 2) {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const frame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
      let sum = 0;
      const n = frame.length / 4;
      for (let i = 0; i < frame.length; i += 4) sum += frame[i]; // red channel
      const avg = sum / n;
      this._processSample(avg);
    }
    if (!this.stableFired && !this.timedOut && performance.now() - this.startTime > MAX_READING_MS) {
      this.timedOut = true;
      if (this.onTimeout) this.onTimeout();
    }
    requestAnimationFrame(this._raf);
  }

  _processSample(value) {
    const now = performance.now();
    if (this.baseline == null) this.baseline = value;
    this.baseline = this.baseline * 0.9 + value * 0.1;
    const deviation = value - this.baseline;
    if (this.onSample) this.onSample(deviation);

    const threshold = 0.35;
    if (!this.rising && deviation > threshold) {
      this.rising = true;
      if (this.lastBeat && now - this.lastBeat > 300 && now - this.lastBeat < 2000) {
        this.intervals.push(now - this.lastBeat);
        if (this.intervals.length > BEAT_WINDOW) this.intervals.shift();
        this._evaluate(now);
      }
      this.lastBeat = now;
    } else if (this.rising && deviation < threshold * 0.2) {
      this.rising = false;
    }
  }

  // Smooth the displayed BPM over a rolling window of beats, and separately
  // check whether that window is consistent enough to call the reading done.
  //
  // A single low-variance window isn't proof of a good signal — with enough
  // random noise, a "lucky" window of a few beats that happen to land close
  // together will turn up by chance even during a genuinely bad read. So
  // this requires the window to look good for several beats *in a row*
  // (CONSECUTIVE_GOOD_BEATS_REQUIRED), not just once — noise breaks that
  // streak almost immediately, while a real, settled pulse keeps meeting it.
  _evaluate(now) {
    if (this.intervals.length < 3) return;
    const window = this.intervals.slice(-STABILITY_WINDOW);
    const avgMs = window.reduce((a, b) => a + b, 0) / window.length;
    const bpm = Math.round(60000 / avgMs);
    if (bpm < 35 || bpm > 200) return; // garbage sample — skip it

    if (this.onBpm) this.onBpm(bpm);

    if (this.stableFired || window.length < STABILITY_WINDOW || now - this.startTime < MIN_ELAPSED_MS_FOR_STABILITY) return;

    const variance = window.reduce((a, b) => a + (b - avgMs) ** 2, 0) / window.length;
    const cv = Math.sqrt(variance) / avgMs; // coefficient of variation
    if (cv < STABILITY_CV_THRESHOLD) {
      this.consecutiveGood++;
      if (this.consecutiveGood >= CONSECUTIVE_GOOD_BEATS_REQUIRED) {
        this.stableFired = true;
        if (this.onStable) this.onStable(bpm);
      }
    } else {
      this.consecutiveGood = 0;
    }
  }

  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

export function renderHeartRateView(container) {
  const profile = currentProfile();
  const age = profile.dobISO ? ageFromDOB(profile.dobISO) : null;
  const zones = age ? hrZones(age) : null;

  container.innerHTML = `
    <div class="view-header">
      <h2>Heart rate</h2>
      <p class="subtitle">Log your resting heart rate, or measure your pulse right now with your phone's camera.</p>
    </div>

    <div class="card-row">
      <div class="card" style="flex:1.3;">
        <h3>Camera pulse reader</h3>
        <div class="camera-hr-box">
          <div class="camera-preview-wrap" id="camera-wrap">
            <video id="hr-video" muted playsinline></video>
          </div>
          <div class="hr-live-value" id="hr-live-value">— bpm</div>
          <svg class="hr-live-wave" id="hr-wave" viewBox="0 0 300 60" preserveAspectRatio="none"></svg>
          <p class="timer-note" id="hr-camera-note">Tap "Start reading" first (your browser will ask to use the camera — allow it), then lay your fingertip flat over the rear camera lens on the back of your phone, just firmly enough to block out light. Hold still for about 15–20 seconds while it finds your pulse.</p>
          <div class="btn-row">
            <button id="hr-cam-start" class="btn btn-hr">📷 Start reading</button>
            <button id="hr-cam-stop" class="btn" disabled>Stop</button>
            <button id="hr-cam-save" class="btn btn-primary" disabled>Save reading</button>
          </div>
          <details style="font-size:0.8rem; color:var(--text-dim); width:100%;">
            <summary style="cursor:pointer;">How this works / troubleshooting</summary>
            <p style="margin:0.4rem 0 0; line-height:1.5;">
              Your phone's rear camera is right next to its flash (the little LED used for photos). Covering both with your fingertip lets the app watch tiny changes in how much light comes through your finger — with each heartbeat, a fresh pulse of blood arrives and briefly changes how much light gets through. The app is just counting that flicker.
              <br><br>
              On many Android phones the app can turn the flash on for you automatically, which works best. On iPhones, Safari usually won't let a website control the flash — if you don't feel warmth/light from the flash turning on, do this in a well-lit room or near a lamp instead, still covering the lens with your finger. Keep your hand still and relaxed; movement is the most common reason a reading fails.
              <br><br>
              The bpm number is a rolling average of several recent heartbeats, not a single beat-to-beat guess, so it may drift a bit at first — that's normal. Once several beats in a row land close together, the app calls it a "stable" reading, tells you, and stops on its own so you're not left staring at the screen. If it can't settle down within 30 seconds, it stops anyway and lets you know.
            </p>
          </details>
        </div>
      </div>

      <div class="card" style="flex:1;">
        <h3>Manual log</h3>
        <form id="hr-form">
          <div class="field" style="margin-bottom:0.6rem;">
            <label for="hr-date">Date</label>
            <input type="date" id="hr-date" value="${todayISO()}" max="${todayISO()}" required />
          </div>
          <div class="field" style="margin-bottom:0.6rem;">
            <label for="hr-bpm">Heart rate (bpm)</label>
            <input type="number" id="hr-bpm" min="30" max="220" required placeholder="e.g. 64" />
          </div>
          <div class="field" style="margin-bottom:0.6rem;">
            <label for="hr-context">Context</label>
            <select id="hr-context">
              <option value="resting">Resting (first thing / seated 5+ min)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Add</button>
        </form>
        <p class="field hint" style="margin-top:0.6rem;">Best resting reading: right after waking, still lying down, count for a full 60 seconds (or use the camera reader).</p>
      </div>
    </div>

    <div class="card">
      <h3>Reference</h3>
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="stat-label">Normal resting range</div>
          <div class="stat-value" style="font-size:1.1rem;">60–100 bpm</div>
          <div class="stat-sub">Lower is often better-conditioned, within reason</div>
        </div>
        ${zones ? `
        <div class="stat-tile">
          <div class="stat-label">Estimated max HR (age ${age})</div>
          <div class="stat-value">${zones.max}<span class="unit">bpm</span></div>
          <div class="stat-sub">Tanaka formula: 208 − 0.7 × age</div>
        </div>` : ""}
      </div>
      ${zones ? `
      <table class="norm-table" style="margin-top:0.6rem;">
        <thead><tr><th>Zone</th><th>% of max</th><th>bpm range</th></tr></thead>
        <tbody>
          ${zones.zones.map((z) => `<tr><td>${z.label}</td><td>${Math.round(z.pct[0]*100)}–${Math.round(z.pct[1]*100)}%</td><td>${z.lo}–${z.hi}</td></tr>`).join("")}
        </tbody>
      </table>` : `<p class="field hint">Add your date of birth in Profile to see personalized heart-rate zones.</p>`}
    </div>

    <div class="card">
      <h3>Resting heart rate trend</h3>
      <div id="hr-chart"></div>
    </div>

    <div class="card">
      <h3>History</h3>
      <ul class="log-list" id="hr-log-list"></ul>
    </div>
  `;

  // ---- Camera reader wiring ----
  const video = container.querySelector("#hr-video");
  const wrap = container.querySelector("#camera-wrap");
  const liveValueEl = container.querySelector("#hr-live-value");
  const waveEl = container.querySelector("#hr-wave");
  const noteEl = container.querySelector("#hr-camera-note");
  const startBtn = container.querySelector("#hr-cam-start");
  const stopBtn = container.querySelector("#hr-cam-stop");
  const saveBtn = container.querySelector("#hr-cam-save");

  let waveBuffer = [];
  let latestBpm = null;
  const camera = new CameraHR({
    onSample: (deviation) => {
      waveBuffer.push(deviation);
      if (waveBuffer.length > 150) waveBuffer.shift();
      drawWave();
    },
    onBpm: (bpm) => {
      latestBpm = bpm;
      liveValueEl.textContent = `${bpm} bpm`;
      saveBtn.disabled = false;
    },
    onStable: (bpm) => {
      latestBpm = bpm;
      liveValueEl.textContent = `${bpm} bpm`;
      camera.stop();
      wrap.classList.remove("reading");
      wrap.classList.add("stable");
      startBtn.disabled = false;
      stopBtn.disabled = true;
      saveBtn.disabled = false;
      noteEl.textContent = `✓ Stable reading — steady around ${bpm} bpm. Tap "Save reading" to log it, or "Start reading" again for a fresh read.`;
      showToast(`Stable reading: ${bpm} bpm`);
    },
    onTimeout: () => {
      camera.stop();
      wrap.classList.remove("reading");
      startBtn.disabled = false;
      stopBtn.disabled = true;
      noteEl.textContent = latestBpm
        ? `Reading didn't fully settle in 30s — last estimate was ${latestBpm} bpm. You can save it, or try again holding very still with steady, even pressure.`
        : `Couldn't get a steady reading in 30 seconds. Try again with your fingertip flat and still over the lens — light or uneven pressure is the most common cause.`;
    },
  });

  function drawWave() {
    if (waveBuffer.length < 2) return;
    const min = Math.min(...waveBuffer);
    const max = Math.max(...waveBuffer);
    const range = max - min || 1;
    const w = 300, h = 60;
    const step = w / (waveBuffer.length - 1);
    const points = waveBuffer.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
    waveEl.innerHTML = `<polyline points="${points}" fill="none" stroke="var(--hr)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
  }

  startBtn.addEventListener("click", async () => {
    try {
      liveValueEl.textContent = "reading…";
      latestBpm = null;
      waveBuffer = [];
      saveBtn.disabled = true;
      wrap.classList.remove("stable");
      await camera.start(video);
      wrap.classList.add("reading");
      startBtn.disabled = true;
      stopBtn.disabled = false;
      noteEl.textContent = "Hold still — averaging your pulse over several beats. This will notify you and stop on its own once the reading is steady (up to ~30 seconds).";
    } catch (err) {
      noteEl.textContent = "Couldn't access the camera (" + err.message + "). You can still log a reading manually.";
      liveValueEl.textContent = "— bpm";
    }
  });

  stopBtn.addEventListener("click", () => {
    camera.stop();
    wrap.classList.remove("reading");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    noteEl.textContent = latestBpm
      ? "Reading stopped before it fully settled — you can still save it below, or start again for a steadier read."
      : "Stopped before a steady reading — try again, holding very still.";
  });

  saveBtn.addEventListener("click", () => {
    if (!latestBpm) return;
    addHrEntry({ dateISO: todayISO(), bpm: latestBpm, method: "camera", context: "resting" });
    showToast(`Saved ${latestBpm} bpm`);
    saveBtn.disabled = true;
    refresh();
  });

  // ---- Manual log ----
  container.querySelector("#hr-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const bpm = parseInt(container.querySelector("#hr-bpm").value, 10);
    const dateISO = container.querySelector("#hr-date").value;
    const context = container.querySelector("#hr-context").value;
    addHrEntry({ dateISO, bpm, method: "manual", context });
    container.querySelector("#hr-form").reset();
    container.querySelector("#hr-date").value = todayISO();
    showToast("Heart rate logged");
    refresh();
  });

  function refresh() {
    const log = getHrLog();
    const chartEl = container.querySelector("#hr-chart");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const points = [...log]
      .filter((e) => new Date(e.dateISO) >= cutoff)
      .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1))
      .map((e) => ({ iso: e.dateISO, value: e.bpm }));
    renderLineChart(chartEl, points, {
      color: "hr",
      tooltipValue: (v) => `${v} bpm`,
      emptyText: "No heart-rate readings in the last 90 days.",
    });

    const listEl = container.querySelector("#hr-log-list");
    if (!log.length) {
      listEl.innerHTML = `<li class="log-empty">Nothing logged yet.</li>`;
    } else {
      listEl.innerHTML = log
        .map((e) => {
          const cat = restingHrCategory(e.bpm);
          return `
        <li class="log-item">
          <div class="log-main">
            <span class="log-value">${e.bpm} bpm</span>
            <span class="log-date">${formatDateShort(e.dateISO)} · ${e.method === "camera" ? "camera" : "manual"}</span>
            ${cat ? `<span class="badge badge-${cat.tone}">${cat.label}</span>` : ""}
          </div>
          <button class="log-del" data-id="${e.id}" title="Delete">✕</button>
        </li>`;
        })
        .join("");
      listEl.querySelectorAll(".log-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          deleteHrEntry(btn.dataset.id);
          refresh();
        });
      });
    }
  }

  refresh();
}
