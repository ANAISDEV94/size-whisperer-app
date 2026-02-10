import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Brand name → brand_key mapping ──────────────────────────────
const BRAND_KEY_MAP: Record<string, string> = {
  // Full display names
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
  // Airtable shorthand / alternate names
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

// ── Measurement normalization ───────────────────────────────────

interface NormalizedValue {
  value?: number;
  min?: number;
  max?: number;
  options?: (number | { min: number; max: number })[];
  note?: string;
  unit: string;
}

function detectUnit(raw: string): { cleaned: string; unit: string } {
  const lower = raw.toLowerCase().trim();
  if (lower.includes("cm")) {
    return { cleaned: lower.replace(/cm/gi, "").trim(), unit: "cm" };
  }
  return { cleaned: lower.replace(/in(ches)?/gi, "").trim(), unit: "in" };
}

function parseSegment(
  s: string
): number | { min: number; max: number } | { note: string } | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  // Check for range: dash / en-dash / em-dash
  const rangeParts = trimmed.split(/\s*[-–—]+\s*/);
  if (rangeParts.length === 2) {
    const a = parseFloat(rangeParts[0]);
    const b = parseFloat(rangeParts[1]);
    if (!isNaN(a) && !isNaN(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }

  const num = parseFloat(trimmed);
  if (!isNaN(num)) return num;

  return { note: trimmed };
}

function normalizeMeasurement(raw: string): NormalizedValue | null {
  if (!raw || !raw.trim()) return null;

  const { cleaned, unit } = detectUnit(raw);
  if (!cleaned) return null;

  // Split by slash or backslash first (OR options)
  const orParts = cleaned.split(/\s*[/\\]\s*/);

  if (orParts.length === 1) {
    // Single segment — could be a value or range
    const result = parseSegment(orParts[0]);
    if (result === null) return null;
    if (typeof result === "number") return { value: result, unit };
    if ("note" in result) return { note: result.note, unit };
    return { min: result.min, max: result.max, unit };
  }

  // Multiple OR options
  const options: (number | { min: number; max: number })[] = [];
  let hasNote = false;
  let noteText = "";

  for (const part of orParts) {
    const result = parseSegment(part);
    if (result === null) continue;
    if (typeof result === "number") {
      options.push(result);
    } else if ("note" in result) {
      hasNote = true;
      noteText += (noteText ? ", " : "") + result.note;
    } else {
      options.push(result);
    }
  }

  if (options.length === 0 && hasNote) {
    return { note: noteText, unit };
  }
  if (options.length === 1) {
    const opt = options[0];
    if (typeof opt === "number") return { value: opt, unit };
    return { min: opt.min, max: opt.max, unit };
  }
  if (options.length > 0) {
    return { options, unit };
  }

  return null;
}

function normalizeRecord(
  rawMeasurements: Record<string, string>
): Record<string, NormalizedValue | null> {
  const normalized: Record<string, NormalizedValue | null> = {};
  for (const [key, value] of Object.entries(rawMeasurements)) {
    normalized[key] = normalizeMeasurement(value);
  }
  return normalized;
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

// ── Airtable field name handling ─────────────────────────────────
// Airtable columns often have units in brackets like "Bust (inches)"
// or alternate names like "Low Hip (inches)" meaning "hips"

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
  // Strip content in brackets like "(inches)", "(in)", "(cm)"
  const cleaned = rawFieldName
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim()
    .toLowerCase();

  const mapped = FIELD_NAME_MAP[cleaned];
  if (mapped) {
    // Fields starting with _ are metadata, not measurements
    return { key: mapped, isMeasurement: !mapped.startsWith("_") };
  }

  // Fallback: check if any known field name is contained
  for (const [pattern, normalizedKey] of Object.entries(FIELD_NAME_MAP)) {
    if (cleaned.includes(pattern)) {
      return { key: normalizedKey, isMeasurement: !normalizedKey.startsWith("_") };
    }
  }

  return { key: cleaned, isMeasurement: false };
}

// ── Main handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require service role key
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (
      !authHeader ||
      !serviceRoleKey ||
      authHeader !== `Bearer ${serviceRoleKey}`
    ) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Fetch all records from Airtable
    const records = await fetchAllRecords(
      airtableApiKey,
      airtableBaseId,
      airtableTableName
    );

    let synced = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const fields = record.fields;

        // Extract brand, category, size from fields
        // Adjust field names to match your Airtable schema
        const brandName =
          (fields["Brand"] as string) ||
          (fields["brand"] as string) ||
          (fields["Brand Name"] as string) ||
          "";
        const category =
          (fields["Category"] as string) ||
          (fields["category"] as string) ||
          (fields["Garment Category"] as string) ||
          "tops";
        const sizeLabel =
          (fields["Size"] as string) ||
          (fields["size"] as string) ||
          (fields["Size Label"] as string) ||
          "";

        if (!brandName || !sizeLabel) {
          errors.push(`Record ${record.id}: missing brand or size`);
          continue;
        }

        const brandKey = toBrandKey(brandName);

        // Extract measurement fields using field name normalization
        const rawMeasurements: Record<string, string> = {};
        let fitNotes: string | null = null;
        const skipFields = ["brand", "category", "size", "garment category", "brand name", "size label"];

        for (const [key, val] of Object.entries(fields)) {
          if (typeof val !== "string") continue;
          const lowerKey = key.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
          if (skipFields.includes(lowerKey)) continue;

          const { key: normalizedKey, isMeasurement } = normalizeFieldName(key);

          if (normalizedKey === "_notes") {
            fitNotes = val || null;
          } else if (isMeasurement) {
            rawMeasurements[normalizedKey] = val;
          }
        }

        const measurements = normalizeRecord(rawMeasurements);

        // Upsert sizing chart
        const { error: upsertError } = await supabase
          .from("sizing_charts")
          .upsert(
            {
              brand_key: brandKey,
              category: category.toLowerCase(),
              size_label: sizeLabel,
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

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: records.length,
        synced,
        errors_count: errors.length,
        errors: errors.slice(0, 20), // Limit error output
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
