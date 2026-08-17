// A small bundled reference table of common foods with well-established
// nutrition values, so logging something ordinary ("banana," "chicken
// breast," "white rice") doesn't require knowing or looking up its calorie
// count — pick it from the list (or just type the exact name) and the
// manual-entry form fills in calories/protein/carbs/fat for you, scaled by
// however many servings you had. Values are per the listed portion, rounded
// to typical/generic figures (USDA-ish ballpark) — a real banana varies by
// size, a real chicken breast by cut, etc., so treat these as reasonable
// defaults you can still edit, not exact measurements. Not exhaustive on
// purpose — for anything not here, just type the name and enter values
// manually. Add more rows below any time; each just needs name/portion/
// calories/proteinG/carbsG/fatG.
//
// Curated halal-conscious: no pork/pork-derived items and no alcoholic
// beverages are included on purpose.

export const COMMON_FOODS = [
  // ---- Fruit ----
  { name: "Banana (medium)", portion: "1 medium (118g)", calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 },
  { name: "Apple (medium)", portion: "1 medium (182g)", calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3 },
  { name: "Orange (medium)", portion: "1 medium (131g)", calories: 62, proteinG: 1.2, carbsG: 15, fatG: 0.2 },
  { name: "Grapes", portion: "1 cup (151g)", calories: 104, proteinG: 1.1, carbsG: 27, fatG: 0.2 },
  { name: "Strawberries", portion: "1 cup sliced (166g)", calories: 53, proteinG: 1.1, carbsG: 13, fatG: 0.5 },
  { name: "Blueberries", portion: "1 cup (148g)", calories: 84, proteinG: 1.1, carbsG: 21, fatG: 0.5 },
  { name: "Watermelon", portion: "1 cup diced (152g)", calories: 46, proteinG: 0.9, carbsG: 11, fatG: 0.2 },
  { name: "Pear (medium)", portion: "1 medium (178g)", calories: 101, proteinG: 0.6, carbsG: 27, fatG: 0.2 },
  { name: "Peach (medium)", portion: "1 medium (150g)", calories: 58, proteinG: 1.4, carbsG: 14, fatG: 0.4 },
  { name: "Mango", portion: "1 cup sliced (165g)", calories: 99, proteinG: 1.4, carbsG: 25, fatG: 0.6 },
  { name: "Pineapple", portion: "1 cup chunks (165g)", calories: 82, proteinG: 0.9, carbsG: 22, fatG: 0.2 },
  { name: "Avocado", portion: "1/2 medium (100g)", calories: 160, proteinG: 2, carbsG: 8.5, fatG: 15 },

  // ---- Vegetables ----
  { name: "Broccoli, steamed", portion: "1 cup (156g)", calories: 55, proteinG: 3.7, carbsG: 11, fatG: 0.6 },
  { name: "Carrot (medium)", portion: "1 medium (61g)", calories: 25, proteinG: 0.6, carbsG: 6, fatG: 0.1 },
  { name: "Spinach, raw", portion: "1 cup (30g)", calories: 7, proteinG: 0.9, carbsG: 1.1, fatG: 0.1 },
  { name: "Sweet potato, baked", portion: "1 medium (114g)", calories: 103, proteinG: 2.3, carbsG: 24, fatG: 0.2 },
  { name: "Potato, baked (with skin)", portion: "1 medium (173g)", calories: 161, proteinG: 4.3, carbsG: 37, fatG: 0.2 },
  { name: "Tomato (medium)", portion: "1 medium (123g)", calories: 22, proteinG: 1.1, carbsG: 4.8, fatG: 0.2 },
  { name: "Cucumber", portion: "1 cup sliced (119g)", calories: 16, proteinG: 0.7, carbsG: 3.8, fatG: 0.1 },
  { name: "Bell pepper", portion: "1 cup sliced (149g)", calories: 39, proteinG: 1.5, carbsG: 9, fatG: 0.4 },
  { name: "Corn, cooked", portion: "1 cup (154g)", calories: 143, proteinG: 5.4, carbsG: 31, fatG: 2.2 },
  { name: "Green beans, cooked", portion: "1 cup (125g)", calories: 44, proteinG: 2.4, carbsG: 10, fatG: 0.4 },
  { name: "Mixed salad greens", portion: "2 cups (60g)", calories: 15, proteinG: 1.2, carbsG: 3, fatG: 0.2 },

  // ---- Protein ----
  { name: "Chicken breast, grilled (skinless)", portion: "4 oz (113g)", calories: 187, proteinG: 35, carbsG: 0, fatG: 4 },
  { name: "Chicken thigh, roasted (skinless)", portion: "4 oz (113g)", calories: 209, proteinG: 26, carbsG: 0, fatG: 11 },
  { name: "Salmon, baked", portion: "4 oz (113g)", calories: 233, proteinG: 25, carbsG: 0, fatG: 14 },
  { name: "Tuna, canned in water", portion: "3 oz (85g)", calories: 99, proteinG: 22, carbsG: 0, fatG: 0.7 },
  { name: "Ground beef, 90/10, cooked", portion: "4 oz (113g)", calories: 218, proteinG: 25, carbsG: 0, fatG: 12 },
  { name: "Egg, large", portion: "1 egg (50g)", calories: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 },
  { name: "Egg whites", portion: "1/2 cup (121g)", calories: 63, proteinG: 13, carbsG: 0.9, fatG: 0.2 },
  { name: "Tofu, firm", portion: "1/2 cup (126g)", calories: 94, proteinG: 10, carbsG: 2.3, fatG: 6 },
  { name: "Black beans, cooked", portion: "1 cup (172g)", calories: 227, proteinG: 15, carbsG: 41, fatG: 0.9 },
  { name: "Chickpeas, cooked", portion: "1 cup (164g)", calories: 269, proteinG: 15, carbsG: 45, fatG: 4.3 },
  { name: "Lentils, cooked", portion: "1 cup (198g)", calories: 230, proteinG: 18, carbsG: 40, fatG: 0.8 },
  { name: "Shrimp, cooked", portion: "4 oz (113g)", calories: 112, proteinG: 24, carbsG: 0.4, fatG: 1.2 },
  { name: "Turkey breast, roasted", portion: "4 oz (113g)", calories: 153, proteinG: 34, carbsG: 0, fatG: 1 },

  // ---- Dairy ----
  { name: "Milk, whole", portion: "1 cup (244g)", calories: 149, proteinG: 8, carbsG: 12, fatG: 8 },
  { name: "Milk, skim", portion: "1 cup (245g)", calories: 83, proteinG: 8.3, carbsG: 12, fatG: 0.2 },
  { name: "Greek yogurt, plain nonfat", portion: "1 cup (245g)", calories: 133, proteinG: 23, carbsG: 9, fatG: 0.7 },
  { name: "Cheddar cheese", portion: "1 oz (28g)", calories: 115, proteinG: 7, carbsG: 0.4, fatG: 9.5 },
  { name: "Mozzarella, part-skim", portion: "1 oz (28g)", calories: 72, proteinG: 6.9, carbsG: 0.8, fatG: 4.5 },
  { name: "Cottage cheese, low-fat", portion: "1 cup (226g)", calories: 163, proteinG: 28, carbsG: 6.2, fatG: 2.3 },
  { name: "Butter", portion: "1 tbsp (14g)", calories: 102, proteinG: 0.1, carbsG: 0, fatG: 11.5 },

  // ---- Grains & carbs ----
  { name: "White rice, cooked", portion: "1 cup (158g)", calories: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4 },
  { name: "Brown rice, cooked", portion: "1 cup (195g)", calories: 216, proteinG: 5, carbsG: 45, fatG: 1.8 },
  { name: "Quinoa, cooked", portion: "1 cup (185g)", calories: 222, proteinG: 8, carbsG: 39, fatG: 3.6 },
  { name: "Oatmeal, cooked (water)", portion: "1 cup (234g)", calories: 166, proteinG: 5.9, carbsG: 28, fatG: 3.6 },
  { name: "Whole wheat bread", portion: "1 slice (28g)", calories: 69, proteinG: 3.6, carbsG: 12, fatG: 1 },
  { name: "White bread", portion: "1 slice (25g)", calories: 67, proteinG: 2, carbsG: 12.5, fatG: 0.8 },
  { name: "Pasta, cooked", portion: "1 cup (140g)", calories: 221, proteinG: 8, carbsG: 43, fatG: 1.3 },
  { name: "Bagel, plain", portion: "1 medium (98g)", calories: 245, proteinG: 10, carbsG: 48, fatG: 1.5 },
  { name: "Flour tortilla", portion: "1 medium (49g)", calories: 146, proteinG: 4, carbsG: 24, fatG: 3.6 },
  { name: "Corn tortilla", portion: "1 small (24g)", calories: 52, proteinG: 1.4, carbsG: 11, fatG: 0.6 },

  // ---- Nuts, seeds & fats ----
  { name: "Almonds", portion: "1 oz / ~23 nuts (28g)", calories: 164, proteinG: 6, carbsG: 6.1, fatG: 14 },
  { name: "Peanut butter", portion: "2 tbsp (32g)", calories: 188, proteinG: 8, carbsG: 6.9, fatG: 16 },
  { name: "Walnuts", portion: "1 oz (28g)", calories: 185, proteinG: 4.3, carbsG: 3.9, fatG: 18.5 },
  { name: "Olive oil", portion: "1 tbsp (14g)", calories: 119, proteinG: 0, carbsG: 0, fatG: 13.5 },

  // ---- Snacks & other ----
  { name: "Potato chips", portion: "1 oz / ~15 chips (28g)", calories: 152, proteinG: 2, carbsG: 15, fatG: 10 },
  { name: "Pretzels", portion: "1 oz (28g)", calories: 108, proteinG: 2.6, carbsG: 22, fatG: 0.8 },
  { name: "Popcorn, air-popped", portion: "3 cups (24g)", calories: 93, proteinG: 3, carbsG: 19, fatG: 1 },
  { name: "Dark chocolate", portion: "1 oz (28g)", calories: 155, proteinG: 1.4, carbsG: 13, fatG: 11 },
  { name: "Granola bar", portion: "1 bar (28g)", calories: 118, proteinG: 2.6, carbsG: 20, fatG: 4 },
  { name: "Protein bar", portion: "1 bar (60g)", calories: 220, proteinG: 20, carbsG: 24, fatG: 7 },

  // ---- Beverages ----
  { name: "Orange juice", portion: "1 cup (248g)", calories: 112, proteinG: 1.7, carbsG: 26, fatG: 0.5 },
  { name: "Coffee, black", portion: "1 cup (240g)", calories: 2, proteinG: 0.3, carbsG: 0, fatG: 0 },
  { name: "Latte, whole milk", portion: "12 oz (340g)", calories: 168, proteinG: 9, carbsG: 13, fatG: 9 },
  { name: "Soda, regular", portion: "12 oz can (355g)", calories: 140, proteinG: 0, carbsG: 39, fatG: 0 },

  // ---- Common combined meals ----
  { name: "Pizza, cheese slice", portion: "1 slice (107g)", calories: 285, proteinG: 12, carbsG: 36, fatG: 10 },
  { name: "Hamburger, fast food", portion: "1 sandwich (110g)", calories: 295, proteinG: 15, carbsG: 27, fatG: 14 },
  { name: "French fries, medium", portion: "1 medium order (117g)", calories: 365, proteinG: 4, carbsG: 48, fatG: 17 },
  { name: "Chicken sandwich, fast food", portion: "1 sandwich (183g)", calories: 490, proteinG: 28, carbsG: 40, fatG: 24 },
  { name: "Burrito, chicken & rice", portion: "1 burrito (300g)", calories: 550, proteinG: 30, carbsG: 65, fatG: 18 },
  { name: "Sushi roll (California)", portion: "8 pieces (250g)", calories: 255, proteinG: 9, carbsG: 38, fatG: 7 },
  { name: "Turkey sandwich, wheat bread", portion: "1 sandwich (200g)", calories: 320, proteinG: 24, carbsG: 36, fatG: 8 },

  // ---- Mediterranean / Middle Eastern ----
  { name: "Dates, Medjool", portion: "1 date (24g)", calories: 66, proteinG: 0.4, carbsG: 18, fatG: 0 },
  { name: "Apricots, dried", portion: "1/4 cup, ~6-8 halves (33g)", calories: 78, proteinG: 1.1, carbsG: 20, fatG: 0.2 },
  { name: "Figs, fresh", portion: "1 medium (50g)", calories: 37, proteinG: 0.4, carbsG: 9.6, fatG: 0.2 },
  { name: "Figs, dried", portion: "3 figs (24g)", calories: 60, proteinG: 0.8, carbsG: 15, fatG: 0.2 },
  { name: "Pomegranate seeds (arils)", portion: "1 cup (174g)", calories: 144, proteinG: 2.9, carbsG: 33, fatG: 2 },
  { name: "Hummus", portion: "1/4 cup (60g)", calories: 108, proteinG: 2.9, carbsG: 12, fatG: 5.2 },
  { name: "Ful medames (fava beans)", portion: "1 cup (235g)", calories: 200, proteinG: 12, carbsG: 30, fatG: 5 },
  { name: "Baba ghanoush", portion: "3 tbsp (45g)", calories: 100, proteinG: 1.5, carbsG: 6, fatG: 8 },
  { name: "Moutabal", portion: "3 tbsp (45g)", calories: 125, proteinG: 2, carbsG: 6, fatG: 10 },
  { name: "Labneh", portion: "100g (~7 tbsp)", calories: 150, proteinG: 6, carbsG: 4, fatG: 10 },
  { name: "Tahini", portion: "1 tbsp (15g)", calories: 105, proteinG: 3, carbsG: 2.1, fatG: 9.4 },
  { name: "Falafel", portion: "3 pieces (51g)", calories: 175, proteinG: 6, carbsG: 16, fatG: 9 },
  { name: "Lentil soup (shorbat adas)", portion: "1 cup (245g)", calories: 200, proteinG: 11, carbsG: 30, fatG: 5 },
  { name: "Chicken shawarma wrap", portion: "1 wrap (250g)", calories: 450, proteinG: 30, carbsG: 45, fatG: 15 },
  { name: "Beef/lamb shawarma", portion: "1 serving (250g)", calories: 600, proteinG: 35, carbsG: 50, fatG: 30 },
  { name: "Kofta / kebab (grilled ground meat)", portion: "2-3 skewers (150g)", calories: 250, proteinG: 20, carbsG: 5, fatG: 18 },
  { name: "Shish tawook (grilled chicken skewer)", portion: "3 skewers (150g)", calories: 248, proteinG: 38, carbsG: 4.5, fatG: 9 },
  { name: "Kibbeh, fried", portion: "1 piece (50g)", calories: 130, proteinG: 6, carbsG: 9, fatG: 7.5 },
  { name: "Maqluba (rice, eggplant & meat)", portion: "1 cup (240g)", calories: 360, proteinG: 16, carbsG: 48, fatG: 12 },
  { name: "Mujadara (lentils & rice)", portion: "1 cup (235g)", calories: 410, proteinG: 14, carbsG: 71, fatG: 12 },
  { name: "Koshari", portion: "1 serving (350g)", calories: 400, proteinG: 15, carbsG: 70, fatG: 10 },
  { name: "Mansaf (lamb, yogurt & rice)", portion: "1 cup (240g)", calories: 560, proteinG: 28, carbsG: 40, fatG: 32 },
  { name: "Shakshuka", portion: "1 cup, ~2 eggs (240g)", calories: 160, proteinG: 6, carbsG: 12, fatG: 8 },
  { name: "Molokhia (jute mallow stew)", portion: "1 cup (238g)", calories: 88, proteinG: 7, carbsG: 16, fatG: 0.5 },
  { name: "Grape leaves, stuffed (vegetarian)", portion: "1 piece (20g)", calories: 29, proteinG: 0.6, carbsG: 3.4, fatG: 1.4 },
  { name: "Grape leaves, stuffed (with meat)", portion: "1 piece (20g)", calories: 38, proteinG: 1.8, carbsG: 3, fatG: 2.2 },
  { name: "Pita bread, white", portion: "1 large pita (60g)", calories: 154, proteinG: 5, carbsG: 31, fatG: 0.7 },
  { name: "Pita bread, whole wheat", portion: "1 large pita (60g)", calories: 160, proteinG: 6, carbsG: 33, fatG: 1.2 },
  { name: "Za'atar manakish", portion: "1 flatbread (120g)", calories: 300, proteinG: 7, carbsG: 40, fatG: 12 },
  { name: "Freekeh, cooked", portion: "1 cup (175g)", calories: 219, proteinG: 9, carbsG: 42, fatG: 1.4 },
  { name: "Bulgur, cooked", portion: "1 cup (182g)", calories: 151, proteinG: 5.6, carbsG: 34, fatG: 0.4 },
  { name: "Couscous, cooked", portion: "1 cup (157g)", calories: 176, proteinG: 6, carbsG: 36, fatG: 0.3 },
  { name: "Rice with vermicelli", portion: "1 cup (200g)", calories: 333, proteinG: 7, carbsG: 60, fatG: 7 },
  { name: "Tabbouleh", portion: "1 cup (160g)", calories: 150, proteinG: 3, carbsG: 17, fatG: 8 },
  { name: "Fattoush", portion: "1 cup (235g)", calories: 177, proteinG: 3.5, carbsG: 24, fatG: 8 },
  { name: "Greek salad (no dressing)", portion: "1 cup (105g)", calories: 50, proteinG: 3, carbsG: 5, fatG: 2.4 },
  { name: "Halloumi, grilled", portion: "2 oz (56g)", calories: 187, proteinG: 12, carbsG: 0.8, fatG: 15 },
  { name: "Feta cheese", portion: "1 oz (28g)", calories: 75, proteinG: 4, carbsG: 1.1, fatG: 6 },
  { name: "Olives (kalamata/mixed)", portion: "10 olives (50g)", calories: 150, proteinG: 0, carbsG: 3, fatG: 15 },
  { name: "Za'atar spice blend", portion: "1 tbsp (8g)", calories: 30, proteinG: 1, carbsG: 2, fatG: 2 },
  { name: "Baklava", portion: "1 piece (80g)", calories: 352, proteinG: 5, carbsG: 30, fatG: 23 },
  { name: "Knafeh / kunafa", portion: "1 slice (150g)", calories: 450, proteinG: 10, carbsG: 50, fatG: 25 },
  { name: "Umm Ali", portion: "1 serving (200g)", calories: 450, proteinG: 7, carbsG: 50, fatG: 20 },
  { name: "Ma'amoul (date-filled cookie)", portion: "1 cookie (38g)", calories: 180, proteinG: 2, carbsG: 25, fatG: 8 },
  { name: "Rice pudding (muhallabia)", portion: "1/2 cup (130g)", calories: 141, proteinG: 4, carbsG: 24, fatG: 3 },
  { name: "Arabic coffee, unsweetened", portion: "1 small cup (60ml)", calories: 2, proteinG: 0, carbsG: 0, fatG: 0 },
  { name: "Mint tea, unsweetened", portion: "1 cup (240ml)", calories: 2, proteinG: 0, carbsG: 0, fatG: 0 },
  { name: "Ayran / laban (yogurt drink)", portion: "1 cup (240ml)", calories: 60, proteinG: 4, carbsG: 4, fatG: 3 },
  { name: "Pomegranate juice", portion: "1 cup (240ml)", calories: 135, proteinG: 0.4, carbsG: 33, fatG: 0.3 },
];

