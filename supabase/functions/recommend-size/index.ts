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
// Compare measurements between anchor brand sizes and target brand sizes
// to find the closest match

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

function findClosestSize(
  anchorMeasurements: Record<string, MeasurementValue | null> | null,
  targetSizes: SizingRow[],
  fitPreference: string
): { size: string; fitNotes: string | null } | null {
  if (!anchorMeasurements || targetSizes.length === 0) return null;

  // Key measurements to compare (in priority order)
  const keys = ["bust", "waist", "hips"];
  const anchorMids: Record<string, number> = {};
  for (const k of keys) {
    const mid = getMidpoint(anchorMeasurements[k]);
    if (mid !== null) anchorMids[k] = mid;
  }

  if (Object.keys(anchorMids).length === 0) return null;

  let bestSize = targetSizes[0];
  let bestScore = Infinity;

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

  return { size: resultSize, fitNotes: bestSize.fit_notes };
}

// ── Size scale conversion ────────────────────────────────────────
const LETTER_TO_NUMERIC: Record<string, string> = {
  XXXS: "00", XXS: "0", XS: "2", S: "4", M: "6", L: "10", XL: "12", "2X": "16", "3X": "18", "4X": "20"
};
const NUMERIC_TO_LETTER: Record<string, string> = {
  "00": "XXXS", "0": "XXS", "2": "XS", "4": "S", "6": "M", "8": "M", "10": "L", "12": "XL", "14": "XL", "16": "2X", "18": "3X", "20": "4X"
};

