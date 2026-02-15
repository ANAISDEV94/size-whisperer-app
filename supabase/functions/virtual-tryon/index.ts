import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// Upload a base64 data URI to Supabase Storage, return a public URL
async function uploadToSupabaseStorage(base64DataUri: string, filename: string): Promise<string> {
  const match = base64DataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URI format");

  const mimeType = match[1];
  const raw = match[2];
  const binaryString = atob(raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.storage
    .from("vto-temp")
    .upload(filename, bytes, { contentType: mimeType, upsert: true });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/vto-temp/${filename}`;
}

// Fetch an image from a URL server-side and upload to Supabase Storage
async function fetchAndUploadFromUrl(imageUrl: string, filename: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Altaana/1.0)",
      "Accept": "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const contentType = response.headers.get("content-type") || "image/jpeg";

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.storage
    .from("vto-temp")
    .upload(filename, bytes, { contentType, upsert: true });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/vto-temp/${filename}`;
}

// Map ALTAANA categories to IDM-VTON categories
function mapCategory(cat?: string): string {
  if (!cat) return "upper_body";
  const c = cat.toLowerCase();
  if (c.includes("dress") || c === "dresses") return "dresses";
  if (c.includes("bottom") || c.includes("pant") || c.includes("skirt") || c.includes("denim") || c === "bottoms") return "lower_body";
  return "upper_body";
}

// Validate base64 data URI: check format and magic bytes
function validateImageBase64(base64: string, fieldName: string) {
  if (!base64) {
    throw { field: fieldName, reason: "missing" };
  }

  const match = base64.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
  if (!match) {
    throw { field: fieldName, reason: "not a valid image data URI", snippet: base64.substring(0, 80) };
  }

  const raw = base64.split(",")[1];
  if (!raw || raw.length < 16) {
    throw { field: fieldName, reason: "base64 payload too short" };
  }

  const decoded = Uint8Array.from(atob(raw.substring(0, 24)), c => c.charCodeAt(0));
  const isPNG = decoded[0] === 137 && decoded[1] === 80 && decoded[2] === 78 && decoded[3] === 71;
  const isJPEG = decoded[0] === 255 && decoded[1] === 216;
  const isWEBP = decoded[0] === 82 && decoded[1] === 73 && decoded[2] === 70 && decoded[3] === 70;

  if (!isPNG && !isJPEG && !isWEBP) {
    throw { field: fieldName, reason: "invalid magic bytes — not PNG/JPEG/WEBP", detected: Array.from(decoded.slice(0, 4)) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  if (!REPLICATE_API_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── GET: Poll for prediction result ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const predictionId = url.searchParams.get("prediction_id");
      if (!predictionId) {
        return new Response(JSON.stringify({ ok: false, error: "prediction_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      const data = await res.json();

      const status = data.status;
      const result: Record<string, unknown> = { ok: true, prediction_id: predictionId, status };

      if (status === "succeeded") {
        const output = data.output;
        result.output_image_url = Array.isArray(output) ? output[0] : output;
      } else if (status === "failed" || status === "canceled") {
        result.ok = false;
        result.error = data.error ?? "Prediction failed";
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: Start a new prediction ──
    if (req.method === "POST") {
      const body = await req.json();
      const { person_image_base64, garment_image_base64, garment_image_url } = body;

      // Defensive coalescing of all optional fields
      const extractionMethod = body.extractionMethod ?? "unknown";
      const garmentType = body.garmentType ?? "unknown";
      const category = body.category ?? "unknown";

      if (!person_image_base64) {
        return new Response(JSON.stringify({
          ok: false,
          error: "person_image_base64 required",
          debugInfo: { extractionMethod, garmentType, category },
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!garment_image_base64 && !garment_image_url) {
        return new Response(JSON.stringify({
          ok: false,
          error: "garment_image_base64 or garment_image_url required",
          debugInfo: { extractionMethod, garmentType, category },
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate person image (always base64)
      try {
        validateImageBase64(person_image_base64, "person_image_base64");
      } catch (err) {
        const reason = (err as Record<string, unknown>).reason ?? "unknown";
        console.error(`[virtual-tryon] Person image validation failed: ${reason}`);
        return new Response(JSON.stringify({
          ok: false,
          error: `Invalid person image: ${reason}`,
          debugInfo: {
            extractionMethod,
            userSizeKB: Math.round((person_image_base64?.length ?? 0) * 0.75 / 1024),
            garmentSizeKB: Math.round((garment_image_base64?.length ?? 0) * 0.75 / 1024),
          },
          detail: err,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate garment base64 if provided
      if (garment_image_base64) {
        try {
          validateImageBase64(garment_image_base64, "garment_image_base64");
        } catch (err) {
          const reason = (err as Record<string, unknown>).reason ?? "unknown";
          console.error(`[virtual-tryon] Garment image validation failed: ${reason}`);
          return new Response(JSON.stringify({
            ok: false,
            error: `Invalid garment image: ${reason}`,
            debugInfo: {
              extractionMethod,
              userSizeKB: Math.round((person_image_base64?.length ?? 0) * 0.75 / 1024),
              garmentSizeKB: Math.round((garment_image_base64?.length ?? 0) * 0.75 / 1024),
            },
            detail: err,
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.log(`[virtual-tryon] Input accepted — extraction: ${extractionMethod}, garmentType: ${garmentType}, category: ${category}`, {
        personApproxKB: Math.round((person_image_base64?.length ?? 0) * 0.75 / 1024),
        garmentSource: garment_image_base64 ? "base64" : "url",
        garmentUrl: garment_image_url ?? "none",
      });

      // Size check for person image (~5MB limit)
      const personSizeBytes = ((person_image_base64?.length ?? 0) * 3) / 4;
      if (personSizeBytes > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Person image too large. Max 5MB.",
          debugInfo: { extractionMethod, userSizeKB: Math.round(personSizeBytes / 1024) },
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (garment_image_base64) {
        const garmentSizeBytes = ((garment_image_base64?.length ?? 0) * 3) / 4;
        if (garmentSizeBytes > 5 * 1024 * 1024) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Garment image too large. Max 5MB.",
            debugInfo: { extractionMethod, garmentSizeKB: Math.round(garmentSizeBytes / 1024) },
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const vtonCategory = mapCategory(category);

      // Upload both images to Supabase Storage for public URLs
      let personPublicUrl: string;
      let garmentPublicUrl: string;
      const personFilename = `${crypto.randomUUID()}.png`;
      const garmentFilename = `${crypto.randomUUID()}.png`;

      try {
        console.log("[virtual-tryon] Uploading person image to storage...");
        personPublicUrl = await uploadToSupabaseStorage(person_image_base64, personFilename);
        console.log(`[virtual-tryon] Person image uploaded: ${personPublicUrl}`);
      } catch (err) {
        const message = (err as Error).message ?? "unknown error";
        console.error(`[virtual-tryon] Person image upload failed: ${message}`);
        return new Response(JSON.stringify({
          ok: false,
          error: `Failed to upload person image: ${message}`,
          debugInfo: { extractionMethod },
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload garment: base64 path or URL fetch path
      try {
        if (garment_image_base64) {
          console.log("[virtual-tryon] Uploading garment image from base64...");
          garmentPublicUrl = await uploadToSupabaseStorage(garment_image_base64, garmentFilename);
        } else {
          console.log(`[virtual-tryon] Fetching garment image from URL: ${garment_image_url ?? "none"}`);
          garmentPublicUrl = await fetchAndUploadFromUrl(garment_image_url, garmentFilename);
        }
        console.log(`[virtual-tryon] Garment image ready: ${garmentPublicUrl}`);
      } catch (err) {
        const message = (err as Error).message ?? "unknown error";
        console.error(`[virtual-tryon] Garment image processing failed: ${message}`);
        return new Response(JSON.stringify({
          ok: false,
          error: `Failed to process garment image: ${message}`,
          debugInfo: { extractionMethod, garmentSource: garment_image_base64 ? "base64" : "url" },
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Replicate API call — wrapped in dedicated try/catch
      let replicateResponse: Response;
      try {
        replicateResponse = await fetch(REPLICATE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985",
            input: {
              human_img: personPublicUrl,
              garm_img: garmentPublicUrl,
              category: vtonCategory,
            },
          }),
        });
      } catch (err) {
        const message = (err as Error).message ?? "unknown network error";
        console.error(`[virtual-tryon] Replicate request failed: ${message}`);
        return new Response(JSON.stringify({
          ok: false,
          error: "Replicate request failed",
          debugInfo: { status: 0, message, extractionMethod },
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await replicateResponse.json();

      if (!replicateResponse.ok) {
        const detail = data?.detail ?? "Failed to start prediction";
        console.error(`[virtual-tryon] Replicate error [${replicateResponse.status}]: ${detail}`);
        return new Response(JSON.stringify({
          ok: false,
          error: detail,
          debugInfo: { status: replicateResponse.status, extractionMethod },
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ ok: true, prediction_id: data.id, status: data.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    console.error(`[virtual-tryon] Unhandled error: ${message}`);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error", debugInfo: { message } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
