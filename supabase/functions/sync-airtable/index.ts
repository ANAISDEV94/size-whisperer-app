import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Brand name → brand_key mapping ──────────────────────────────
const BRAND_KEY_MAP: Record<string, string> = {
  "&/Or Collective": "and_or_collective",
  "7 For All Mankind": "seven_for_all_mankind",
  "Alaïa": "alaia",
  "Alice + Olivia": "alice_and_olivia",
  "Alo Yoga": "alo_yoga",
  Aritzia: "aritzia",
  Balmain: "balmain",
  Bardot: "bardot",
  "Bronx and Banco": "bronx_and_banco",
  "Carolina Herrera": "carolina_herrera",
  CSB: "csb",
  "Cult Gaia": "cult_gaia",
  "David Koma": "david_koma",
  "Dolce & Gabbana": "dolce_and_gabbana",
  "For Love and Lemons": "for_love_and_lemons",
  Gucci: "gucci",
  Helsa: "helsa",
  "House of Harlow 1960": "house_of_harlow_1960",
  "Lovers + Friends": "lovers_and_friends",
  Lululemon: "lululemon",
  "Michael Costello": "michael_costello",
  Mother: "mother",
  NikeSKIMS: "nikeskims",
  "Norma Kamali": "norma_kamali",
  Prada: "prada",
  Rabanne: "rabanne",
  Reformation: "reformation",
  Retrofete: "retrofete",
  "Revolve Denim": "revolve_denim",
  SKIMS: "skims",
  "Stella McCartney": "stella_mccartney",
  Superdown: "superdown",
  "Tom Ford": "tom_ford",
  Torrid: "torrid",
  Valentino: "valentino",
  Versace: "versace",
  "Victoria Beckham": "victoria_beckham",
  Zimmermann: "zimmermann",
  ALO: "alo_yoga",
  Alo: "alo_yoga",
  alo: "alo_yoga",
  "DOLCE & GABBANA": "dolce_and_gabbana",
  "D&G": "dolce_and_gabbana",
  skims: "skims",
  "NIKE X SKIMS": "nikeskims",
  "Nike x Skims": "nikeskims",
  lululemon: "lululemon",
  LULULEMON: "lululemon",
};

function toBrandKey(name: string): string {
  if (BRAND_KEY_MAP[name]) return BRAND_KEY_MAP[name];
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ── Category normalization ───────────────────────────────────────
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

function normalizeCategorySync(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (CATEGORY_ALIAS_MAP[lower]) return CATEGORY_ALIAS_MAP[lower];
  // Convert any remaining spaces/punctuation to underscores for consistency
  return lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// ── Size scale detection ────────────────────────────────────────

const SCALE_ALIASES: Record<string, string> = {
  letter: "letter",
  letters: "letter",
  alpha: "letter",
  numeric: "numeric",
  number: "numeric",
  denim: "denim",
};

const LETTER_REGEX = /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|XXXL|4X)$/i;

function inferSizeScale(sizeLabel: string, explicitScale?: string): string {
  if (explicitScale) {
    const normalized = SCALE_ALIASES[explicitScale.toLowerCase().trim()];
    if (normalized) return normalized;
  }
  const trimmed = sizeLabel.trim();
  if (LETTER_REGEX.test(trimmed)) return "letter";
  if (/^\d+(\.\d+)?$/.test(trimmed)) return "numeric";
  if (/^\d{2}$/.test(trimmed) && parseInt(trimmed) >= 22 && parseInt(trimmed) <= 40) return "denim";
  return "other";
}

// ── Measurement parsing (numeric min/max/mid) ───────────────────

interface ParsedMeasurement {
  min: number;
  max: number;
  mid: number;
  unit: string;
}

function detectUnit(raw: string): { cleaned: string; unit: string } {
  const lower = raw.toLowerCase().trim();
  if (lower.includes("cm")) {
    return { cleaned: lower.replace(/cm/gi, "").trim(), unit: "cm" };
  }
  return { cleaned: lower.replace(/in(ches)?/gi, "").trim(), unit: "in" };
}

function parseMeasurementField(raw: string): ParsedMeasurement | null {
  if (!raw || !raw.trim()) return null;

  const { cleaned, unit } = detectUnit(raw);
  if (!cleaned) return null;

  // Try range: "36 - 38", "29-30.5", "23.5 - 24.5"
  const rangeParts = cleaned.split(/\s*[-–—]+\s*/);
  if (rangeParts.length === 2) {
    const a = parseFloat(rangeParts[0]);
    const b = parseFloat(rangeParts[1]);
    if (!isNaN(a) && !isNaN(b)) {
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      return { min, max, mid: (min + max) / 2, unit };
    }
  }

  // Try slash-separated options: "34/36" → treat as range
  const slashParts = cleaned.split(/\s*[/\\]\s*/);
  if (slashParts.length >= 2) {
    const nums = slashParts.map((s) => parseFloat(s)).filter((n) => !isNaN(n));
    if (nums.length >= 2) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return { min, max, mid: (min + max) / 2, unit };
    }
  }

  // Single value
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return { min: num, max: num, mid: num, unit };
  }

  return null;
}

