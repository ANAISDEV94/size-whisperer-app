import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Size ordering for comparison ────────────────────────────────
const NUMERIC_ORDER = ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"];
const LETTER_ORDER = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "2X", "3X", "4X"];

function sizeIndex(size: string): number {
  const upper = size.toUpperCase().trim();
  const ni = NUMERIC_ORDER.indexOf(upper);
  if (ni !== -1) return ni;
  const li = LETTER_ORDER.indexOf(upper);
  if (li !== -1) return li + 100; // offset to separate from numeric
  return -1;
}

// ── Size type classification ────────────────────────────────────
// Classifies every size label into one of 4 types:
//   letter        – XXS, XS, S, M, L, XL, 2XL, 3XL, 4XL, etc.
//   numeric       – 0, 2, 4, 6, 8, 10, 12, 14
//   numeric_range – 4-6, 8-10, 12-14
//   denim         – integers 22-40 or W-prefixed (W24, W25)
const LETTER_REGEX = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|XXXS|2X|3X|4X)$/i;
const DENIM_WAIST_REGEX = /^W?(\d{2})$/i;
const NUMERIC_RANGE_REGEX = /^\d+-\d+$/;

type SizeType = "letter" | "numeric" | "numeric_range" | "denim";

function classifySizeType(sizeLabel: string): SizeType {
  const trimmed = sizeLabel.trim();
  if (LETTER_REGEX.test(trimmed)) return "letter";
  // Denim waist sizes: 22-40 or W22-W40
  const denimMatch = trimmed.match(DENIM_WAIST_REGEX);
  if (denimMatch) {
    const n = parseInt(denimMatch[1], 10);
    if (n >= 22 && n <= 40) return "denim";
  }
  // Numeric range like "4-6", "8-10"
  if (NUMERIC_RANGE_REGEX.test(trimmed)) return "numeric_range";
  // Plain numeric (0, 2, 4, 6…)
  if (/^\d+$/.test(trimmed)) return "numeric";
  return "letter"; // conservative default
}

// Helper: check if two size types are compatible for comparison
function sizeTypesCompatible(a: SizeType, b: SizeType): boolean {
  if (a === b) return true;
  // numeric and numeric_range are interchangeable
  if ((a === "numeric" || a === "numeric_range") && (b === "numeric" || b === "numeric_range")) return true;
  return false;
}

// Map size_type to size_scale values used in the DB
function sizeTypeToDbScale(st: SizeType): string[] {
  switch (st) {
    case "letter": return ["letter"];
    case "numeric": return ["numeric", "other"];
    case "numeric_range": return ["numeric", "other"];
    case "denim": return ["denim", "denim_waist"];
  }
}

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

// ── Deterministic size mapping ──────────────────────────────────

interface MeasurementValue {
  value?: number;
  min?: number;
  max?: number;
  mid?: number;
  options?: (number | { min: number; max: number })[];
  unit?: string;
}

// ── Normalized measurement range ────────────────────────────────
interface NormalizedRange {
  min: number;
  max: number;
  midpoint: number;
}

/**
 * Parse any measurement cell into a normalized {min, max, midpoint}.
 * Handles: single number, range "34-36", slash "34/35", object with min/max,
 * object with value, string with units/spaces/quotes.
 */