// Brand-specific size scale mappings to universal US numeric index
// Each maps brand sizes → approximate US numeric equivalent index
const BRAND_SCALE_MAPS: Record<string, Record<string, number>> = {
  zimmermann: { "0": 1, "1": 2, "2": 4, "3": 6, "4": 8, "5": 10 },
  and_or_collective: { "1": 2, "2": 6, "3": 10 }, // 1=XS/S, 2=M, 3=L/XL
  // Denim waist sizes → universal index (US numeric equivalent)
  seven_for_all_mankind: { "22": 0, "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9 },
  mother: { "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9, "33": 10, "34": 11 },
  revolve_denim: { "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9 },
  // UK sizes → universal index (UK 4 = US 0, UK 6 = US 2, etc.)
  david_koma: { "4": 1, "6": 2, "8": 3, "10": 4, "12": 5, "14": 6, "16": 7 },
  victoria_beckham: { "4": 1, "6": 2, "8": 3, "10": 4, "12": 5, "14": 6, "16": 7 },
};

// Universal size-to-index mapping for cross-scale comparison
// Maps any size system to a normalized 0-based position (US numeric as baseline)
const UNIVERSAL_SIZE_MAP: Record<string, number> = {
  // US numeric
  "00": 0, "0": 1, "2": 2, "4": 3, "6": 4, "8": 5, "10": 6, "12": 7, "14": 8, "16": 9, "18": 10, "20": 11,
  // US letter
  "XXXS": 0, "XXS": 1, "XS": 2, "S": 3, "M": 4, "L": 6, "XL": 7, "2X": 9, "3X": 10, "4X": 11,
  // EU/IT numeric
  "34": 0, "36": 1, "38": 2, "40": 3, "42": 4, "44": 5, "46": 6, "48": 7,
  // Denim waist sizes (mapped to universal index)
  "22": 0, "23": 0, "24": 1, "25": 2, "26": 3, "27": 4, "28": 5, "29": 6, "30": 7, "31": 8, "32": 9, "33": 10,
};

function getUniversalIndex(size: string, brandKey?: string): number {
  const upper = size.toUpperCase().trim();
  // Check brand-specific mapping first
  if (brandKey && BRAND_SCALE_MAPS[brandKey]) {
    const brandIdx = BRAND_SCALE_MAPS[brandKey][upper];
    if (brandIdx !== undefined) return brandIdx;
  }
  if (UNIVERSAL_SIZE_MAP[upper] !== undefined) return UNIVERSAL_SIZE_MAP[upper];
  // Try parsing as number for unknown numeric sizes
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

// Snap a size to the closest valid size from the target brand's available_sizes
function snapToAvailableSize(size: string, availableSizes: string[], fitPreference: string, brandKey?: string): string {
  if (!availableSizes.length) return size;
  
  const upper = size.toUpperCase().trim();
  // If already valid, return it
  if (availableSizes.map(s => s.toUpperCase()).includes(upper)) return upper;

  // Find closest by universal index (brand-aware)
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

function fallbackSizeMapping(anchorSize: string, fitPreference: string, targetScale: string, availableSizes: string[], anchorBrandKey?: string, targetBrandKey?: string): string {
  // Get universal index from anchor brand's scale (brand-aware)
  const anchorIdx = getUniversalIndex(anchorSize, anchorBrandKey);
  
  // If we have available sizes and a valid anchor index, find closest match
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

  // Legacy fallback: scale conversion
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

// ── Product page fit scraping ───────────────────────────────────

async function scrapeProductFit(productUrl: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    // Fetch page HTML (timeout 8s to keep function fast)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const pageResp = await fetch(productUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ALTAANA/1.0)" },
    });
    clearTimeout(timeout);

    if (!pageResp.ok) return null;
    const html = await pageResp.text();

    // Extract only the relevant text (strip scripts/styles, take first 12k chars)
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
    // Fallback bullets without AI
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

  // Add anchor brands
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

  // Add target brand
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

    // Humanize brand key if no catalog entry: "norma_kamali" → "Norma Kamali"
    const targetDisplayName = targetBrand?.display_name || target_brand_key.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const targetFitTendency = targetBrand?.fit_tendency || null;
    const targetSizeScale = targetBrand?.size_scale || "letter";
    const availableSizes: string[] = (targetBrand?.available_sizes as string[]) || [];

    // 2. Fetch sizing charts for target brand
    const category = target_category || "tops";
    const { data: targetSizingData } = await supabase
      .from("sizing_charts")
      .select("size_label, measurements, fit_notes")
      .eq("brand_key", target_brand_key)
      .eq("category", category);

    // 3. Fetch anchor brand sizing data
    const anchorBrandKeys = anchor_brands.map((a: { brandKey: string }) => a.brandKey);
    const { data: anchorSizingData } = await supabase
      .from("sizing_charts")
      .select("brand_key, size_label, measurements")
      .in("brand_key", anchorBrandKeys)
      .eq("category", category);

    // 4. Determine recommended size
    let recommendedSize: string;
    let fitNotes: string | null = null;

    if (targetSizingData?.length && anchorSizingData?.length) {
      const anchorBrand = anchor_brands[0];
      const anchorRow = anchorSizingData.find(
        (r: SizingRow & { brand_key: string }) =>
          r.brand_key === anchorBrand.brandKey &&
          r.size_label.toUpperCase() === anchorBrand.size.toUpperCase()
      );

      if (anchorRow?.measurements) {
        const result = findClosestSize(
          anchorRow.measurements as Record<string, MeasurementValue | null>,
          targetSizingData as SizingRow[],
          fit_preference || "true_to_size"
        );
        if (result) {
          recommendedSize = convertToScale(result.size, targetSizeScale);
          fitNotes = result.fitNotes;
        } else {
          recommendedSize = fallbackSizeMapping(anchorBrand.size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchorBrand.brandKey, target_brand_key);
        }
      } else {
        recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key);
      }
    } else {
      recommendedSize = fallbackSizeMapping(anchor_brands[0].size, fit_preference || "true_to_size", targetSizeScale, availableSizes, anchor_brands[0].brandKey, target_brand_key);
    }

    // Final snap: ensure recommendedSize is one the target brand actually sells
    if (availableSizes.length) {
      recommendedSize = snapToAvailableSize(recommendedSize, availableSizes, fit_preference || "true_to_size", target_brand_key);
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

    // 6. Generate comparisons
    const comparisons = generateComparisons(
      anchor_brands,
      targetDisplayName,
      recommendedSize,
      targetFitTendency,
    );

    // 7. Log recommendation if user is authenticated
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

    return new Response(
      JSON.stringify({
        size: recommendedSize,
        brandName: targetDisplayName,
        sizeScale: targetSizeScale,
        bullets,
        comparisons,
        productFitSummary,
        recommendation_id: recommendationId,
      }),
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