// ---------------- Approximate ("fuzzy") name matching ----------------
//
// Lets the manual-entry auto-fill find the closest food even when what you
// typed isn't an exact match — plurals, typos, word order, or just part of
// a name ("grape leaf" -> "Grape leaves, stuffed (vegetarian)", "humus" ->
// "Hummus"). An exact match always wins outright; short of that, each food
// is scored by comparing your query word-by-word against its name (allowing
// prefixes and small typos via edit distance) and the highest-scoring food
// above a minimum confidence threshold is returned. Below that threshold
// nothing is returned, so an unrelated typed phrase won't silently
// auto-fill the wrong food's numbers.

function normalizeForMatch(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Classic edit-distance (Levenshtein) between two strings — small, dependency-
// free, fine for the short words/names involved here.
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[n];
}

// Similarity (0-1) between two single words: exact match, one a prefix of
// the other, or close enough by edit distance to catch typos/plurals.
function wordSimilarity(a, b) {
  if (a === b) return 1;
  if (a.startsWith(b) || b.startsWith(a)) return 0.85;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return Math.max(0, 1 - editDistance(a, b) / maxLen);
}

// Score how well a typed query matches one food's name, 0 (no relation) to
// 1 (exact match). Whole-string containment scores high; otherwise each
// query word is matched against its closest word in the food name and
// averaged, so extra/missing words in a multi-word dish name don't tank the
// score the way a plain whole-string comparison would.
function scoreFoodMatch(query, food) {
  const q = normalizeForMatch(query);
  const name = normalizeForMatch(food.name);
  if (!q) return 0;
  if (q === name) return 1;
  if (q.length >= 3 && name.includes(q)) return 0.9;
  const qWords = q.split(" ").filter(Boolean);
  const nameWords = name.split(" ").filter(Boolean);
  if (!qWords.length || !nameWords.length) return 0;
  const total = qWords.reduce((sum, qw) => {
    const best = nameWords.reduce((m, nw) => Math.max(m, wordSimilarity(qw, nw)), 0);
    return sum + best;
  }, 0);
  return total / qWords.length;
}

const MIN_MATCH_SCORE = 0.55;

// Find the single best-matching food for a typed query, or null if nothing
// clears the confidence threshold. Requires at least 2 characters so it
// doesn't guess off a single keystroke.
export function findFoodMatch(query) {
  const q = (query || "").trim();
  if (q.length < 2) return null;
  let best = null;
  let bestScore = 0;
  for (const food of COMMON_FOODS) {
    const score = scoreFoodMatch(q, food);
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return bestScore >= MIN_MATCH_SCORE ? best : null;
}