// ── Airtable field name handling ─────────────────────────────────

const FIELD_NAME_MAP: Record<string, string> = {
  bust: "bust",
  chest: "bust",
  waist: "waist",
  hips: "hips",
  hip: "hips",
  "low hip": "hips",
  shoulder: "shoulders",
  shoulders: "shoulders",
  length: "length",
  "pants/denim length": "length",
  inseam: "inseam",
  rise: "rise",
  thigh: "thigh",
  sleeve: "sleeve_length",
  "sleeve length": "sleeve_length",
  arm: "sleeve_length",
  neck: "neck",
  torso: "torso",
  underbust: "underbust",
  "jump size": "jump_size",
  "us conversion size": "us_conversion_size",
  "bra size": "bra_size",
  "bra sizes": "bra_size",
  "bras size": "bra_size",
  notes: "_notes",
};

function normalizeFieldName(rawFieldName: string): { key: string; isMeasurement: boolean } {
  const cleaned = rawFieldName
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim()
    .toLowerCase();

  const mapped = FIELD_NAME_MAP[cleaned];
  if (mapped) {
    return { key: mapped, isMeasurement: !mapped.startsWith("_") };
  }

  for (const [pattern, normalizedKey] of Object.entries(FIELD_NAME_MAP)) {
    if (cleaned.includes(pattern)) {
      return { key: normalizedKey, isMeasurement: !normalizedKey.startsWith("_") };
    }
  }

  return { key: cleaned, isMeasurement: false };
}

// ── Airtable fetch ──────────────────────────────────────────────

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchAllRecords(
  apiKey: string,
  baseId: string,
  tableName: string
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
    );
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

// ── Main handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const airtableApiKey = Deno.env.get("AIRTABLE_API_KEY");
    const airtableBaseId = Deno.env.get("AIRTABLE_BASE_ID");
    const airtableTableName = Deno.env.get("AIRTABLE_TABLE_NAME");

    if (!airtableApiKey || !airtableBaseId || !airtableTableName) {
      return new Response(
        JSON.stringify({ error: "Missing Airtable configuration secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const records = await fetchAllRecords(airtableApiKey, airtableBaseId, airtableTableName);

    let synced = 0;
    let noMeasurements = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const record of records) {
      try {
        const fields = record.fields;

        const brandName =
          (fields["Brand"] as string) ||
          (fields["brand"] as string) ||
          (fields["Brand Name"] as string) ||
          "";
        const rawCategory =
          (fields["Category"] as string) ||
          (fields["category"] as string) ||
          (fields["Garment Category"] as string) ||
          "tops";
        const category = normalizeCategorySync(rawCategory);
        const sizeLabel =
          (fields["Size"] as string) ||
          (fields["size"] as string) ||
          (fields["Size Label"] as string) ||
          "";
        const explicitScale =
          (fields["Size Scale"] as string) ||
          (fields["size_scale"] as string) ||
          undefined;

        if (!brandName || !sizeLabel) {
          errors.push(`Record ${record.id}: missing brand or size`);
          continue;
        }

        const brandKey = toBrandKey(brandName);
        const sizeScale = inferSizeScale(sizeLabel, explicitScale);

        // Extract measurement fields
        const rawMeasurements: Record<string, string> = {};
        const measurements: Record<string, ParsedMeasurement | null> = {};
        let fitNotes: string | null = null;
        const skipFields = ["brand", "category", "size", "garment category", "brand name", "size label", "size scale", "size_scale"];

        for (const [key, val] of Object.entries(fields)) {
          if (typeof val !== "string") continue;
          const lowerKey = key.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
          if (skipFields.includes(lowerKey)) continue;

          const { key: normalizedKey, isMeasurement } = normalizeFieldName(key);

          if (normalizedKey === "_notes") {
            fitNotes = val || null;
          } else if (isMeasurement) {
            rawMeasurements[normalizedKey] = val;
            measurements[normalizedKey] = parseMeasurementField(val);
          }
        }

        // Check if any usable measurements exist
        const usableCount = Object.values(measurements).filter((v) => v !== null).length;
        if (usableCount === 0) {
          noMeasurements++;
          warnings.push(`Record ${record.id} (${brandName} ${sizeLabel}): no usable measurements`);
        }

        const { error: upsertError } = await supabase
          .from("sizing_charts")
          .upsert(
            {
              brand_key: brandKey,
              category,
              size_label: sizeLabel,
              size_scale: sizeScale,
              measurements,
              raw_measurements: rawMeasurements,
              fit_notes: fitNotes,
              airtable_record_id: record.id,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "airtable_record_id" }
          );

        if (upsertError) {
          errors.push(`Record ${record.id}: ${upsertError.message}`);
        } else {
          synced++;
        }
      } catch (e) {
        errors.push(`Record ${record.id}: ${(e as Error).message}`);
      }
    }

    console.log(`Sync complete: ${synced}/${records.length} rows imported, ${noMeasurements} rows with no usable measurements, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: records.length,
        synced,
        no_measurements_warnings: noMeasurements,
        errors_count: errors.length,
        errors: errors.slice(0, 20),
        warnings: warnings.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
