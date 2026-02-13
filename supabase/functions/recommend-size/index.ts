import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Size ordering ───────────────────────────────────────────────
const NUMERIC_ORDER = ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"];
const LETTER_ORDER = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "2X", "3X", "4X"];

function sizeUp(size: string): string | null {
  const upper = size.toUpperCase().trim();
  const ni = NUMERIC_ORDER.indexOf(upper);
  if (ni !== -1 && ni < NUMERIC_ORDER.length - 1) return NUMERIC_ORDER[ni + 1];
  const li = LETTER_ORDER.indexOf(upper);
  if (li !== -1 && li < LETTER_ORDER.length - 1) return LETTER_ORDER[li + 1];
  return null;
}

function sizeDown(size: string): string | null {
  const upper = size.toUpperCase().trim();
  const ni = NUMERIC_ORDER.indexOf(upper);
  if (ni > 0) return NUMERIC_ORDER[ni - 1];
  const li = LETTER_ORDER.indexOf(upper);
  if (li > 0) return LETTER_ORDER[li - 1];
  return null;
}

// ── Size type classification ────────────────────────────────────
type SizeType = "letter" | "numeric" | "numeric_range" | "denim" | "brand_specific";
type ScaleTrack = "letter" | "numeric" | "brand_specific" | "denim";

const LETTER_REGEX = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|XXXS|2X|3X|4X)$/i;
const DENIM_WAIST_REGEX = /^W?(\d{2})$/i;
const NUMERIC_RANGE_REGEX = /^\d+-\d+$/;

const BRAND_SPECIFIC_SCALE_BRANDS = new Set(["zimmermann", "and_or_collective"]);

function isBrandSpecificScale(brandKey: string): boolean {
  return BRAND_SPECIFIC_SCALE_BRANDS.has(brandKey.toLowerCase());
}

function classifySizeType(sizeLabel: string, brandKey?: string): SizeType {
  const trimmed = sizeLabel.trim();
  if (LETTER_REGEX.test(trimmed)) return "letter";
  const denimMatch = trimmed.match(DENIM_WAIST_REGEX);
  if (denimMatch) {
    const n = parseInt(denimMatch[1], 10);
    if (n >= 22 && n <= 40) return "denim";
  }
  if (brandKey && isBrandSpecificScale(brandKey)) {
    if (/^\d+$/.test(trimmed)) return "brand_specific";
  }
  if (NUMERIC_RANGE_REGEX.test(trimmed)) return "numeric_range";
  if (/^\d+$/.test(trimmed)) return "numeric";
  return "letter";
}

function sizeTypeToTrack(st: SizeType): ScaleTrack {
  switch (st) {
    case "letter": return "letter";
    case "numeric": case "numeric_range": return "numeric";
    case "denim": return "denim";
    case "brand_specific": return "brand_specific";
  }
}

function sizeTypesCompatible(a: SizeType, b: SizeType): boolean {
  if (a === b) return true;
  if ((a === "numeric" || a === "numeric_range") && (b === "numeric" || b === "numeric_range")) return true;
  return false;
}

// ── Normalized measurement range ────────────────────────────────
interface NormalizedRange {
  min: number;
  max: number;
  midpoint: number;
}

