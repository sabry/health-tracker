import { getScreeningState, setScreeningState } from "./storage.js";
import { escapeHtml } from "./util.js";

// General preventive-care guidance for a man in his early 60s, based on
// USPSTF and CDC/ACIP recommendations as commonly published (colorectal
// screening 45-75 Grade A, pneumococcal vaccination now recommended from
// age 50, RSV vaccine routine at 75+ and risk-based from 60-74, etc.).
// These are population-level defaults, not personalized medical advice —
// your own history (smoking, family history, existing conditions) changes
// what actually applies to you, so treat this as a conversation-starter
// for your next doctor's visit, not a final answer.
const ITEMS = [
  {
    category: "Screenings",
    items: [
      { id: "bp", title: "Blood pressure check", desc: "At least once a year, more often if elevated. Track readings in the Vitals tab." },
      { id: "cholesterol", title: "Cholesterol / lipid panel", desc: "Roughly every 4–6 years if results have been normal and you're not on treatment; annually if you're on a statin or have risk factors." },
      { id: "diabetes", title: "Blood glucose / A1c screening", desc: "USPSTF recommends screening adults 35–70 who are overweight or have obesity, roughly every 3 years." },
      { id: "colorectal", title: "Colorectal cancer screening", desc: "USPSTF Grade A for ages 45–75: colonoscopy every 10 years, or annual stool-based test (FIT), or other approved options — ask your doctor which fits you." },
      { id: "prostate", title: "Prostate cancer (PSA) discussion", desc: "USPSTF suggests shared decision-making for ages 55–69 (Grade C) — worth a conversation about your personal risk and preferences, not a default yes or no." },
      { id: "aaa", title: "Abdominal aortic aneurysm screening", desc: "One-time ultrasound recommended (Grade B) for men 65–75 who have ever smoked — something to schedule once you turn 65 if that applies." },
      { id: "lung", title: "Lung cancer screening (low-dose CT)", desc: "For adults 50–80 with a ~20 pack-year smoking history who currently smoke or quit within the last 15 years (Grade B). Not applicable if that doesn't describe you." },
      { id: "hepc", title: "Hepatitis C screening", desc: "One-time screening recommended for all adults 18–79 (Grade B) if you haven't been tested before." },
      { id: "vision", title: "Eye exam", desc: "Comprehensive vision exam every 1–2 years — checks for glaucoma, cataracts, and macular degeneration, which all become more common with age." },
      { id: "hearing", title: "Hearing check", desc: "Age-related hearing loss is common and easy to miss gradually — a periodic hearing check is worth it, especially if others mention you turn the TV up." },
      { id: "dental", title: "Dental checkup", desc: "Every 6–12 months for cleaning and exam." },
      { id: "skin", title: "Skin check", desc: "Periodic self-exam (or a dermatologist visit) for new or changing moles/spots, especially with significant sun exposure history." },
      { id: "bone", title: "Bone density (DEXA) — if risk factors apply", desc: "Not routine for men without risk factors, but worth asking about if you've had a fracture from a minor fall, take long-term steroids, or have other risk factors." },
    ],
  },
  {
    category: "Vaccines & immunizations",
    items: [
      { id: "flu", title: "Influenza vaccine", desc: "Every year, ideally in early fall." },
      { id: "covid", title: "COVID-19 vaccine", desc: "Stay current per the latest CDC guidance for the season — recommendations are updated periodically." },
      { id: "shingles", title: "Shingles vaccine (Shingrix)", desc: "Two-dose series, recommended for all adults 50+." },
      { id: "pneumococcal", title: "Pneumococcal vaccine", desc: "Recommended for all adults 50+ (lowered from 65 in 2024) if you haven't had it." },
      { id: "tdap", title: "Tdap / Td booster", desc: "One Tdap dose if you've never had one as an adult, then a Td or Tdap booster every 10 years." },
      { id: "rsv", title: "RSV vaccine", desc: "Routine at 75+. At 60–74, recommended if you have a chronic heart, lung, or kidney condition, diabetes, or another condition raising your risk — worth asking your doctor about at your age." },
    ],
  },
  {
    category: "Other checkups",
    items: [
      { id: "physical", title: "Annual physical / wellness visit", desc: "A yearly check-in to review all of the above and anything new." },
      { id: "aspirin", title: "Aspirin for heart-attack/stroke prevention — discuss", desc: "Whether daily low-dose aspirin makes sense is individual, especially past 60 — worth a direct conversation with your doctor rather than a default." },
      { id: "fallrisk", title: "Balance / fall-risk check-in", desc: "If the one-foot balance times in the Exercises tab are consistently short, mention it at your next visit — balance and grip strength are two of the better predictors of healthy aging." },
      { id: "mood", title: "Mood / mental health check-in", desc: "Worth an honest self-check periodically — sleep, energy, and motivation changes are easy to attribute to \"just getting older\" when they're not." },
    ],
  },
];

export function renderScreeningsView(container) {
  const state = getScreeningState();

  container.innerHTML = `
    <div class="view-header">
      <h2>Preventive care checklist</h2>
      <p class="subtitle">General guidance for a man in his early 60s (USPSTF / CDC). Not personalized medical advice — your history changes what actually applies. Check items off as you complete them; nothing here is sent anywhere.</p>
    </div>
    ${ITEMS.map((section) => `
      <div class="category-heading">${section.category}</div>
      <ul class="checklist">
        ${section.items.map((item) => checklistItemHTML(item, state[item.id])).join("")}
      </ul>
    `).join("")}
    <p class="disclaimer" style="margin-top:1rem;">This checklist reflects commonly published USPSTF/CDC guidance and can change over time or not apply to your specific situation (family history, existing conditions, prior test results). Use it to prep questions for your doctor, not as a diagnosis or prescription.</p>
  `;

  container.querySelectorAll(".checklist-item input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      setScreeningState(cb.dataset.id, { done: cb.checked, doneDate: cb.checked ? new Date().toISOString().slice(0, 10) : null });
      cb.closest(".checklist-item").classList.toggle("done", cb.checked);
    });
  });
}

function checklistItemHTML(item, state) {
  const done = state && state.done;
  return `
  <li class="checklist-item ${done ? "done" : ""}">
    <input type="checkbox" id="scr-${item.id}" data-id="${item.id}" ${done ? "checked" : ""} />
    <div class="ci-body">
      <label for="scr-${item.id}" class="ci-title">${escapeHtml(item.title)}</label>
      <div class="ci-desc">${escapeHtml(item.desc)}</div>
    </div>
  </li>`;
}
