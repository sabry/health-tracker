// Minimal, dependency-free SVG charts: a single-series line chart with a
// hover crosshair + tooltip, and a small daily bar chart. Deliberately
// simple — one series per chart, one axis, thin marks, no chart-junk.

import { formatDateShort } from "./util.js";

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/**
 * Render a line chart into `container`.
 * @param {HTMLElement} container
 * @param {{iso:string, value:number}[]} points - ascending by date
 * @param {object} opts
 *   goal: number (optional dashed reference line)
 *   color: 'accent' | 'hr'
 *   yLabel: (v) => string
 *   height: number
 */
export function renderLineChart(container, points, opts = {}) {
  container.innerHTML = "";
  const clean = points.filter((p) => p.value != null && !Number.isNaN(p.value));
  if (clean.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = opts.emptyText || "No data yet — log an entry to see your trend.";
    container.appendChild(empty);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  container.appendChild(wrap);

  const width = 640;
  const height = opts.height || 200;
  const padL = 34, padR = 12, padT = 14, padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const values = clean.map((p) => p.value);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (opts.goal != null) { minV = Math.min(minV, opts.goal); maxV = Math.max(maxV, opts.goal); }
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const spread = maxV - minV;
  minV -= spread * 0.12;
  maxV += spread * 0.12;

  const n = clean.length;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v) => padT + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const svg = el("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": opts.ariaLabel || "trend chart",
  });

  // Gridlines (3 horizontal bands, recessive)
  const gridCount = 3;
  for (let g = 0; g <= gridCount; g++) {
    const gv = minV + (spread === 0 ? 0 : ((maxV - minV) * g) / gridCount);
    const gy = y(gv);
    svg.appendChild(el("line", { x1: padL, x2: width - padR, y1: gy, y2: gy, class: "chart-grid-line" }));
    const label = el("text", { x: 4, y: gy + 3, class: "chart-axis-label" });
    label.textContent = opts.yLabel ? opts.yLabel(gv) : Math.round(gv);
    svg.appendChild(label);
  }

  // Goal reference line
  if (opts.goal != null) {
    const gy = y(opts.goal);
    svg.appendChild(el("line", { x1: padL, x2: width - padR, y1: gy, y2: gy, class: "chart-goal-line" }));
  }

  // X-axis date labels: first, middle, last
  const tickIdx = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  new Set(tickIdx).forEach((i) => {
    const label = el("text", { x: x(i), y: height - 4, class: "chart-axis-label", "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" });
    label.textContent = formatDateShort(clean[i].iso);
    svg.appendChild(label);
  });

  // Line + fill
  const lineClass = opts.color === "hr" ? "chart-line-path hr" : "chart-line-path";
  const pathD = clean.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  svg.appendChild(el("path", { d: pathD, class: lineClass }));

  const fillD = `${pathD} L ${x(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
  svg.appendChild(el("path", { d: fillD, class: "chart-fill-path" }));

  // Dots
  const dotClass = opts.color === "hr" ? "chart-dot hr" : "chart-dot";
  const dots = clean.map((p, i) => {
    const dot = el("circle", { cx: x(i), cy: y(p.value), r: n > 40 ? 0 : 3, class: dotClass });
    svg.appendChild(dot);
    return dot;
  });

  // Hover crosshair
  const crosshair = el("line", { class: "chart-crosshair", y1: padT, y2: padT + innerH, x1: -100, x2: -100 });
  svg.appendChild(crosshair);

  wrap.appendChild(svg);

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  wrap.appendChild(tooltip);

  function showAt(i) {
    const p = clean[i];
    const cx = x(i), cy = y(p.value);
    crosshair.setAttribute("x1", cx);
    crosshair.setAttribute("x2", cx);
    dots.forEach((d) => d.classList.remove("hover"));
    if (dots[i]) { dots[i].setAttribute("r", 5.5); }
    const pct = cx / width;
    tooltip.style.left = `${pct * 100}%`;
    tooltip.style.top = `${(cy / height) * 100}%`;
    tooltip.innerHTML = `<span class="tt-value">${opts.tooltipValue ? opts.tooltipValue(p.value) : p.value}</span><br><span class="tt-date">${formatDateShort(p.iso)}</span>`;
    tooltip.classList.add("visible");
  }
  function hide() {
    crosshair.setAttribute("x1", -100);
    crosshair.setAttribute("x2", -100);
    dots.forEach((d, i) => d.setAttribute("r", n > 40 ? 0 : 3));
    tooltip.classList.remove("visible");
  }

  function pointerHandler(evt) {
    const rect = svg.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const relX = ((clientX - rect.left) / rect.width) * width;
    let closest = 0, best = Infinity;
    clean.forEach((p, i) => {
      const d = Math.abs(x(i) - relX);
      if (d < best) { best = d; closest = i; }
    });
    showAt(closest);
  }

  svg.addEventListener("mousemove", pointerHandler);
  svg.addEventListener("mouseleave", hide);
  svg.addEventListener("touchstart", pointerHandler, { passive: true });
  svg.addEventListener("touchmove", pointerHandler, { passive: true });
  svg.addEventListener("touchend", hide);

  // Show the most recent point by default so the number is visible without
  // interaction (this is the one exception dataviz makes: a single strong
  // headline value alongside the trend).
  showAt(n - 1);
}

/**
 * Small bar chart, e.g. steps for the last 7 days.
 * @param {{iso:string, value:number}[]} points
 */
export function renderBarChart(container, points, opts = {}) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  container.appendChild(wrap);

  const width = 640;
  const height = opts.height || 160;
  const padL = 30, padR = 8, padT = 10, padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = points.length;
  const maxV = Math.max(opts.goal || 0, ...points.map((p) => p.value || 0), 1);

  const svg = el("svg", { class: "chart-svg", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" });

  if (opts.goal != null) {
    const gy = padT + innerH - (opts.goal / maxV) * innerH;
    svg.appendChild(el("line", { x1: padL, x2: width - padR, y1: gy, y2: gy, class: "chart-goal-line" }));
  }

  const bw = (innerW / n) * 0.6;
  const gap = (innerW / n) * 0.4;
  const todayISOStr = opts.todayISO;

  points.forEach((p, i) => {
    const slot = padL + (innerW * i) / n + gap / 2;
    const h = maxV === 0 ? 0 : ((p.value || 0) / maxV) * innerH;
    const barY = padT + innerH - h;
    const rect = el("rect", {
      x: slot, y: barY, width: bw, height: Math.max(h, p.value ? 2 : 0),
      rx: 3, class: p.iso === todayISOStr ? "chart-bar today" : "chart-bar",
    });
    const title = el("title", {});
    title.textContent = `${formatDateShort(p.iso)}: ${p.value || 0}${opts.unit || ""}`;
    rect.appendChild(title);
    svg.appendChild(rect);

    const label = el("text", { x: slot + bw / 2, y: height - 4, class: "chart-axis-label", "text-anchor": "middle" });
    label.textContent = formatDateShort(p.iso).split(" ")[1] || formatDateShort(p.iso);
    svg.appendChild(label);
  });

  wrap.appendChild(svg);
}