function normalizeToRange(raw: unknown): NormalizedRange | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.mid !== undefined && typeof obj.mid === "number") {
      const min = typeof obj.min === "number" ? obj.min : obj.mid;
      const max = typeof obj.max === "number" ? obj.max : obj.mid;
      return { min, max, midpoint: obj.mid };
    }
    if (typeof obj.min === "number" && typeof obj.max === "number") {
      return { min: obj.min, max: obj.max, midpoint: (obj.min + obj.max) / 2 };
    }
    if (typeof obj.value === "number") {
      return { min: obj.value, max: obj.value, midpoint: obj.value };
    }
    if (Array.isArray(obj.options) && obj.options.length > 0) {
      const nums = (obj.options as Array<number | { min: number; max: number }>).map((o) =>
        typeof o === "number" ? o : (o.min + o.max) / 2
      );
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      return { min: Math.min(...nums), max: Math.max(...nums), midpoint: avg };
    }
    return null;
  }

  if (typeof raw === "number") {
    return { min: raw, max: raw, midpoint: raw };
  }

  if (typeof raw === "string") {
    const cleaned = raw.replace(/[""']/g, "").replace(/\s*(in|cm|inches|")\s*/gi, "").trim();
    if (!cleaned) return null;
    const dashMatch = cleaned.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
    if (dashMatch) {
      const a = parseFloat(dashMatch[1]);
      const b = parseFloat(dashMatch[2]);
      if (!isNaN(a) && !isNaN(b)) return { min: Math.min(a, b), max: Math.max(a, b), midpoint: (a + b) / 2 };
    }
    const slashMatch = cleaned.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
    if (slashMatch) {
      const a = parseFloat(slashMatch[1]);
      const b = parseFloat(slashMatch[2]);
      if (!isNaN(a) && !isNaN(b)) return { min: Math.min(a, b), max: Math.max(a, b), midpoint: (a + b) / 2 };
    }
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return { min: num, max: num, midpoint: num };
  }

  return null;
}

function normalizeMeasurements(raw: Record<string, unknown> | null): Record<string, NormalizedRange> {
  const result: Record<string, NormalizedRange> = {};
  if (!raw) return result;
  for (const [key, val] of Object.entries(raw)) {
    const nr = normalizeToRange(val);
    if (nr) result[key] = nr;
  }
  return result;
}

interface SizingRow {
  size_label: string;
  measurements: Record<string, unknown> | null;
  fit_notes: string | null;
}

// ── Category normalization ──────────────────────────────────────
const CATEGORY_ALIAS_MAP: Record<string, string> = {
  tops: "tops", top: "tops", t_shirts: "tops", sweatshirts: "tops", crops: "tops",
  bottoms: "bottoms", bottom: "bottoms", pants: "bottoms", shorts: "bottoms", skirts: "bottoms",
  trousers_long: "bottoms", trousers_regular: "bottoms", trousers_short: "bottoms",
  "trousers (long)": "bottoms", "trousers (regular)": "bottoms", "trousers (short)": "bottoms",
  leggings: "bottoms", leggings_regular: "bottoms", leggings_short: "bottoms",
  "leggings (regular)": "bottoms", "leggings (short)": "bottoms",
  denim: "denim", jeans: "denim",
  dresses: "dresses", dress: "dresses",
  swim: "swim", swimwear: "swim", "one-piece swimsuits": "swim", one_piece_swimsuits: "swim",
  bikinis: "swim", bikini_tops: "swim", bikini_bottoms: "swim",
  "bikini tops": "swim", "bikini bottoms": "swim",
  "sports bras": "sports_bras", sports_bras: "sports_bras", bras: "sports_bras",
  outerwear: "outerwear", jackets: "outerwear",
  bodysuits: "bodysuits",
  jumpsuits: "jumpsuits", playsuits: "jumpsuits",
  loungewear: "loungewear",
  shapewear: "shapewear",
  underwear: "underwear",
  shoes: "shoes",
};

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (CATEGORY_ALIAS_MAP[lower]) return CATEGORY_ALIAS_MAP[lower];
  return lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const CATEGORY_MEASUREMENT_KEYS: Record<string, string[]> = {
  tops: ["bust", "waist"],
  bottoms: ["waist", "hips"],
  denim: ["waist", "hips", "rise"],
  dresses: ["bust", "waist", "hips"],
  swim: ["bust", "waist", "hips", "underbust"],
  outerwear: ["bust", "waist", "shoulders"],
  sports_bras: ["bust", "underbust"],
  bodysuits: ["bust", "waist", "hips"],
  default: ["bust", "waist", "hips"],
};

function getMeasurementKeys(category: string): string[] {
  return CATEGORY_MEASUREMENT_KEYS[category] || CATEGORY_MEASUREMENT_KEYS.default;
}

// ── RANGE CONTAINMENT MODEL ─────────────────────────────────────

interface ContainmentResult {
  /** The single best size, or null if between/outside */
  exactMatch: string | null;
  /** If user is between two sizes */
  betweenSizes: [string, string] | null;
  /** Explanation of the match */
  matchExplanation: string;
  /** Debug info per dimension per size */
  sizeDetails: Record<string, { dimension: string; userMid: number; rangeMin: number; rangeMax: number; contained: boolean }[]>;
  /** Which target row was used */
  targetRowUsed: SizingRow | null;
  /** Fit notes */
  fitNotes: string | null;
}

/**
 * Simple range containment: for each target size, check if the user's
 * measurement midpoints fall within the size's min-max range.
 * - If exactly one size contains all measurements → return it.
 * - If user falls between two sizes → return both.
 * - If no match → return null with explanation.
 */
function findContainedSize(
  anchorMeasurements: Record<string, unknown> | null,
  targetSizes: SizingRow[],
  category: string,
): ContainmentResult {
  const noMatch: ContainmentResult = {
    exactMatch: null,
    betweenSizes: null,
    matchExplanation: "Measurement outside this brand's size chart range.",
    sizeDetails: {},
    targetRowUsed: null,
    fitNotes: null,
  };

  if (!anchorMeasurements || targetSizes.length === 0) return noMatch;

  const keys = getMeasurementKeys(category);
  const anchorNorm = normalizeMeasurements(anchorMeasurements as Record<string, unknown>);

  // Get user midpoints for the priority dimensions
  const userMidpoints: Record<string, number> = {};
  for (const k of keys) {
    if (anchorNorm[k]) {
      userMidpoints[k] = anchorNorm[k].midpoint;
    }
  }
  // Also pick up any extra dimensions present
  for (const k of Object.keys(anchorNorm)) {
    if (!userMidpoints[k]) {
      userMidpoints[k] = anchorNorm[k].midpoint;
    }
  }

  if (Object.keys(userMidpoints).length === 0) return noMatch;

  // Score each size: count how many dimensions contain the user midpoint
  const sizeScores: {
    size: string;
    row: SizingRow;
    containedCount: number;
    checkedCount: number;
    details: { dimension: string; userMid: number; rangeMin: number; rangeMax: number; contained: boolean }[];
  }[] = [];

  const allSizeDetails: Record<string, { dimension: string; userMid: number; rangeMin: number; rangeMax: number; contained: boolean }[]> = {};

  for (const row of targetSizes) {
    if (!row.measurements) continue;
    const targetNorm = normalizeMeasurements(row.measurements as Record<string, unknown>);

    let containedCount = 0;
    let checkedCount = 0;
    const details: { dimension: string; userMid: number; rangeMin: number; rangeMax: number; contained: boolean }[] = [];

    for (const [k, userMid] of Object.entries(userMidpoints)) {
      const target = targetNorm[k];
      if (!target) continue;

      checkedCount++;
      const contained = userMid >= target.min && userMid <= target.max;
      if (contained) containedCount++;

      details.push({
        dimension: k,
        userMid,
        rangeMin: target.min,
        rangeMax: target.max,
        contained,
      });
    }

    allSizeDetails[row.size_label] = details;

    if (checkedCount > 0) {
      sizeScores.push({ size: row.size_label, row, containedCount, checkedCount, details });
    }
  }

  if (sizeScores.length === 0) return { ...noMatch, sizeDetails: allSizeDetails };

  // Sort by containedCount descending, then checkedCount descending
  sizeScores.sort((a, b) => {
    if (a.containedCount !== b.containedCount) return b.containedCount - a.containedCount;
    return b.checkedCount - a.checkedCount;
  });

  const best = sizeScores[0];

  // If best has all checked dimensions contained → exact match
  if (best.containedCount > 0 && best.containedCount === best.checkedCount) {
    return {
      exactMatch: best.size,
      betweenSizes: null,
      matchExplanation: `Your measurements fall within ${best.size} across ${best.containedCount} dimension(s).`,
      sizeDetails: allSizeDetails,
      targetRowUsed: best.row,
      fitNotes: best.row.fit_notes,
    };
  }

  // If best has at least one contained dimension, check if user is "between" this and the next size
  if (best.containedCount > 0) {
    // Find a second-best that also has containment on different dimensions
    const secondBest = sizeScores.find((s, i) => i > 0 && s.containedCount > 0);
    if (secondBest) {
      return {
        exactMatch: null,
        betweenSizes: [best.size, secondBest.size],
        matchExplanation: `Your measurements fall between ${best.size} and ${secondBest.size}. Some dimensions fit ${best.size} while others fit ${secondBest.size}.`,
        sizeDetails: allSizeDetails,
        targetRowUsed: best.row,
        fitNotes: best.row.fit_notes,
      };
    }
    // Only one size has partial containment — return it as best guess
    return {
      exactMatch: best.size,
      betweenSizes: null,
      matchExplanation: `Your measurements partially fall within ${best.size} (${best.containedCount}/${best.checkedCount} dimensions).`,
      sizeDetails: allSizeDetails,
      targetRowUsed: best.row,
      fitNotes: best.row.fit_notes,
    };
  }

  // No containment at all — find the two closest sizes by checking proximity
  // Use the first priority dimension's midpoint to find adjacent sizes
  const primaryKey = keys.find(k => userMidpoints[k] !== undefined);
  if (primaryKey) {
    const userVal = userMidpoints[primaryKey];
    const withRange = sizeScores
      .map(s => {
        const d = s.details.find(dd => dd.dimension === primaryKey);
        if (!d) return null;
        const midOfRange = (d.rangeMin + d.rangeMax) / 2;
        return { ...s, rangeMid: midOfRange, dist: Math.abs(userVal - midOfRange) };
      })
      .filter(Boolean)
      .sort((a, b) => a!.dist - b!.dist) as { size: string; row: SizingRow; rangeMid: number; dist: number; details: typeof sizeScores[0]["details"] }[];

    if (withRange.length >= 2) {
      const lower = withRange[0];
      const upper = withRange[1];
      return {
        exactMatch: null,
        betweenSizes: [lower.size, upper.size],
        matchExplanation: `Your ${primaryKey} measurement (${userVal}″) falls between ${lower.size} and ${upper.size}.`,
        sizeDetails: allSizeDetails,
        targetRowUsed: lower.row,
        fitNotes: lower.row.fit_notes,
      };
    }
    if (withRange.length === 1) {
      return {
        exactMatch: withRange[0].size,
        betweenSizes: null,
        matchExplanation: `${withRange[0].size} is the closest size based on your ${primaryKey} measurement.`,
        sizeDetails: allSizeDetails,
        targetRowUsed: withRange[0].row,
        fitNotes: withRange[0].row.fit_notes,
      };
    }
  }

  return { ...noMatch, sizeDetails: allSizeDetails };
}

// ── Size scale conversion ───────────────────────────────────────
const LETTER_TO_NUMERIC: Record<string, string> = {
  XXXS: "00", XXS: "0", XS: "2", S: "4", M: "6", L: "10", XL: "12", "2X": "16", "3X": "18", "4X": "20"
};
const NUMERIC_TO_LETTER: Record<string, string> = {
  "00": "XXXS", "0": "XXS", "2": "XS", "4": "S", "6": "M", "8": "M", "10": "L", "12": "XL", "14": "XL", "16": "2X", "18": "3X", "20": "4X"
};

const UNIVERSAL_SIZE_MAP: Record<string, number> = {
  "00": 0, "0": 1, "2": 2, "4": 3, "6": 4, "8": 5, "10": 6, "12": 7, "14": 8, "16": 9, "18": 10, "20": 11,
  "XXXS": 0, "XXS": 1, "XS": 2, "S": 3, "M": 4, "L": 6, "XL": 7, "2X": 9, "3X": 10, "4X": 11,
  "34": 0, "36": 1, "38": 2, "40": 3, "42": 4, "44": 5, "46": 6, "48": 7,
  "22": 0, "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9, "33": 10,
};

const BRAND_SCALE_MAPS: Record<string, Record<string, number>> = {
  zimmermann: { "0": 1, "1": 2, "2": 4, "3": 6, "4": 8, "5": 10 },
  and_or_collective: { "1": 2, "2": 6, "3": 10 },
  seven_for_all_mankind: { "22": 0, "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9 },
  mother: { "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9, "33": 10, "34": 11 },
  revolve_denim: { "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9 },
  david_koma: { "4": 1, "6": 2, "8": 3, "10": 4, "12": 5, "14": 6, "16": 7 },
  victoria_beckham: { "4": 1, "6": 2, "8": 3, "10": 4, "12": 5, "14": 6, "16": 7 },
};

function getUniversalIndex(size: string, brandKey?: string): number {
  const upper = size.toUpperCase().trim();
  if (brandKey && BRAND_SCALE_MAPS[brandKey]) {
    const brandIdx = BRAND_SCALE_MAPS[brandKey][upper];
    if (brandIdx !== undefined) return brandIdx;
  }
  if (UNIVERSAL_SIZE_MAP[upper] !== undefined) return UNIVERSAL_SIZE_MAP[upper];
  const num = parseFloat(upper);
  if (!isNaN(num)) return num;
  return -1;
}

function isNumericSize(size: string): boolean {
  return NUMERIC_ORDER.includes(size.toUpperCase().trim());
}

function isLetterSize(size: string): boolean {
  return LETTER_ORDER.includes(size.toUpperCase().trim());
}

function convertToScale(size: string, targetScale: string): string {
  const upper = size.toUpperCase().trim();
  if (targetScale === "letter" && isNumericSize(upper)) return NUMERIC_TO_LETTER[upper] || upper;
  if (targetScale === "numeric" && isLetterSize(upper)) return LETTER_TO_NUMERIC[upper] || upper;
  return upper;
}

function snapToAvailableSize(size: string, availableSizes: string[], fitPreference: string, brandKey?: string): string {
  if (!availableSizes.length) return size;
  const upper = size.toUpperCase().trim();
  if (availableSizes.map(s => s.toUpperCase()).includes(upper)) return upper;

  const inputIdx = getUniversalIndex(upper, brandKey);
  if (inputIdx === -1) return availableSizes[Math.floor(availableSizes.length / 2)];

  let bestSize = availableSizes[0];
  let bestDist = Infinity;
  for (const avail of availableSizes) {
    const availIdx = getUniversalIndex(avail, brandKey);
    if (availIdx === -1) continue;
    const dist = Math.abs(availIdx - inputIdx);
    if (dist < bestDist) { bestDist = dist; bestSize = avail; }
  }
  return bestSize;
}

function fallbackSizeMapping(anchorSize: string, fitPreference: string, targetScale: string, availableSizes: string[], anchorBrandKey?: string, targetBrandKey?: string, anchorScale?: string): string {
  const scalesMatch = anchorScale && anchorScale === targetScale;
  if (scalesMatch) {
    let resultSize = anchorSize.toUpperCase().trim();
    if (fitPreference === "fitted") { const down = sizeDown(resultSize); if (down) resultSize = down; }
    else if (fitPreference === "relaxed") { const up = sizeUp(resultSize); if (up) resultSize = up; }
    if (availableSizes.length) {
      const upperAvail = availableSizes.map(s => s.toUpperCase());
      if (!upperAvail.includes(resultSize)) resultSize = snapToAvailableSize(resultSize, availableSizes, fitPreference, targetBrandKey);
    }
    return resultSize;
  }

  const anchorIdx = getUniversalIndex(anchorSize, anchorBrandKey);
  if (availableSizes.length && anchorIdx !== -1) {
    let adjustedIdx = anchorIdx;
    if (fitPreference === "fitted") adjustedIdx -= 1;
    else if (fitPreference === "relaxed") adjustedIdx += 1;
    let bestSize = availableSizes[0];
    let bestDist = Infinity;
    for (const avail of availableSizes) {
      const availIdx = getUniversalIndex(avail, targetBrandKey);
      if (availIdx === -1) continue;
      const dist = Math.abs(availIdx - adjustedIdx);
      if (dist < bestDist) { bestDist = dist; bestSize = avail; }
    }
    return bestSize;
  }

  let resultSize = convertToScale(anchorSize, targetScale);
  if (fitPreference === "fitted") { const down = sizeDown(resultSize); if (down) resultSize = down; }
  else if (fitPreference === "relaxed") { const up = sizeUp(resultSize); if (up) resultSize = up; }
  if (availableSizes.length) resultSize = snapToAvailableSize(resultSize, availableSizes, fitPreference, targetBrandKey);
  return resultSize;
}

// ── AI body measurement estimation ──────────────────────────────

interface MeasurementValue {
  value?: number;
  min?: number;
  max?: number;
  mid?: number;
  options?: (number | { min: number; max: number })[];
  unit?: string;
}

async function estimateBodyMeasurements(
  weight: string, height: string, fitPreference: string,
): Promise<Record<string, MeasurementValue> | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;
  try {
    const prompt = `Given a woman who weighs ${weight} and is ${height} tall with a "${fitPreference.replace(/_/g, " ")}" fit preference, estimate her body measurements in inches. Return bust, waist, hips, underbust, thigh, and shoulders as numeric ranges (min-max). Be realistic and use standard fashion industry measurement guides.`;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a body measurement estimation expert. Return measurements as JSON via the tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "body_measurements",
            description: "Estimated body measurements in inches",
            parameters: {
              type: "object",
              properties: {
                bust_min: { type: "number" }, bust_max: { type: "number" },
                waist_min: { type: "number" }, waist_max: { type: "number" },
                hips_min: { type: "number" }, hips_max: { type: "number" },
                underbust_min: { type: "number" }, underbust_max: { type: "number" },
                thigh_min: { type: "number" }, thigh_max: { type: "number" },
                shoulders_min: { type: "number" }, shoulders_max: { type: "number" },
              },
              required: ["bust_min", "bust_max", "waist_min", "waist_max", "hips_min", "hips_max"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "body_measurements" } },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    const args = JSON.parse(toolCall.function.arguments);
    const result: Record<string, MeasurementValue> = {};
    const pairs = [["bust", "bust_min", "bust_max"], ["waist", "waist_min", "waist_max"], ["hips", "hips_min", "hips_max"], ["underbust", "underbust_min", "underbust_max"], ["thigh", "thigh_min", "thigh_max"], ["shoulders", "shoulders_min", "shoulders_max"]];
    for (const [key, minKey, maxKey] of pairs) {
      if (args[minKey] !== undefined && args[maxKey] !== undefined) result[key] = { min: args[minKey], max: args[maxKey], unit: "in" };
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    console.error("Body estimation failed:", e);
    return null;
  }
}

// ── Product page fit scraping ───────────────────────────────────

async function scrapeProductFit(productUrl: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const pageResp = await fetch(productUrl, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ALTAANA/1.0)" } });
    clearTimeout(timeout);
    if (!pageResp.ok) return null;
    const html = await pageResp.text();
    const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 12000);
    if (stripped.length < 100) return null;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Extract fit, sizing, and fabric/material info from this product page text. Return a concise summary (under 80 words) covering: fit details, fabric composition, stretch level, and any specific measurements mentioned. If no info is found, return empty string." },
          { role: "user", content: stripped },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_fit",
            description: "Extract product fit and fabric details",
            parameters: { type: "object", properties: { fit_summary: { type: "string" } }, required: ["fit_summary"], additionalProperties: false },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_fit" } },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) { const args = JSON.parse(toolCall.function.arguments); return args.fit_summary || null; }
    return null;
  } catch (e) {
    console.error("Product scrape failed:", e);
    return null;
  }
}

// ── AI bullet generation ────────────────────────────────────────

interface BulletContext {
  anchorBrands: { displayName: string; size: string }[];
  targetBrand: string;
  recommendedSize: string;
  fitPreference: string;
  fitNotes: string | null;
  targetFitTendency: string | null;
  productFitSummary: string | null;
  matchExplanation: string;
  betweenSizes: [string, string] | null;
}

async function generateBullets(context: BulletContext): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return generateFallbackBullets(context);
  try {
    const prompt = `You are a sizing expert for a women's fashion sizing tool called ALTAANA. Generate exactly 3 short, helpful bullet points explaining why we recommend size "${context.recommendedSize}" in ${context.targetBrand}.

Context:
- The user wears: ${context.anchorBrands.map(a => `${a.size} in ${a.displayName}`).join(", ")}
- Their fit preference: ${context.fitPreference.replace(/_/g, " ")}
${context.fitNotes ? `- Brand fit notes: ${context.fitNotes}` : ""}
${context.targetFitTendency ? `- ${context.targetBrand} generally ${context.targetFitTendency.replace(/_/g, " ")}` : ""}
${context.productFitSummary ? `- This specific product: ${context.productFitSummary}` : ""}
- Match result: ${context.matchExplanation}
${context.betweenSizes ? `- User is between sizes ${context.betweenSizes[0]} and ${context.betweenSizes[1]}` : ""}

Rules:
- Each bullet must be under 15 words
- First bullet references what they wear in their anchor brand
- Second bullet explains the measurement match clearly
- Third bullet: ONLY mention fabric/stretch if productFitSummary contains fabric info. Otherwise mention fit preference or brand tendency.
- Be definitive and confident
- Do NOT use bullet point characters, just return plain text
- Do NOT invent fabric claims`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a concise sizing expert. Return exactly 3 lines, one bullet per line. No numbering, no bullet characters." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "size_bullets",
            description: "Return 3 explanation bullets for a size recommendation",
            parameters: {
              type: "object",
              properties: { bullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 } },
              required: ["bullets"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "size_bullets" } },
      }),
    });
    if (!response.ok) return generateFallbackBullets(context);
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      if (Array.isArray(args.bullets) && args.bullets.length >= 3) return args.bullets.slice(0, 3);
    }
    return generateFallbackBullets(context);
  } catch (e) {
    console.error("Bullet generation failed:", e);
    return generateFallbackBullets(context);
  }
}

