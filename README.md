# Health Tracker

A personal, self-contained health tracker: weight &amp; BMI, blood pressure /
waist / sleep, phone-sensor activity tracking, a home exercise library with
age-adjusted reference ranges, heart rate (including a camera-based pulse
reader), AI-assisted meal-photo calorie/macro estimation, and a
preventive-care checklist.

No build step, no dependencies to install, no accounts — it's plain
HTML/CSS/JS, all data stays in your browser's local storage on your device,
and it runs straight from the file system or from GitHub Pages. The one
exception is the optional Meals photo analyzer, which — only if you paste in
your own Anthropic API key — makes a direct API call from your phone's
browser to Claude for that one feature; everything else stays fully local
and offline.

## Features

- **Today** — a dashboard pulling together your latest weight/BMI, today's
  steps, exercise streak, resting heart rate, blood pressure, calories eaten,
  and an estimate of calories burned today from walking and home exercises
  (see "Estimated calories burned" below for how that's calculated).
- **Weight & BMI** — log weigh-ins in kg or lbs (a unit toggle right on the
  log form, remembered for next time and used everywhere weight is
  displayed — weights are always stored in kg internally so BMI and other
  math stay consistent regardless of which unit you log in), see BMI and
  category, a 90-day trend chart, and 7/30-day deltas.
- **Vitals** — blood pressure (with AHA category), waist circumference, and
  sleep hours, each with its own trend chart.
- **Activity** — a live step counter using your phone's accelerometer
  (`devicemotion`) while you walk with the app open, plus manual entry for
  days you tracked activity another way. Tracks a daily step goal and a
  weekly active-minutes goal (default 150 min/week, per CDC/AHA guidance).
  Progress auto-saves every ~20 seconds and immediately if the screen locks
  or the app is backgrounded, so an interrupted walk doesn't lose everything
  — but counting itself still needs the screen on and the app in front the
  whole time (see "Why the step counter needs the screen on" below, this
  isn't fixable from a web app).
- **Exercises** — 17 bodyweight exercises across four categories: Strength
  (push-ups, sit-ups, chair-stand/squats, plank, wall sit, calf raises,
  glute bridge, bird dog, side leg raises), Balance (standing one-foot
  balance, tandem/heel-to-toe stance), Cardio (a 2-minute step test), and
  Flexibility (hamstring, calf, hip flexor, shoulder, and lower back
  stretches — each its own card with its own specific how-to, not lumped
  into one generic "stretching" entry). Each has a short how-to; most also
  have general reference bands (not clinical norms) for adults around
  60–69, sourced from published fitness-test standards where they genuinely
  exist (the Rikli & Jones Senior Fitness Test norms for the step test, and
  SPPB/CDC STEADI balance-screening cutoffs for tandem stance) — a handful
  of exercises (glute bridge, bird dog, side leg raises, the stretches)
  intentionally have no band, since no well-established published standard
  exists for them; track your own progress on those with the trend chart
  instead. Timed exercises get a built-in stopwatch that keeps the screen
  awake (Screen Wake Lock API where supported). Every card also shows its
  own progress at a glance — best result, first-ever result, the change
  since then, and a small trend chart — so improvement (or a plateau) in
  any one exercise is visible without digging through the combined log
  below (balance and the sided stretches are tracked separately per side,
  same as one-foot balance's Left/Right logging).
- **Heart Rate** — a manual resting-HR log with reference ranges and
  age-based training zones (Tanaka formula), *and* a camera-based pulse
  reader: cover your phone's rear camera/flash with a fingertip and the app
  estimates your heart rate from the brightness ripple each heartbeat
  causes (basic photoplethysmography, the same principle behind
  clip-on pulse oximeters — not a medical device).
- **Meals** — snap a photo of a plate before you eat and, if you've added
  your own Anthropic API key, Claude identifies the food items and estimates
  calories/protein/carbs/fat for each — shown in an editable review table
  before anything is saved, so you can correct the AI's guesses. Manual
  entry works with no API key needed, and auto-fills calories/protein/carbs/
  fat for a reference list of common foods — including a Mediterranean /
  Middle Eastern section (dates, hummus, ful medames, falafel, shawarma,
  stuffed grape leaves, mansaf, knafeh, and more) alongside general everyday
  foods, all curated halal-conscious (no pork or alcohol) — scaled by
  however many servings you had. Matching is approximate: start typing a
  name like "banana" or "hummus" (typos, plurals, and partial names like
  "grape leaf" or just "falafel" all find the closest match) and the
  best-matching food's numbers fill in, clearly labeled so you can tell it
  apart from an exact match; anything not in the list, or with no close
  enough match, still works with fully manual entry. Tracks daily
  totals against an optional calorie target (a rough Mifflin-St Jeor
  starting estimate you can override) and a 30-day trend chart. See "AI meal
  photo analysis" below for the privacy/cost details before turning that on.
- **Screenings** — a checklist of general USPSTF/CDC preventive-care
  guidance for a man in his early 60s (cholesterol, colorectal screening,
  vaccines, etc.), checkable and stored locally.
- **Profile** — date of birth, sex, height; export/import a JSON backup;
  clear all data.
- Installable as a PWA with offline support.

## Not medical advice

This app is a personal tracking tool. Reference ranges, exercise targets,
and the screening checklist reflect general, commonly published guidelines
(USPSTF, CDC/ACIP, standard fitness norm tables) — they are **not**
personalized medical advice, a diagnosis, or a treatment plan, and they
don't account for your individual history. Talk to your doctor about what
actually applies to you, especially before starting a new exercise routine,
and seek care promptly for chest pain, severe shortness of breath, fainting,
or other concerning symptoms.

## Why the step counter needs the screen on

The Activity tab's live step counter can't run with the screen off or the
app backgrounded, and no amount of extra code fixes that — it's a platform
limit, not a bug. iOS discards a standalone PWA outright when you switch
away from it or lock the screen; Android freezes its JavaScript. Neither
lets a website keep listening to the accelerometer once you're not actively
looking at it. This is true of every web app, not just this one — it's why
dedicated fitness apps use step-counting APIs built into the phone's OS
(Apple's Core Motion, Android's step-counter sensor), which only a native
app can call, not a website.

Two practical consequences:

- **For a dedicated walk you're tracking on purpose:** keep the app open and
  the screen on for that walk (the Wake Lock the app requests helps with
  this). Progress auto-saves every ~20 seconds and immediately if the app
  does get backgrounded, so an interruption loses at most the last ~20
  seconds, not the whole walk — and if a walk never got a clean "Stop" (the
  OS killed the app mid-walk), the app tells you how many steps were saved
  the next time you open the Activity tab.
- **For all-day step totals:** your phone is already counting steps in the
  background 24/7 via its own hardware pedometer, completely independent of
  this app — check the Health app (iPhone) or your phone's fitness/Health
  Connect app (Android) at the end of the day and enter that total in
  Activity → "Log activity manually." That's the only reliable way to get a
  true all-day count without turning this into a native app.

## Estimated calories burned

The Today dashboard shows a rough estimate of calories burned so far today
from walking (Activity) and home exercises (Exercises), broken out as
🚶 walking · 💪 exercise. This needs a logged weight to scale against — it
won't show a number until you've logged one in the Weight tab.

The math is the standard ACSM MET formula also used by most fitness
trackers: `kcal = MET × 3.5 × your weight in kg ÷ 200 × minutes`. Each
activity type is assigned a MET (metabolic equivalent) value from general
published tables — e.g. push-ups/sit-ups ≈ 8 METs, chair-stand/squats ≈ 5,
plank ≈ 3.5, moderate walking ≈ 3.5. Duration comes from what you actually
logged: a direct time for timed exercises (plank, wall sit, balance,
stretching) and tracked active minutes for walking; for rep-counted
exercises without a timer (push-ups, calf raises) it assumes roughly 3
seconds per rep (4s for calf raises); for the two fixed-length tests
(60-second sit-up test, 30-second chair-stand test) it uses that test's
actual duration, not the rep count. If a walking day only has a step count
and no tracked minutes (e.g. manual entry), it assumes roughly 100
steps/minute to estimate duration.

Treat these numbers as a ballpark for spotting trends, not a precise
measurement — actual calorie burn depends on pace, effort, incline, and
individual body composition in ways a MET table can't capture. The same
`estimateExerciseCalories`/`estimateWalkingCalories` helpers also annotate
individual entries in the Activity and Exercises history lists.

## AI meal photo analysis — read before turning this on

The Meals tab can call Claude's API directly from your phone's browser to
identify food in a photo and estimate calories/macros. This is opt-in and
inert until you paste an API key into Meals → AI food analysis settings.
Two things worth knowing plainly:

1. **Your API key lives in this browser's local storage** and is sent as a
   request header on every photo you analyze. It's visible to anyone with
   access to this device/browser's developer tools. That's a reasonable
   trade-off for a personal phone only you use — don't paste a key in here
   on a shared or public device.
2. **Each analysis is a small, metered API call** (a few cents at most with
   the default Haiku model) and needs an internet connection. This is the
   one feature in the app that costs money and doesn't work offline —
   everything else stays free and local.

The calorie/macro numbers are the model's best visual read of a photo, not a
lab measurement — portion size and hidden ingredients (oil, sauces,
dressings) are genuinely hard to judge from an image. The review screen
before saving lets you fix anything that looks off; treat the numbers as
"roughly this," useful for spotting patterns over weeks, not as precise
nutrition facts.

Your API key is deliberately excluded from **Profile → Export backup**, so
it never ends up in a backup file you might share or store elsewhere.

## Your data

Everything else is stored in this browser's `localStorage`, on this device
only — nothing is sent to a server, because there is no server (the one
exception being the Meals photo analyzer's direct calls to Claude's API,
described above). Use **Profile → Export backup** periodically, and
especially before clearing browser data or switching devices; **Import
backup** restores from that file.

## Running it

Just open `index.html` in a browser — or, since browsers restrict ES module
imports over the `file://` protocol in some cases, serve the folder locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The camera-based heart-rate reader and the accelerometer step counter both
need a secure context (HTTPS, or `localhost`) and, on iOS, an explicit
permission prompt the first time you use them.

## Publishing on GitHub Pages

1. Push this folder as a new GitHub repository.
2. In the repo settings, go to **Pages**, and set the source to the `main`
   branch, root folder.
3. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.
   Service workers and camera/motion sensors require HTTPS — GitHub Pages
   provides that automatically.

No GitHub Actions or build step needed — it's static files. If you edit any
cached file (`index.html`, `css/styles.css`, `js/*.js`,
`manifest.webmanifest`, or the icons), bump `CACHE_VERSION` at the top of
`sw.js` so returning visitors get the update instead of a stale cache.

## Project structure

```
health-tracker/
├── index.html
├── manifest.webmanifest   # PWA metadata (name, icons, colors)
├── sw.js                  # service worker — offline caching for the app shell
├── css/
│   └── styles.css
├── icons/                 # app icons for the installed PWA + favicon
├── js/
│   ├── app.js             # tab router, footer/build info, service worker registration
│   ├── storage.js         # localStorage CRUD for every log + backup export/import
│   ├── util.js             # dates, BMI/HR-zone/BP-category math, formatting
│   ├── ui.js               # toast messages, screen wake-lock helper
│   ├── charts.js           # dependency-free SVG line/bar charts with hover tooltips
│   ├── profile.js          # first-run setup modal + Profile tab
│   ├── dashboard.js        # Today tab
│   ├── weight.js           # Weight & BMI tab
│   ├── vitals.js           # blood pressure / waist / sleep tab
│   ├── activity.js         # accelerometer step counter + manual activity log
│   ├── exercises.js        # exercise library, reference bands, stopwatch, log
│   ├── heartrate.js        # manual HR log + camera PPG pulse reader
│   ├── screenings.js       # preventive-care checklist
│   ├── meals.js            # camera food photo → Claude API analysis + manual meal log
│   └── foodDatabase.js     # reference table of common foods for manual-entry auto-fill
└── README.md
```

## Adjusting reference ranges / targets

- Step and weekly-minutes goals: editable in the **Activity** tab.
- Exercise reference bands: edit the `EXERCISES` array in `js/exercises.js`.
- Screening checklist items: edit the `ITEMS` array in `js/screenings.js`.
- Heart-rate zones use the Tanaka formula (`208 − 0.7 × age`), computed in
  `js/util.js`'s `hrMax`/`hrZones`.
- Common-foods auto-fill list: edit the `COMMON_FOODS` array in
  `js/foodDatabase.js` — each entry just needs `name`, `portion`,
  `calories`, `proteinG`, `carbsG`, `fatG`. It's a small, editable starting
  set, not an exhaustive nutrition database; anything not listed still works
  in Meals → manual entry, you just type the numbers yourself. Matching
  against what you type is approximate (see `findFoodMatch` in the same
  file) — it favors exact matches, then close partial/word matches, then
  falls back to nothing rather than guessing at an unrelated food; adjust
  `MIN_MATCH_SCORE` there if it feels too eager or too strict.