function normalizeToRange(raw: unknown): NormalizedRange | null {
  if (raw === null || raw === undefined) return null;

  // Already structured object
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;

    // Has mid/midpoint from sync-airtable
    if (obj.mid !== undefined && typeof obj.mid === "number") {
      const min = typeof obj.min === "number" ? obj.min : obj.mid;
      const max = typeof obj.max === "number" ? obj.max : obj.mid;
      return { min, max, midpoint: obj.mid };
    }

    // Has min/max
    if (typeof obj.min === "number" && typeof obj.max === "number") {
      return { min: obj.min, max: obj.max, midpoint: (obj.min + obj.max) / 2 };
    }

    // Has value
    if (typeof obj.value === "number") {
      return { min: obj.value, max: obj.value, midpoint: obj.value };
    }

    // Has options array
    if (Array.isArray(obj.options) && obj.options.length > 0) {
      const nums = (obj.options as Array<number | { min: number; max: number }>).map((o) =>
        typeof o === "number" ? o : (o.min + o.max) / 2
      );
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      return { min: Math.min(...nums), max: Math.max(...nums), midpoint: avg };
    }

    return null;
  }

  // Numeric
  if (typeof raw === "number") {
    return { min: raw, max: raw, midpoint: raw };
  }

  // String parsing
  if (typeof raw === "string") {
    // Strip spaces, quotes, unit suffixes like "in", "cm", """
    const cleaned = raw.replace(/[""']/g, "").replace(/\s*(in|cm|inches|")\s*/gi, "").trim();
    if (!cleaned) return null;

    // Range: "34-36" or "34 - 36"
    const dashMatch = cleaned.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
    if (dashMatch) {
      const a = parseFloat(dashMatch[1]);
      const b = parseFloat(dashMatch[2]);
      if (!isNaN(a) && !isNaN(b)) return { min: Math.min(a, b), max: Math.max(a, b), midpoint: (a + b) / 2 };
    }

    // Slash: "34/35"
    const slashMatch = cleaned.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
    if (slashMatch) {
      const a = parseFloat(slashMatch[1]);
      const b = parseFloat(slashMatch[2]);
      if (!isNaN(a) && !isNaN(b)) return { min: Math.min(a, b), max: Math.max(a, b), midpoint: (a + b) / 2 };
    }

    // Single number
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return { min: num, max: num, midpoint: num };
  }

  return null;
}

/**
 * Normalize all measurements in a row to NormalizedRange.
 */
function normalizeMeasurements(raw: Record<string, unknown> | null): Record<string, NormalizedRange> {
  const result: Record<string, NormalizedRange> = {};
  if (!raw) return result;
  for (const [key, val] of Object.entries(raw)) {
    const nr = normalizeToRange(val);
    if (nr) result[key] = nr;
  }
  return result;
}

// Legacy compat helper (still used by AI estimation)
function getMidpoint(m: MeasurementValue | null): number | null {
  if (!m) return null;
  if (m.mid !== undefined) return m.mid;
  if (m.value !== undefined) return m.value;
  if (m.min !== undefined && m.max !== undefined) return (m.min + m.max) / 2;
  if (m.options && m.options.length > 0) {
    const nums = m.options.map((o) =>
      typeof o === "number" ? o : (o.min + o.max) / 2
    );
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  return null;
}

interface SizingRow {
  size_label: string;
  measurements: Record<string, MeasurementValue | null> | null;
  fit_notes: string | null;
}

// ── Category normalization ───────────────────────────────────────
const CATEGORY_ALIAS_MAP: Record<string, string> = {
  tops: "tops",
  top: "tops",
  bottoms: "bottoms",
  bottom: "bottoms",
  pants: "bottoms",
  denim: "denim",
  jeans: "denim",
  dresses: "dresses",
  dress: "dresses",
  swim: "swim",
  swimwear: "swim",
  "one-piece swimsuits": "swim",
  "one_piece_swimsuits": "swim",
  "sports bras": "sports_bras",
  "sports_bras": "sports_bras",
  bras: "sports_bras",
  outerwear: "outerwear",
  jackets: "outerwear",
  shorts: "bottoms",
  skirts: "bottoms",
  bodysuits: "bodysuits",
};

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (CATEGORY_ALIAS_MAP[lower]) return CATEGORY_ALIAS_MAP[lower];
  // Convert any remaining spaces/punctuation to underscores for consistency
  return lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Category-to-measurement priority mapping
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

// ── Confidence scoring (deterministic) ──────────────────────────

interface ConfidenceResult {
  score: number;
  reasons: string[];
  matchMethod: "measurement" | "fallback_index" | "fallback_legacy";
  measurementCoverage: number;
  avgDeviation: number;
}

function computeConfidence(
  matchedKeys: number,
  avgDeviation: number,
  usedFallback: boolean,
): ConfidenceResult {
  const reasons: string[] = [];
  let matchMethod: ConfidenceResult["matchMethod"] = usedFallback ? "fallback_index" : "measurement";

  if (usedFallback) {
    reasons.push("No sizing chart data — used universal index mapping");
  }

  let score: number;
  if (matchedKeys < 2) {
    score = 0;
    reasons.push(`Only ${matchedKeys} measurement dimension(s) matched — need at least 2`);
  } else if (avgDeviation <= 1.0) {
    // High confidence: 90-100 scaled by how close to 0
    score = Math.round(100 - (avgDeviation / 1.0) * 10);
    reasons.push(`Excellent match — avg deviation ${avgDeviation.toFixed(2)}″`);
  } else if (avgDeviation <= 2.5) {
    // Medium confidence: 70-89 scaled
    score = Math.round(89 - ((avgDeviation - 1.0) / 1.5) * 19);
    reasons.push(`Good match — avg deviation ${avgDeviation.toFixed(2)}″`);
  } else {
    // Low confidence
    score = Math.max(0, Math.round(69 - ((avgDeviation - 2.5) / 2.0) * 69));
    reasons.push(`High deviation (${avgDeviation.toFixed(2)}″) — low confidence`);
  }

  return { score, reasons, matchMethod, measurementCoverage: matchedKeys, avgDeviation };
}

// ── Per-dimension deviation detail for debug ─────────────────────
interface DimensionDeviation {
  dimension: string;
  userMidpoint: number;
  targetMin: number;
  targetMax: number;
  deviation: number;
  insideRange: boolean;
}

// Extended findClosestSize returning debug trace
interface ClosestSizeResult {
  size: string;
  fitNotes: string | null;
  bestScore: number;
  matchedKeys: number;
  totalKeys: number;
  anchorMids: Record<string, number>;
  anchorRanges: Record<string, NormalizedRange>;
  targetRowUsed: SizingRow | null;
  allScores: { size: string; score: number; matched: number; deviations: DimensionDeviation[] }[];
}

function findClosestSize(
  anchorMeasurements: Record<string, unknown> | null,
  targetSizes: SizingRow[],
  fitPreference: string,
  category?: string
): ClosestSizeResult | null {
  if (!anchorMeasurements || targetSizes.length === 0) return null;

  const keys = getMeasurementKeys(category || "default");
  // Normalize anchor measurements
  const anchorNorm = normalizeMeasurements(anchorMeasurements as Record<string, unknown>);
  const anchorMids: Record<string, number> = {};
  const anchorRanges: Record<string, NormalizedRange> = {};

  for (const k of keys) {
    if (anchorNorm[k]) {
      anchorMids[k] = anchorNorm[k].midpoint;
      anchorRanges[k] = anchorNorm[k];
    }
  }

  // Also pick up any extra measurement keys present in both anchor and target
  const allMeasurementKeys = new Set<string>(keys);
  for (const k of Object.keys(anchorNorm)) {
    allMeasurementKeys.add(k);
  }

  // Build user midpoints from anchor
  const userMidpoints: Record<string, number> = {};
  for (const k of allMeasurementKeys) {
    if (anchorNorm[k]) {
      userMidpoints[k] = anchorNorm[k].midpoint;
      if (!anchorRanges[k]) anchorRanges[k] = anchorNorm[k];
    }
  }

  if (Object.keys(userMidpoints).length === 0) return null;

  let bestSize = targetSizes[0];
  let bestScore = Infinity;
  const allScores: { size: string; score: number; matched: number; deviations: DimensionDeviation[] }[] = [];

  for (const row of targetSizes) {
    if (!row.measurements) continue;
    const targetNorm = normalizeMeasurements(row.measurements as Record<string, unknown>);
    let totalDeviation = 0;
    let matched = 0;
    const deviations: DimensionDeviation[] = [];

    for (const [k, userMid] of Object.entries(userMidpoints)) {
      const target = targetNorm[k];
      if (!target) continue;

      let deviation: number;
      let insideRange: boolean;

      if (userMid >= target.min && userMid <= target.max) {
        // Case A: user midpoint inside target range → perfect fit
        deviation = 0;
        insideRange = true;
      } else {
        // Case B: distance to nearest boundary
        deviation = userMid < target.min ? target.min - userMid : userMid - target.max;
        insideRange = false;
      }

      totalDeviation += deviation;
      matched++;
      deviations.push({ dimension: k, userMidpoint: userMid, targetMin: target.min, targetMax: target.max, deviation, insideRange });
    }

    if (matched > 0) {
      const avgDev = totalDeviation / matched;
      allScores.push({ size: row.size_label, score: avgDev, matched, deviations });
      if (avgDev < bestScore || (avgDev === bestScore && matched > (allScores.find(s => s.size === bestSize.size_label)?.matched || 0))) {
        bestScore = avgDev;
        bestSize = row;
      }
    }
  }

  // Apply fit preference offset
  let resultSize = bestSize.size_label;
  if (fitPreference === "fitted") {
    const down = sizeDown(resultSize);
    if (down) resultSize = down;
  } else if (fitPreference === "relaxed") {
    const up = sizeUp(resultSize);
    if (up) resultSize = up;
  }

  return {
    size: resultSize,
    fitNotes: bestSize.fit_notes,
    bestScore,
    matchedKeys: allScores.find(s => s.size === bestSize.size_label)?.matched || 0,
    totalKeys: Object.keys(userMidpoints).length,
    anchorMids,
    anchorRanges,
    targetRowUsed: bestSize,
    allScores: allScores.sort((a, b) => a.score - b.score),
  };
}

// ── Size scale conversion ────────────────────────────────────────
const LETTER_TO_NUMERIC: Record<string, string> = {
  XXXS: "00", XXS: "0", XS: "2", S: "4", M: "6", L: "10", XL: "12", "2X": "16", "3X": "18", "4X": "20"
};
const NUMERIC_TO_LETTER: Record<string, string> = {
  "00": "XXXS", "0": "XXS", "2": "XS", "4": "S", "6": "M", "8": "M", "10": "L", "12": "XL", "14": "XL", "16": "2X", "18": "3X", "20": "4X"
};

// Brand-specific size scale mappings to universal US numeric index
const BRAND_SCALE_MAPS: Record<string, Record<string, number>> = {
  zimmermann: { "0": 1, "1": 2, "2": 4, "3": 6, "4": 8, "5": 10 },
  and_or_collective: { "1": 2, "2": 6, "3": 10 },
  seven_for_all_mankind: { "22": 0, "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9 },
  mother: { "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9, "33": 10, "34": 11 },
  revolve_denim: { "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9 },
  david_koma: { "4": 1, "6": 2, "8": 3, "10": 4, "12": 5, "14": 6, "16": 7 },
  victoria_beckham: { "4": 1, "6": 2, "8": 3, "10": 4, "12": 5, "14": 6, "16": 7 },
};

const UNIVERSAL_SIZE_MAP: Record<string, number> = {
  "00": 0, "0": 1, "2": 2, "4": 3, "6": 4, "8": 5, "10": 6, "12": 7, "14": 8, "16": 9, "18": 10, "20": 11,
  "XXXS": 0, "XXS": 1, "XS": 2, "S": 3, "M": 4, "L": 6, "XL": 7, "2X": 9, "3X": 10, "4X": 11,
  "34": 0, "36": 1, "38": 2, "40": 3, "42": 4, "44": 5, "46": 6, "48": 7,
  "22": 0, "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9, "33": 10,
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
  if (targetScale === "letter" && isNumericSize(upper)) {
    return NUMERIC_TO_LETTER[upper] || upper;
  }
  if (targetScale === "numeric" && isLetterSize(upper)) {
    return LETTER_TO_NUMERIC[upper] || upper;
  }
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
    if (dist < bestDist) {
      bestDist = dist;
      bestSize = avail;
    }
  }

  return bestSize;
}

function fallbackSizeMapping(anchorSize: string, fitPreference: string, targetScale: string, availableSizes: string[], anchorBrandKey?: string, targetBrandKey?: string, anchorScale?: string): string {
  const anchorIdx = getUniversalIndex(anchorSize, anchorBrandKey);
  const scalesMatch = anchorScale && anchorScale === targetScale;

  // When scales are identical, skip universal index mapping entirely —
  // just apply fit preference shift and snap to available sizes.
  if (scalesMatch) {
    let resultSize = anchorSize.toUpperCase().trim();
    if (fitPreference === "fitted") {
      const down = sizeDown(resultSize);
      if (down) resultSize = down;
    } else if (fitPreference === "relaxed") {
      const up = sizeUp(resultSize);
      if (up) resultSize = up;
    }
    if (availableSizes.length) {
      const upperAvail = availableSizes.map(s => s.toUpperCase());
      if (!upperAvail.includes(resultSize)) {
        resultSize = snapToAvailableSize(resultSize, availableSizes, fitPreference, targetBrandKey);
      }
    }
    return resultSize;
  }
  
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
      if (dist < bestDist) {
        bestDist = dist;
        bestSize = avail;
      }
    }
    return bestSize;
  }

  let resultSize = convertToScale(anchorSize, targetScale);
  if (fitPreference === "fitted") {
    const down = sizeDown(resultSize);
    if (down) resultSize = down;
  } else if (fitPreference === "relaxed") {
    const up = sizeUp(resultSize);
    if (up) resultSize = up;
  }
  if (availableSizes.length) {
    resultSize = snapToAvailableSize(resultSize, availableSizes, fitPreference, targetBrandKey);
  }
  return resultSize;
}

// ── AI body measurement estimation from weight + height ─────────

async function estimateBodyMeasurements(
  weight: string,
  height: string,
  fitPreference: string,
): Promise<Record<string, MeasurementValue> | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const prompt = `Given a woman who weighs ${weight} and is ${height} tall with a "${fitPreference.replace(/_/g, " ")}" fit preference, estimate her body measurements in inches. Return bust, waist, hips, underbust, thigh, and shoulders as numeric ranges (min-max). Be realistic and use standard fashion industry measurement guides.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
                bust_min: { type: "number" },
                bust_max: { type: "number" },
                waist_min: { type: "number" },
                waist_max: { type: "number" },
                hips_min: { type: "number" },
                hips_max: { type: "number" },
                underbust_min: { type: "number" },
                underbust_max: { type: "number" },
                thigh_min: { type: "number" },
                thigh_max: { type: "number" },
                shoulders_min: { type: "number" },
                shoulders_max: { type: "number" },
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

    const pairs = [
      ["bust", "bust_min", "bust_max"],
      ["waist", "waist_min", "waist_max"],
      ["hips", "hips_min", "hips_max"],
      ["underbust", "underbust_min", "underbust_max"],
      ["thigh", "thigh_min", "thigh_max"],
      ["shoulders", "shoulders_min", "shoulders_max"],
    ];

    for (const [key, minKey, maxKey] of pairs) {
      if (args[minKey] !== undefined && args[maxKey] !== undefined) {
        result[key] = { min: args[minKey], max: args[maxKey], unit: "in" };
      }
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
    const pageResp = await fetch(productUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ALTAANA/1.0)" },
    });
    clearTimeout(timeout);

    if (!pageResp.ok) return null;
    const html = await pageResp.text();

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);

    if (stripped.length < 100) return null;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Extract fit, sizing, and fabric/material info from this product page text. Return a concise summary (under 80 words) covering: fit details (runs small/large, oversized, fitted, true to size, size up/down recommendations), fabric composition (e.g. 95% polyester 5% spandex), stretch level (no stretch, slight stretch, high stretch), and any specific measurements mentioned. If no info is found, return empty string." },
          { role: "user", content: stripped },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_fit",
            description: "Extract product fit and fabric details",
            parameters: {
              type: "object",
              properties: {
                fit_summary: { type: "string", description: "Concise fit and fabric summary or empty string if none found" },
              },
              required: ["fit_summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_fit" } },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      return args.fit_summary || null;
    }
    return null;
  } catch (e) {
    console.error("Product scrape failed:", e);
    return null;
  }
}

// ── AI bullet generation ────────────────────────────────────────

async function generateBullets(context: {
  anchorBrands: { displayName: string; size: string }[];
  targetBrand: string;
  recommendedSize: string;
  fitPreference: string;
  fitNotes: string | null;
  targetFitTendency: string | null;
  productFitSummary: string | null;
}): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return generateFallbackBullets(context);
  }

  try {
    const prompt = `You are a sizing expert for a women's fashion sizing tool called ALTAANA. Generate exactly 3 short, helpful bullet points explaining why we recommend size "${context.recommendedSize}" in ${context.targetBrand}.

Context:
- The user wears: ${context.anchorBrands.map(a => `${a.size} in ${a.displayName}`).join(", ")}
- Their fit preference: ${context.fitPreference.replace(/_/g, " ")}
${context.fitNotes ? `- Brand fit notes: ${context.fitNotes}` : ""}
${context.targetFitTendency ? `- ${context.targetBrand} generally ${context.targetFitTendency.replace(/_/g, " ")}` : ""}
${context.productFitSummary ? `- This specific product: ${context.productFitSummary}` : ""}

Rules:
- Each bullet must be under 15 words
- First bullet references what they wear in their anchor brand
- Second bullet addresses how the target brand fits, including fabric/material details if available
- Third bullet mentions the fit preference or fabric-related sizing advice (e.g. stretch, give)
- Be definitive and confident, no hedging language
- Do NOT use bullet point characters, just return plain text`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
              properties: {
                bullets: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ["bullets"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "size_bullets" } },
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return generateFallbackBullets(context);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      if (args.bullets && Array.isArray(args.bullets) && args.bullets.length === 3) {
        return args.bullets;
      }
    }

    return generateFallbackBullets(context);
  } catch (e) {
    console.error("AI bullet generation failed:", e);
    return generateFallbackBullets(context);
  }
}

function generateFallbackBullets(context: {
  anchorBrands: { displayName: string; size: string }[];
  targetBrand: string;
  recommendedSize: string;
  fitPreference: string;
  fitNotes: string | null;
  targetFitTendency: string | null;
  productFitSummary: string | null;
}): string[] {
  const anchor = context.anchorBrands[0];
  const bullets = [
    `You wear ${anchor.size} in ${anchor.displayName}`,
  ];

  if (context.targetFitTendency) {
    bullets.push(`${context.targetBrand} ${context.targetFitTendency.replace(/_/g, " ")}`);
  } else if (context.fitNotes) {
    bullets.push(context.fitNotes);
  } else {
    bullets.push(`${context.targetBrand} sizing aligns with standard US sizing`);
  }

  const prefLabel = context.fitPreference.replace(/_/g, " ");
  bullets.push(`Adjusted for your ${prefLabel} fit preference`);

  return bullets;
}

// ── Brand comparisons ───────────────────────────────────────────

function generateComparisons(
  anchorBrands: { displayName: string; size: string }[],
  targetBrand: string,
  recommendedSize: string,
  targetFitTendency: string | null,
): { brandName: string; size: string; fitTag: string }[] {
  const comparisons: { brandName: string; size: string; fitTag: string }[] = [];

  for (const anchor of anchorBrands) {
    const anchorIdx = sizeIndex(anchor.size);
    const targetIdx = sizeIndex(recommendedSize);
    let fitTag = "true to size";
    if (anchorIdx !== -1 && targetIdx !== -1) {
      if (targetIdx > anchorIdx) fitTag = "runs small";
      else if (targetIdx < anchorIdx) fitTag = "runs large";
    }
    comparisons.push({
      brandName: anchor.displayName,
      size: anchor.size,
      fitTag,
    });
  }

  comparisons.push({
    brandName: targetBrand,
    size: recommendedSize,
    fitTag: targetFitTendency?.replace(/_/g, " ") || "true to size",
  });

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

    // 1b. Classify anchor size type
    const anchorBrandKey0 = anchor_brands[0]?.brandKey;
    const anchorSizeLabel0 = anchor_brands[0]?.size || "";
    const anchorSizeType = classifySizeType(anchorSizeLabel0);
    const anchorDbScales = sizeTypeToDbScale(anchorSizeType);

    // 2. Normalize category
    const detectedCategoryRaw = target_category || "tops";
    const category = normalizeCategory(detectedCategoryRaw);

    // 2b. Also build a list of possible raw category strings that might exist in DB
    // (the DB may have un-normalized values like "sports bras", "dresses ", "pants")
    const categoryVariants = new Set<string>([category]);
    // Add the raw input too (lowercased, trimmed)
    const rawLower = detectedCategoryRaw.toLowerCase().trim();
    categoryVariants.add(rawLower);
    // Add common DB variants
    const REVERSE_CATEGORY_MAP: Record<string, string[]> = {
      tops: ["tops"],
      bottoms: ["bottoms", "pants", "shorts", "skirts"],
      denim: ["denim", "jeans"],
      dresses: ["dresses", "dress", "dresses "],
      swim: ["swim", "swimwear", "one-piece swimsuits"],
      sports_bras: ["sports bras", "sports_bras", "bras"],
      outerwear: ["outerwear", "jackets"],
      bodysuits: ["bodysuits"],
    };
    if (REVERSE_CATEGORY_MAP[category]) {
      for (const v of REVERSE_CATEGORY_MAP[category]) categoryVariants.add(v);
    }

    // Query target sizing data: try normalized + variants
    let targetSizingDataRaw: Array<{ size_label: string; measurements: Record<string, unknown> | null; fit_notes: string | null; size_scale: string }> = [];
    const { data: targetDataExact } = await supabase
      .from("sizing_charts")
      .select("size_label, measurements, fit_notes, size_scale")
      .eq("brand_key", target_brand_key)
      .in("category", [...categoryVariants]);

    targetSizingDataRaw = targetDataExact || [];

    // Brand-only fallback if no rows matched ANY category variant
    let categoryFallbackUsed = false;
    if (targetSizingDataRaw.length === 0) {
      const { data: targetDataAll } = await supabase
        .from("sizing_charts")
        .select("size_label, measurements, fit_notes, size_scale")
        .eq("brand_key", target_brand_key);
      targetSizingDataRaw = targetDataAll || [];
      categoryFallbackUsed = true;
    }

    // Filter target rows: prefer same size_type, classify each row
    const allTargetRows = targetSizingDataRaw;
    const targetRowsBeforeFilter = allTargetRows.length;

    // First try: rows whose size_label classifies as compatible with anchor size_type
    let targetSizingData = allTargetRows.filter(
      (r) => sizeTypesCompatible(classifySizeType(r.size_label), anchorSizeType)
    );
    let targetSizeTypeSearched: string = anchorSizeType;
    let conversionFallbackUsed = false;

    // If no same-type rows exist but other rows do, use them with conversion fallback
    if (targetSizingData.length === 0 && allTargetRows.length > 0) {
      targetSizingData = allTargetRows;
      conversionFallbackUsed = true;
      const firstRowType = classifySizeType(allTargetRows[0].size_label);
      targetSizeTypeSearched = firstRowType;
    }

    const targetRowsAfterFilter = targetSizingData.length;
    const targetRowsFilteredOut = targetRowsBeforeFilter - targetRowsAfterFilter;

    // 3. Fetch anchor brand sizing data — try category variants, then brand-only fallback
    const anchorBrandKeys = anchor_brands.map((a: { brandKey: string }) => a.brandKey);
    let anchorSizingDataAll: Array<{ brand_key: string; size_label: string; measurements: Record<string, unknown> | null; size_scale: string }> = [];
    const { data: anchorDataExact } = await supabase
      .from("sizing_charts")
      .select("brand_key, size_label, measurements, size_scale")
      .in("brand_key", anchorBrandKeys)
      .in("category", [...categoryVariants]);

    anchorSizingDataAll = anchorDataExact || [];

    // Brand-only fallback for anchor
    if (anchorSizingDataAll.length === 0) {
      const { data: anchorDataAll } = await supabase
        .from("sizing_charts")
        .select("brand_key, size_label, measurements, size_scale")
        .in("brand_key", anchorBrandKeys);
      anchorSizingDataAll = anchorDataAll || [];
    }

    // Filter anchor rows to same size type only (strict — never mix for anchor)
    const anchorSizingData = anchorSizingDataAll.filter(
      (r) => sizeTypesCompatible(classifySizeType(r.size_label), anchorSizeType)
    );

    // 4. Determine recommended size
    let recommendedSize: string;
    let fitNotes: string | null = null;
    let usedFallback = false;
    let usedEstimated = false;
    let closestResult: ClosestSizeResult | null = null;
    const isSameBrand = anchorBrandKey0 === target_brand_key;
    const isSameScale = !conversionFallbackUsed;

    let needMoreInfoEarly = false;

    // Debug trace collectors
    let anchorMeasurementsUsed: Record<string, MeasurementValue | null> | null = null;

    // ── SAME-BRAND SHORTCUT ─────────────────────────────────────
    // When anchor and target are the same brand, return the anchor size
    // directly. No universal index, no scale conversion. Only apply
    // fit preference shift if not "true_to_size".
    if (isSameBrand) {
      recommendedSize = anchor_brands[0].size;
      const fp = fit_preference || "true_to_size";
      if (fp === "fitted") {
        const down = sizeDown(recommendedSize);
        if (down) recommendedSize = down;
      } else if (fp === "relaxed") {
        const up = sizeUp(recommendedSize);
        if (up) recommendedSize = up;
      }
      // Snap to available sizes (same brand, so no index conversion needed)
      if (availableSizes.length) {
        const upper = recommendedSize.toUpperCase().trim();
        if (!availableSizes.map(s => s.toUpperCase()).includes(upper)) {
          // Only snap within same-scale sizes, no universal index
          recommendedSize = snapToAvailableSize(recommendedSize, availableSizes, fp, target_brand_key);
        }
      }
    } else {
      // ── CROSS-BRAND LOGIC ───────────────────────────────────────

      // No early guard needed — conversionFallbackUsed handles missing same-type rows

      // If weight/height provided, estimate body measurements and use them
      let estimatedMeasurements: Record<string, MeasurementValue> | null = null;
      if (weight || height) {
        estimatedMeasurements = await estimateBodyMeasurements(
          weight || "",
          height || "",
          fit_preference || "true_to_size",
        );
        if (estimatedMeasurements) usedEstimated = true;
      }

      if (targetSizingData?.length && (anchorSizingData?.length || estimatedMeasurements)) {
        let anchorMeasurements: Record<string, MeasurementValue | null> | null = null;

        if (anchorSizingData?.length) {
          const anchorBrand = anchor_brands[0];
          const anchorRow = anchorSizingData.find(
            (r: { brand_key: any; size_label: any; measurements: any }) =>
              r.brand_key === anchorBrand.brandKey &&
              r.size_label.toUpperCase() === anchorBrand.size.toUpperCase()
          );
          if (anchorRow?.measurements) {
            anchorMeasurements = anchorRow.measurements as Record<string, MeasurementValue | null>;
          }
        }

        // Blend estimated measurements with anchor measurements
        if (estimatedMeasurements) {
          if (anchorMeasurements) {
            for (const [k, v] of Object.entries(estimatedMeasurements)) {
              if (!anchorMeasurements[k]) {
                anchorMeasurements[k] = v;
              }
            }
          } else {
            anchorMeasurements = estimatedMeasurements;
          }
        }

        anchorMeasurementsUsed = anchorMeasurements;

        if (anchorMeasurements) {
          closestResult = findClosestSize(
            anchorMeasurements,
            targetSizingData as SizingRow[],
            fit_preference || "true_to_size",
            category
          );
          if (closestResult) {
            // Only convert scale when anchor and target scales differ
            if (isSameScale) {
              recommendedSize = closestResult.size;
            } else {
              recommendedSize = convertToScale(closestResult.size, targetSizeScale);
            }
            fitNotes = closestResult.fitNotes;
          } else {
            usedFallback = true;
            recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key, anchorSizeType);
          }
        } else {
          usedFallback = true;
          recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key, anchorSizeType);
        }
      } else {
        usedFallback = true;
        recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key, anchorSizeType);
      }

      // Final snap — prefer sizes of same type
      const sameTypeAvailable = availableSizes.filter(s => sizeTypesCompatible(classifySizeType(s), anchorSizeType));
      if (sameTypeAvailable.length) {
        recommendedSize = snapToAvailableSize(recommendedSize, sameTypeAvailable, fit_preference || "true_to_size", target_brand_key);
      } else if (availableSizes.length) {
        recommendedSize = snapToAvailableSize(recommendedSize, availableSizes, fit_preference || "true_to_size", target_brand_key);
      }
    }

    // ── Confidence scoring ──────────────────────────────────────
    let confidence: ConfidenceResult;
    if (isSameBrand) {
      // Same brand = perfect confidence, no measurement matching needed
      confidence = { score: 100, reasons: ["Same brand — direct size match"], matchMethod: "measurement", measurementCoverage: 0, avgDeviation: 0 };
    } else {
      const matchedKeys = closestResult?.matchedKeys ?? 0;
      const avgDeviation = closestResult?.bestScore ?? Infinity;
      confidence = computeConfidence(matchedKeys, avgDeviation, usedFallback);
    }

    // Penalize confidence when conversion fallback was used (cross-system)
    if (conversionFallbackUsed && confidence.score > 0) {
      confidence.score = Math.min(confidence.score, 70);
      confidence.reasons.push("Confidence capped — size system conversion used (anchor: " + anchorSizeType + ", target rows: " + targetSizeTypeSearched + ")");
    }

    // ── Determine which measurement to ask for by category ──────
    function getAskForMeasurement(cat: string): string {
      const lower = cat.toLowerCase();
      if (["denim", "bottoms"].includes(lower)) return "waist";
      if (["dresses"].includes(lower)) return "hips";
      if (["swim", "sports_bras"].includes(lower)) return "underbust";
      return "bust"; // tops, outerwear, default
    }

    // ── Hard guardrails ─────────────────────────────────────────
    const isExtremeSize = ["XXS", "XXXS", "00"].includes(recommendedSize.toUpperCase());
    let needMoreInfo = false;
    let needMoreInfoReason = "";
    let needMoreInfoAskFor = "";

    // Rule 1: confidence < 70 → NEED_MORE_INFO (covers matchedKeys < 2 and high deviation)
    if (confidence.score < 70) {
      needMoreInfo = true;
      needMoreInfoAskFor = getAskForMeasurement(category);
      needMoreInfoReason = matchedKeys < 2
        ? "Not enough measurement data to make a confident recommendation"
        : `Measurement deviation too high (${avgDeviation.toFixed(2)}″) for a reliable recommendation`;
    }

    // Rule 2: never default to extreme/smallest size UNLESS anchor was already XXS/XXXS
    const anchorIsExtreme = ["XXS", "XXXS", "00"].includes(anchorSizeLabel0.toUpperCase().trim());
    if (!needMoreInfo && isExtremeSize && !anchorIsExtreme && confidence.score < 95) {
      needMoreInfo = true;
      needMoreInfoAskFor = getAskForMeasurement(category);
      needMoreInfoReason = `Extreme size (${recommendedSize}) requires very high confidence`;
      confidence.reasons.push("Blocked extreme size — confidence below 95% and anchor was not extreme");
    }

    // Rule 3: brand_source=fallback + confidence < 85 → NEED_MORE_INFO
    if (!needMoreInfo && brand_source === "fallback" && confidence.score < 85) {
      needMoreInfo = true;
      needMoreInfoAskFor = getAskForMeasurement(category);
      needMoreInfoReason = "Could not confidently identify the brand on this page";
      confidence.reasons.push("Brand detection fell back — confidence threshold raised to 85%");
    }

    // Log low-confidence events
    if (needMoreInfo || confidence.score < 70) {
      try {
        await supabase.from("low_confidence_logs").insert({
          target_brand: target_brand_key,
          category,
          anchor_brand: anchor_brands[0]?.brandKey || "unknown",
          anchor_size: anchor_brands[0]?.size || "unknown",
          confidence: confidence.score,
          coverage: confidence.measurementCoverage,
          reason: needMoreInfoReason || confidence.reasons.join("; "),
        });
      } catch (logErr) {
        console.error("Failed to log low-confidence event:", logErr);
      }
      console.warn(`[LOW_CONFIDENCE] score=${confidence.score} coverage=${matchedKeys} avgDeviation=${avgDeviation.toFixed(2)} brand=${target_brand_key} category=${category}`);
    }

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
    });

    // 7. Generate comparisons
    const comparisons = generateComparisons(
      anchor_brands,
      targetDisplayName,
      recommendedSize,
      targetFitTendency,
    );

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

    // ── Log every run to recommendation_runs ────────────────────
    try {
      await supabase.from("recommendation_runs").insert({
        user_id: user_id || null,
        target_brand: target_brand_key,
        category,
        product_url: product_url || null,
        anchor_brand: anchor_brands[0]?.brandKey || "unknown",
        anchor_size: anchor_brands[0]?.size || "unknown",
        output_status: needMoreInfo ? "NEED_MORE_INFO" : "OK",
        recommended_size: needMoreInfo ? null : recommendedSize,
        confidence: confidence.score,
        coverage: confidence.measurementCoverage,
        fallback_used: usedFallback,
        reason: needMoreInfo ? needMoreInfoReason : null,
        ask_for: needMoreInfo ? needMoreInfoAskFor : null,
      });
    } catch (auditErr) {
      console.error("Failed to log recommendation run:", auditErr);
    }

    // ── Build response ──────────────────────────────────────────
    const responseBody: Record<string, unknown> = needMoreInfo
      ? {
          status: "NEED_MORE_INFO",
          ask_for: needMoreInfoAskFor,
          reason: needMoreInfoReason,
          brandName: targetDisplayName,
          confidence: {
            score: confidence.score,
            reasons: confidence.reasons,
            matchMethod: confidence.matchMethod,
          },
          needMoreInfo: true,
        }
      : {
          size: recommendedSize,
          brandName: targetDisplayName,
          sizeScale: targetSizeScale,
          bullets,
          comparisons,
          productFitSummary,
          recommendation_id: recommendationId,
          confidence: {
            score: confidence.score,
            reasons: confidence.reasons,
            matchMethod: confidence.matchMethod,
          },
          needMoreInfo: false,
        };

    // Include debug trace only when requested
    if (debug_mode) {
      const keys = getMeasurementKeys(category);
      const anchorRangesDebug: Record<string, { min: number | null; max: number | null; midpoint: number | null }> = {};
      const anchorMidsDebug: Record<string, number> = {};
      const missingDimensions: string[] = [];

      if (closestResult) {
        for (const k of keys) {
          const r = closestResult.anchorRanges[k];
          if (r) {
            anchorMidsDebug[k] = r.midpoint;
            anchorRangesDebug[k] = { min: r.min, max: r.max, midpoint: r.midpoint };
          } else {
            missingDimensions.push(k);
          }
        }
      } else if (anchorMeasurementsUsed) {
        const norm = normalizeMeasurements(anchorMeasurementsUsed as Record<string, unknown>);
        for (const k of keys) {
          if (norm[k]) {
            anchorMidsDebug[k] = norm[k].midpoint;
            anchorRangesDebug[k] = { min: norm[k].min, max: norm[k].max, midpoint: norm[k].midpoint };
          } else {
            missingDimensions.push(k);
          }
        }
      } else {
        for (const k of keys) missingDimensions.push(k);
      }

      const detectionSource: string = product_url ? "url" : "heuristic";
      const allScores = closestResult?.allScores || [];
      const top3Candidates = allScores.slice(0, 3);

      const anchorRowChosen = anchorSizingData?.find(
        (r: { brand_key: string; size_label: string }) =>
          r.brand_key === anchor_brands[0]?.brandKey &&
          r.size_label.toUpperCase() === anchorSizeLabel0.toUpperCase()
      );

      responseBody.debug = {
        detectedCategoryRaw,
        normalizedCategory: category,
        airtableCategoryMatchesCount: targetRowsBeforeFilter,
        detectionSource,
        anchorBrand: anchor_brands[0]?.displayName || anchor_brands[0]?.brandKey,
        anchorSize: anchor_brands[0]?.size,
        anchorMeasurements: anchorMidsDebug,
        anchorMeasurementsRaw: anchorRangesDebug,
        missingDimensions,
        measurementCoverage: confidence.measurementCoverage,
        keyDimensionsList: keys,
        targetBrandKey: target_brand_key,
        targetBrandDisplayName: targetDisplayName,
        targetSizeScale,
        availableSizes,
        fitPreference: fit_preference || "true_to_size",
        targetFitTendency,
        anchorSizeSystem: anchorSizeType,
        anchorSizeType,
        anchorRowChosen: anchorRowChosen
          ? { sizeLabel: anchorRowChosen.size_label, measurements: anchorRowChosen.measurements }
          : null,
        targetSizeTypeSearched,
        conversionFallbackUsed,
        sizeSystemFilterUsed: anchorSizeType,
        targetRowsBeforeSystemFilter: targetRowsBeforeFilter,
        targetRowsAfterSystemFilter: targetRowsAfterFilter,
        targetRowsFilteredOut,
        categoryFallbackUsed,
        isDenimScale: anchorSizeType === "denim",
        usedFallback,
        usedEstimatedMeasurements: usedEstimated,
        targetRowUsed: closestResult?.targetRowUsed
          ? {
              size_label: closestResult.targetRowUsed.size_label,
              measurements: closestResult.targetRowUsed.measurements,
              fit_notes: closestResult.targetRowUsed.fit_notes,
            }
          : null,
        top3Candidates: top3Candidates.map(s => ({
          ...s,
          deviations: s.deviations,
        })),
        allSizeScores: allScores.map(s => ({
          size: s.size,
          score: s.score,
          matched: s.matched,
          deviations: s.deviations,
        })),
        comparisonLogic: comparisons.map(c => `${c.brandName} ${c.size} → ${c.fitTag}`),
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