function generateFallbackBullets(context: BulletContext): string[] {
  const bullets: string[] = [];
  if (context.anchorBrands.length > 0) {
    const a = context.anchorBrands[0];
    bullets.push(`Based on your ${a.size} in ${a.displayName}`);
  } else {
    bullets.push(`Recommended for ${context.targetBrand}`);
  }

  if (context.betweenSizes) {
    bullets.push(`You're between ${context.betweenSizes[0]} and ${context.betweenSizes[1]}; ${context.recommendedSize} is the better fit`);
  } else {
    bullets.push(`Your measurements fall within ${context.recommendedSize} for this brand`);
  }

  const hasFabric = context.productFitSummary && /stretch|elastane|spandex|silk|cotton/i.test(context.productFitSummary);
  if (hasFabric) {
    bullets.push(`This item's fabric may affect the fit`);
  } else if (context.targetFitTendency) {
    bullets.push(`${context.targetBrand} tends to ${context.targetFitTendency.replace(/_/g, " ")}`);
  } else {
    const pref = context.fitPreference === "true_to_size" ? "standard" : context.fitPreference;
    bullets.push(`Selected for your ${pref} fit preference`);
  }

  return bullets;
}

// ── Comparisons ─────────────────────────────────────────────────

interface BrandComparison {
  brandName: string;
  size: string;
  fitTag: string;
}

