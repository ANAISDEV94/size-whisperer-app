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

// Infer size scale from the size label itself
const LETTER_REGEX = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|XXXS|2X|3X|4X)$/i;
function inferSizeScaleFromLabel(sizeLabel: string): string {
  const trimmed = sizeLabel.trim();
  if (LETTER_REGEX.test(trimmed)) return "letter";
  // Denim waist sizes: 22-40
  if (/^\d{2}$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n >= 22 && n <= 40) return "denim";
  }
  if (/^\d+$/.test(trimmed)) return "numeric";
  return "other";
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
  options?: (number | { min: number; max: number })[];
  unit?: string;
}

function getMidpoint(m: MeasurementValue | null): number | null {
  if (!m) return null;
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

// Category-to-measurement priority mapping (aligned with extension enum)
const CATEGORY_MEASUREMENT_KEYS: Record<string, string[]> = {
  tops: ["bust", "waist"],
  bottoms: ["waist", "hips"],
  denim: ["waist", "hips", "rise"],
  dresses: ["bust", "waist", "hips"],
  swim: ["bust", "waist", "hips", "underbust"],
  outerwear: ["bust", "waist", "shoulders"],
  // Legacy aliases still supported
  jeans: ["waist", "hips", "rise"],
  shorts: ["waist", "hips"],
  skirts: ["waist", "hips"],
  swimwear: ["bust", "waist", "hips", "underbust"],
  "sports bras": ["bust", "underbust"],
  bodysuits: ["bust", "waist", "hips"],
  default: ["bust", "waist", "hips"],
};

function getMeasurementKeys(category: string): string[] {
  const lower = category.toLowerCase();
  return CATEGORY_MEASUREMENT_KEYS[lower] || CATEGORY_MEASUREMENT_KEYS.default;
}

// ── Confidence scoring ──────────────────────────────────────────

interface ConfidenceResult {
  score: number; // 0-100
  reasons: string[];
  matchMethod: "measurement" | "fallback_index" | "fallback_legacy";
}

function computeConfidence(
  anchorMeasurements: Record<string, MeasurementValue | null> | null,
  targetSizingData: SizingRow[] | null,
  bestScore: number | null,
  matchedKeys: number,
  totalKeys: number,
  usedFallback: boolean,
  usedEstimated: boolean,
): ConfidenceResult & { measurementCoverage: number; distanceScore: number } {
  const reasons: string[] = [];
  let score = 100;
  let matchMethod: ConfidenceResult["matchMethod"] = "measurement";

  // ── Coverage: how many key dimensions were matched ────────────
  const measurementCoverage = matchedKeys;

  // ── Distance score: normalized distance between anchor and target ─
  // bestScore is avg absolute deviation in inches; normalize to 0-1 range (0=perfect)
  const distanceScore = bestScore !== null ? Math.min(bestScore / 5, 1) : 1;

  if (usedFallback) {
    score -= 40;
    matchMethod = "fallback_index";
    reasons.push("No sizing chart data — used universal index mapping");
  }

  if (!anchorMeasurements || Object.keys(anchorMeasurements).length === 0) {
    score -= 30;
    reasons.push("No anchor measurements available");
  }

  if (!targetSizingData || targetSizingData.length === 0) {
    score -= 25;
    reasons.push("No target brand sizing chart");
  }

  // Coverage penalty
  if (measurementCoverage < 2) {
    score -= 30;
    reasons.push(`Only ${measurementCoverage} measurement dimension(s) matched — need at least 2`);
  } else if (matchedKeys < totalKeys && matchedKeys > 0) {
    const pct = Math.round((1 - matchedKeys / totalKeys) * 20);
    score -= pct;
    reasons.push(`Only ${matchedKeys}/${totalKeys} measurement dimensions matched`);
  }

  // Distance penalty
  if (distanceScore > 0.4) {
    const penalty = Math.min(25, Math.round(distanceScore * 25));
    score -= penalty;
    reasons.push(`Average measurement deviation: ${(bestScore ?? 0).toFixed(1)} inches`);
  }

  if (usedEstimated) {
    score -= 10;
    reasons.push("Used AI-estimated body measurements");
  }

  score = Math.max(0, Math.min(100, score));
  if (reasons.length === 0) reasons.push("High confidence — full measurement match");

  return { score, reasons, matchMethod, measurementCoverage, distanceScore };
}

// Extended findClosestSize returning debug trace
interface ClosestSizeResult {
  size: string;
  fitNotes: string | null;
  bestScore: number;
  matchedKeys: number;
  totalKeys: number;
  anchorMids: Record<string, number>;
  targetRowUsed: SizingRow | null;
  allScores: { size: string; score: number; matched: number }[];
}

function findClosestSize(
  anchorMeasurements: Record<string, MeasurementValue | null> | null,
  targetSizes: SizingRow[],
  fitPreference: string,
  category?: string
): ClosestSizeResult | null {
  if (!anchorMeasurements || targetSizes.length === 0) return null;

  const keys = getMeasurementKeys(category || "default");
  const anchorMids: Record<string, number> = {};
  for (const k of keys) {
    const mid = getMidpoint(anchorMeasurements[k]);
    if (mid !== null) anchorMids[k] = mid;
  }

  if (Object.keys(anchorMids).length === 0) return null;

  let bestSize = targetSizes[0];
  let bestScore = Infinity;
  const allScores: { size: string; score: number; matched: number }[] = [];

  for (const row of targetSizes) {
    if (!row.measurements) continue;
    let score = 0;
    let matched = 0;
    for (const [k, anchorVal] of Object.entries(anchorMids)) {
      const targetMid = getMidpoint(row.measurements[k]);
      if (targetMid !== null) {
        score += Math.abs(targetMid - anchorVal);
        matched++;
      }
    }
    if (matched > 0) {
      score /= matched;
      allScores.push({ size: row.size_label, score, matched });
      if (score < bestScore) {
        bestScore = score;
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
    totalKeys: Object.keys(anchorMids).length,
    anchorMids,
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

    // 1b. Determine anchor size scale from the label itself
    const anchorBrandKey0 = anchor_brands[0]?.brandKey;
    const anchorSizeLabel0 = anchor_brands[0]?.size || "";
    const anchorSizeScale = inferSizeScaleFromLabel(anchorSizeLabel0);

    // 2. Fetch sizing charts for target brand — filtered to anchor's size scale
    const category = target_category || "tops";
    const { data: targetSizingDataRaw } = await supabase
      .from("sizing_charts")
      .select("size_label, measurements, fit_notes, size_scale")
      .eq("brand_key", target_brand_key)
      .eq("category", category);

    // Filter target rows to only matching scale
    const targetSizingData = (targetSizingDataRaw || []).filter(
      (r: { size_scale?: string }) => r.size_scale === anchorSizeScale
    );
    const targetRowsBeforeFilter = targetSizingDataRaw?.length || 0;
    const targetRowsAfterFilter = targetSizingData.length;

    // 3. Fetch anchor brand sizing data — filtered to anchor's size scale
    const anchorBrandKeys = anchor_brands.map((a: { brandKey: string }) => a.brandKey);
    const { data: anchorSizingDataRaw } = await supabase
      .from("sizing_charts")
      .select("brand_key, size_label, measurements, size_scale")
      .in("brand_key", anchorBrandKeys)
      .eq("category", category);

    // Filter anchor rows to matching scale
    const anchorSizingData = (anchorSizingDataRaw || []).filter(
      (r: { size_scale?: string }) => r.size_scale === anchorSizeScale
    );

    // 4. Determine recommended size
    let recommendedSize: string;
    let fitNotes: string | null = null;
    let usedFallback = false;
    let usedEstimated = false;
    let closestResult: ClosestSizeResult | null = null;
    const isSameBrand = anchorBrandKey0 === target_brand_key;
    const isSameScale = anchorSizeScale === targetSizeScale;

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

      // Guard: if scale filter removed all target rows, return NEED_MORE_INFO
      if (targetRowsAfterFilter === 0 && targetRowsBeforeFilter > 0) {
        // Target brand has sizing data but none in the anchor's scale
        needMoreInfoEarly = true;
      }

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

      if (!needMoreInfoEarly && targetSizingData?.length && (anchorSizingData?.length || estimatedMeasurements)) {
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
            recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key, anchorSizeScale);
          }
        } else {
          usedFallback = true;
          recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key, anchorSizeScale);
        }
      } else {
        usedFallback = true;
        recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key, anchorSizeScale);
      }

      // Final snap — only within same-scale available sizes
      const sameScaleAvailable = availableSizes.filter(s => inferSizeScaleFromLabel(s) === anchorSizeScale);
      if (sameScaleAvailable.length) {
        recommendedSize = snapToAvailableSize(recommendedSize, sameScaleAvailable, fit_preference || "true_to_size", target_brand_key);
      } else if (availableSizes.length) {
        // Fallback: snap to all available if no same-scale sizes exist
        recommendedSize = snapToAvailableSize(recommendedSize, availableSizes, fit_preference || "true_to_size", target_brand_key);
      }
    }

    // ── Confidence scoring ──────────────────────────────────────
    const confidence = computeConfidence(
      anchorMeasurementsUsed,
      targetSizingData as SizingRow[] | null,
      closestResult?.bestScore ?? null,
      closestResult?.matchedKeys ?? 0,
      closestResult?.totalKeys ?? 0,
      usedFallback,
      usedEstimated,
    );

    // ── Determine which measurement to ask for by category ──────
    function getAskForMeasurement(cat: string): string {
      const lower = cat.toLowerCase();
      if (["jeans", "denim", "shorts", "skirts", "bottoms"].includes(lower)) return "waist";
      if (["swim", "swimwear"].includes(lower)) return "bust";
      return "bust"; // tops, dresses, outerwear, default
    }

    // ── Hard guardrails ─────────────────────────────────────────
    const isExtremeSize = ["XXS", "XXXS", "00"].includes(recommendedSize.toUpperCase());
    let needMoreInfo = false;
    let needMoreInfoReason = "";
    let needMoreInfoAskFor = "";

    // Rule 0: scale filter eliminated all target rows
    if (needMoreInfoEarly) {
      needMoreInfo = true;
      needMoreInfoAskFor = getAskForMeasurement(category);
      needMoreInfoReason = `No sizing data available in ${anchorSizeScale} scale for this brand`;
    }

    // Rule 1: coverage < 2 OR confidence < 65 → NEED_MORE_INFO
    if (confidence.measurementCoverage < 2 || confidence.score < 65) {
      needMoreInfo = true;
      needMoreInfoAskFor = getAskForMeasurement(category);
      needMoreInfoReason = confidence.measurementCoverage < 2
        ? "Not enough measurement data to make a confident recommendation"
        : `Confidence too low (${confidence.score}%) for a reliable recommendation`;
    }

    // Rule 2: extreme size + confidence < 80 → NEED_MORE_INFO
    if (isExtremeSize && confidence.score < 80 && !needMoreInfo) {
      needMoreInfo = true;
      needMoreInfoAskFor = getAskForMeasurement(category);
      needMoreInfoReason = `Extreme size (${recommendedSize}) with insufficient confidence (${confidence.score}%)`;
      confidence.reasons.push("Blocked extreme size fallback — confidence below 80%");
    }

    // Rule 3: brand_source=fallback (Revolve couldn't detect brand) + confidence < 75 → NEED_MORE_INFO
    if (brand_source === "fallback" && confidence.score < 75 && !needMoreInfo) {
      needMoreInfo = true;
      needMoreInfoAskFor = getAskForMeasurement(category);
      needMoreInfoReason = "Could not confidently identify the brand on this page";
      confidence.reasons.push("Brand detection fell back — confidence threshold raised to 75%");
    }

    if (needMoreInfo || confidence.score < 65) {
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
      console.warn(`[LOW_CONFIDENCE] score=${confidence.score} coverage=${confidence.measurementCoverage} brand=${target_brand_key} category=${category}`);
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
      const anchorMids: Record<string, number> = {};
      const anchorRaw: Record<string, { min: number | null; max: number | null; midpoint: number | null }> = {};
      const missingDimensions: string[] = [];

      for (const k of keys) {
        const mv = anchorMeasurementsUsed?.[k] ?? null;
        const mid = getMidpoint(mv);
        if (mid !== null) {
          anchorMids[k] = mid;
          anchorRaw[k] = {
            min: mv?.min ?? mv?.value ?? null,
            max: mv?.max ?? mv?.value ?? null,
            midpoint: mid,
          };
        } else {
          missingDimensions.push(k);
        }
      }

      // Determine detection source heuristic
      const detectionSource: string = product_url ? "url" : "heuristic";

      // Top 3 candidate sizes
      const allScores = closestResult?.allScores || [];
      const top3Candidates = allScores.slice(0, 3);

      responseBody.debug = {
        detectedCategory: category,
        detectionSource,
        anchorBrand: anchor_brands[0]?.displayName || anchor_brands[0]?.brandKey,
        anchorSize: anchor_brands[0]?.size,
        anchorMeasurements: anchorMids,
        anchorMeasurementsRaw: anchorRaw,
        missingDimensions,
        measurementCoverage: confidence.measurementCoverage,
        keyDimensionsList: keys,
        targetBrandKey: target_brand_key,
        targetBrandDisplayName: targetDisplayName,
        targetSizeScale,
        availableSizes,
        fitPreference: fit_preference || "true_to_size",
        targetFitTendency,
        anchorSizeScale,
        targetRowsBeforeScaleFilter: targetRowsBeforeFilter,
        targetRowsAfterScaleFilter: targetRowsAfterFilter,
        isDenimScale: false,
        usedFallback,
        usedEstimatedMeasurements: usedEstimated,
        targetRowUsed: closestResult?.targetRowUsed
          ? {
              size_label: closestResult.targetRowUsed.size_label,
              measurements: closestResult.targetRowUsed.measurements,
              fit_notes: closestResult.targetRowUsed.fit_notes,
            }
          : null,
        top3Candidates,
        allSizeScores: allScores,
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