function generateComparisons(
  anchorBrands: { displayName: string; size: string; brandKey: string }[],
  targetBrand: string,
  recommendedSize: string,
  targetFitTendency: string | null,
): BrandComparison[] {
  const comparisons: BrandComparison[] = [];
  for (const anchor of anchorBrands) {
    let fitTag = "true to size";
    if (targetFitTendency) {
      fitTag = targetFitTendency.replace(/_/g, " ");
    }
    comparisons.push({ brandName: anchor.displayName, size: anchor.size, fitTag });
  }
  return comparisons;
}

// ── Main handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      anchor_brands,
      fit_preference,
      target_brand_key,
      target_category,
      user_id,
      product_url,
      weight,
      height,
      debug_mode,
      brand_source,
    } = await req.json();

    if (!anchor_brands?.length || !target_brand_key) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: anchor_brands, target_brand_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch target brand info
    const { data: targetBrand } = await supabase
      .from("brand_catalog")
      .select("display_name, fit_tendency, size_scale, available_sizes")
      .eq("brand_key", target_brand_key)
      .single();

    const targetDisplayName = targetBrand?.display_name || target_brand_key.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const targetFitTendency = targetBrand?.fit_tendency || null;
    const targetSizeScale = targetBrand?.size_scale || "letter";
    const availableSizes: string[] = (targetBrand?.available_sizes as string[]) || [];

    // 1b. Classify anchor
    const anchorBrandKey0 = anchor_brands[0]?.brandKey;
    const anchorSizeLabel0 = anchor_brands[0]?.size || "";
    const anchorSizeType = classifySizeType(anchorSizeLabel0, anchorBrandKey0);
    const anchorScaleTrack = sizeTypeToTrack(anchorSizeType);

    // 2. Normalize category
    const detectedCategoryRaw = target_category || "tops";
    const category = normalizeCategory(detectedCategoryRaw);

    // Category variants for DB query
    const categoryVariants = new Set<string>([category]);
    categoryVariants.add(detectedCategoryRaw.toLowerCase().trim());
    const REVERSE_CATEGORY_MAP: Record<string, string[]> = {
      tops: ["tops", "t_shirts", "sweatshirts", "crops"],
      bottoms: ["bottoms", "pants", "shorts", "skirts", "leggings", "leggings_regular", "leggings_short", "trousers_long", "trousers_regular", "trousers_short"],
      denim: ["denim", "jeans"],
      dresses: ["dresses", "dresses "],
      swim: ["swim", "swimwear", "one-piece swimsuits", "one_piece_swimsuits", "bikinis", "bikini_tops", "bikini_bottoms"],
      sports_bras: ["sports bras", "sports_bras", "bras"],
      outerwear: ["outerwear", "jackets"],
      bodysuits: ["bodysuits"],
      jumpsuits: ["jumpsuits", "playsuits"],
      loungewear: ["loungewear"],
      shapewear: ["shapewear"],
      underwear: ["underwear"],
      shoes: ["shoes"],
    };
    if (REVERSE_CATEGORY_MAP[category]) {
      for (const v of REVERSE_CATEGORY_MAP[category]) categoryVariants.add(v);
    }

    // Query target sizing data
    const ROW_QUALITY_THRESHOLD = 2;
    let targetSizingDataRaw: Array<{ size_label: string; measurements: Record<string, unknown> | null; fit_notes: string | null; size_scale: string; row_quality: number }> = [];
    const { data: targetDataExact } = await supabase
      .from("sizing_charts")
      .select("size_label, measurements, fit_notes, size_scale, row_quality")
      .eq("brand_key", target_brand_key)
      .in("category", [...categoryVariants])
      .gte("row_quality", ROW_QUALITY_THRESHOLD);

    targetSizingDataRaw = targetDataExact || [];

    // Retry without quality filter
    if (targetSizingDataRaw.length === 0) {
      const { data: targetDataAll } = await supabase
        .from("sizing_charts")
        .select("size_label, measurements, fit_notes, size_scale, row_quality")
        .eq("brand_key", target_brand_key)
        .in("category", [...categoryVariants]);
      targetSizingDataRaw = targetDataAll || [];
    }

    // Brand-only fallback
    let categoryFallbackUsed = false;
    if (targetSizingDataRaw.length === 0) {
      const { data: targetDataAll } = await supabase
        .from("sizing_charts")
        .select("size_label, measurements, fit_notes, size_scale, row_quality")
        .eq("brand_key", target_brand_key)
        .gte("row_quality", ROW_QUALITY_THRESHOLD);
      targetSizingDataRaw = targetDataAll || [];
      categoryFallbackUsed = true;
    }

    // Track splitting
    const allTargetRows = targetSizingDataRaw;
    const targetTrackGroups: Record<ScaleTrack, typeof allTargetRows> = { letter: [], numeric: [], brand_specific: [], denim: [] };
    for (const row of allTargetRows) {
      const st = classifySizeType(row.size_label, target_brand_key);
      const track = sizeTypeToTrack(st);
      targetTrackGroups[track].push(row);
    }
    const targetTracksAvailable: ScaleTrack[] = (Object.keys(targetTrackGroups) as ScaleTrack[]).filter(t => targetTrackGroups[t].length > 0);

    let trackUsed: ScaleTrack = anchorScaleTrack;
    let conversionFallbackUsed = false;

    if (targetTrackGroups[anchorScaleTrack]?.length > 0) {
      trackUsed = anchorScaleTrack;
    } else if (targetTracksAvailable.length > 0) {
      const preferred: ScaleTrack[] = ["letter", "numeric", "denim", "brand_specific"];
      trackUsed = preferred.find(t => targetTrackGroups[t].length > 0) || targetTracksAvailable[0];
      conversionFallbackUsed = true;
    }

    let targetSizingData = targetTrackGroups[trackUsed] || [];
    if (targetSizingData.length === 0 && allTargetRows.length > 0) {
      targetSizingData = allTargetRows;
      conversionFallbackUsed = true;
    }

    // 3. Fetch anchor brand sizing data
    const anchorBrandKeys = anchor_brands.map((a: { brandKey: string }) => a.brandKey);
    let anchorSizingDataAll: Array<{ brand_key: string; size_label: string; measurements: Record<string, unknown> | null; size_scale: string; row_quality: number }> = [];
    const { data: anchorDataExact } = await supabase
      .from("sizing_charts")
      .select("brand_key, size_label, measurements, size_scale, row_quality")
      .in("brand_key", anchorBrandKeys)
      .in("category", [...categoryVariants])
      .gte("row_quality", ROW_QUALITY_THRESHOLD);

    anchorSizingDataAll = anchorDataExact || [];

    if (anchorSizingDataAll.length === 0) {
      const { data: anchorDataAll } = await supabase
        .from("sizing_charts")
        .select("brand_key, size_label, measurements, size_scale, row_quality")
        .in("brand_key", anchorBrandKeys);
      anchorSizingDataAll = anchorDataAll || [];
    }

    const anchorSizingData = anchorSizingDataAll.filter(r => {
      const rowType = classifySizeType(r.size_label, r.brand_key || anchorBrandKey0);
      return sizeTypesCompatible(rowType, anchorSizeType);
    });

    // 4. Determine recommended size
    let recommendedSize: string = "";
    let fitNotes: string | null = null;
    let usedFallback = false;
    let usedEstimated = false;
    let containmentResult: ContainmentResult | null = null;
    const isSameBrand = anchorBrandKey0 === target_brand_key;

    // ── SAME-BRAND SHORTCUT ─────────────────────────────────────
    if (isSameBrand) {
      recommendedSize = anchor_brands[0].size;
      const fp = fit_preference || "true_to_size";
      if (fp === "fitted") { const down = sizeDown(recommendedSize); if (down) recommendedSize = down; }
      else if (fp === "relaxed") { const up = sizeUp(recommendedSize); if (up) recommendedSize = up; }
      if (availableSizes.length) {
        const upper = recommendedSize.toUpperCase().trim();
        if (!availableSizes.map(s => s.toUpperCase()).includes(upper)) {
          recommendedSize = snapToAvailableSize(recommendedSize, availableSizes, fp, target_brand_key);
        }
      }
    } else {
      // ── CROSS-BRAND: RANGE CONTAINMENT ────────────────────────

      // Estimate body measurements if weight/height provided
      let estimatedMeasurements: Record<string, MeasurementValue> | null = null;
      if (weight || height) {
        estimatedMeasurements = await estimateBodyMeasurements(weight || "", height || "", fit_preference || "true_to_size");
        if (estimatedMeasurements) usedEstimated = true;
      }

      // Get anchor measurements
      let anchorMeasurements: Record<string, unknown> | null = null;
      if (anchorSizingData?.length) {
        const anchorBrand = anchor_brands[0];
        const anchorRow = anchorSizingData.find(
          (r) => r.brand_key === anchorBrand.brandKey && r.size_label.toUpperCase() === anchorBrand.size.toUpperCase()
        );
        if (anchorRow?.measurements) anchorMeasurements = anchorRow.measurements;
      }

      // Blend estimated measurements
      if (estimatedMeasurements) {
        if (anchorMeasurements) {
          for (const [k, v] of Object.entries(estimatedMeasurements)) {
            if (!(anchorMeasurements as Record<string, unknown>)[k]) {
              (anchorMeasurements as Record<string, unknown>)[k] = v;
            }
          }
        } else {
          anchorMeasurements = estimatedMeasurements as Record<string, unknown>;
        }
      }

      if (anchorMeasurements && targetSizingData.length > 0) {
        containmentResult = findContainedSize(
          anchorMeasurements,
          targetSizingData as SizingRow[],
          category,
        );

        if (containmentResult.exactMatch) {
          recommendedSize = containmentResult.exactMatch;
          fitNotes = containmentResult.fitNotes;
        } else if (containmentResult.betweenSizes) {
          // Between two sizes — pick based on fit preference
          const [sizeA, sizeB] = containmentResult.betweenSizes;
          const fp = fit_preference || "true_to_size";
          const idxA = getUniversalIndex(sizeA, target_brand_key);
          const idxB = getUniversalIndex(sizeB, target_brand_key);
          if (fp === "fitted") {
            recommendedSize = idxA <= idxB ? sizeA : sizeB;
          } else if (fp === "relaxed") {
            recommendedSize = idxA >= idxB ? sizeA : sizeB;
          } else {
            // true_to_size — pick the first (closest match)
            recommendedSize = sizeA;
          }
          fitNotes = containmentResult.fitNotes;
        } else {
          // No containment — fallback
          usedFallback = true;
          recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchorBrandKey0, target_brand_key, anchorSizeType);
        }
      } else {
        // No measurements available — fallback
        usedFallback = true;
        recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchorBrandKey0, target_brand_key, anchorSizeType);
      }

      // Apply fit preference shift for exact matches (not between-sizes)
      if (!usedFallback && containmentResult?.exactMatch) {
        const fp = fit_preference || "true_to_size";
        if (fp === "fitted") { const down = sizeDown(recommendedSize); if (down) recommendedSize = down; }
        else if (fp === "relaxed") { const up = sizeUp(recommendedSize); if (up) recommendedSize = up; }
      }

      // Final snap to available sizes within chosen track
      if (recommendedSize) {
        const trackSizeFilter = (s: string) => {
          const st = classifySizeType(s, target_brand_key);
          const t = sizeTypeToTrack(st);
          return t === trackUsed || (trackUsed === "numeric" && t === "numeric");
        };
        const sameTrackAvailable = availableSizes.filter(trackSizeFilter);
        if (sameTrackAvailable.length) {
          recommendedSize = snapToAvailableSize(recommendedSize, sameTrackAvailable, fit_preference || "true_to_size", target_brand_key);
        } else if (availableSizes.length) {
          recommendedSize = snapToAvailableSize(recommendedSize, availableSizes, fit_preference || "true_to_size", target_brand_key);
        }
      }
    }

    // ── Build match explanation ──────────────────────────────────
    const matchExplanation = containmentResult?.matchExplanation || (isSameBrand ? "Same brand — direct size match" : "Mapped via size index");
    const betweenSizes = containmentResult?.betweenSizes || null;

    // 5. Scrape product-specific fit info if URL provided
    let productFitSummary: string | null = null;
    if (product_url) {
      productFitSummary = await scrapeProductFit(product_url);
    }

    // 6. Generate AI bullets
    const bullets = await generateBullets({
      anchorBrands: anchor_brands,
      targetBrand: targetDisplayName,
      recommendedSize,
      fitPreference: fit_preference || "true_to_size",
      fitNotes,
      targetFitTendency,
      productFitSummary,
      matchExplanation,
      betweenSizes,
    });

    // 7. Generate comparisons
    const comparisons = generateComparisons(anchor_brands, targetDisplayName, recommendedSize, targetFitTendency);

    // 8. Log recommendation if user is authenticated
    let recommendationId: string | null = null;
    if (user_id) {
      const { data: recData } = await supabase
        .from("recommendations")
        .insert({
          user_id,
          brand_key: target_brand_key,
          product_url: product_url || null,
          recommended_size: recommendedSize,
          explanation_bullets: bullets,
        })
        .select("id")
        .single();
      recommendationId = recData?.id || null;
    }

    // ── Log every run ───────────────────────────────────────────
    try {
      await supabase.from("recommendation_runs").insert({
        user_id: user_id || null,
        target_brand: target_brand_key,
        category,
        product_url: product_url || null,
        anchor_brand: anchor_brands[0]?.brandKey || "unknown",
        anchor_size: anchor_brands[0]?.size || "unknown",
        output_status: recommendedSize ? "OK" : "NO_MATCH",
        recommended_size: recommendedSize || null,
        confidence: 0,
        coverage: 0,
        fallback_used: usedFallback,
        reason: !recommendedSize ? matchExplanation : null,
      });
    } catch (auditErr) {
      console.error("Failed to log recommendation run:", auditErr);
    }

    // ── Build response ──────────────────────────────────────────
    const responseBody: Record<string, unknown> = {
      size: recommendedSize,
      brandName: targetDisplayName,
      sizeScale: targetSizeScale,
      bullets,
      comparisons,
      productFitSummary,
      recommendation_id: recommendationId,
      needMoreInfo: false,
      betweenSizes,
      matchExplanation,
    };

    if (!recommendedSize) {
      responseBody.size = "";
      responseBody.needMoreInfo = true;
      responseBody.reason = matchExplanation;
      responseBody.ask_for = getMeasurementKeys(category)[0] || "bust";
    }

    // Debug trace (simplified)
    if (debug_mode) {
      const keys = getMeasurementKeys(category);
      responseBody.debug = {
        detectedCategoryRaw,
        normalizedCategory: category,
        categoryFallbackUsed,
        anchorBrand: anchor_brands[0]?.displayName || anchorBrandKey0,
        anchorSize: anchorSizeLabel0,
        anchorSizeType,
        anchorScaleTrack,
        targetBrandKey: target_brand_key,
        targetBrandDisplayName: targetDisplayName,
        targetSizeScale,
        availableSizes,
        fitPreference: fit_preference || "true_to_size",
        targetFitTendency,
        trackUsed,
        targetTracksAvailable,
        conversionFallbackUsed,
        keyDimensionsList: keys,
        usedFallback,
        usedEstimatedMeasurements: usedEstimated,
        matchExplanation,
        betweenSizes,
        targetRowUsed: containmentResult?.targetRowUsed ? {
          size_label: containmentResult.targetRowUsed.size_label,
          measurements: containmentResult.targetRowUsed.measurements,
          fit_notes: containmentResult.targetRowUsed.fit_notes,
        } : null,
        sizeDetails: containmentResult?.sizeDetails || {},
        targetRowsConsidered: targetSizingData.length,
      };
    }

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Recommendation error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
