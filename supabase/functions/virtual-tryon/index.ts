import { corsHeaders } from "../_shared/cors.ts";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

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

  // Decode first 16 bytes and check magic bytes
  const decoded = Uint8Array.from(atob(raw.substring(0, 24)), c => c.charCodeAt(0));
  const isPNG = decoded[0] === 137 && decoded[1] === 80 && decoded[2] === 78 && decoded[3] === 71;
  const isJPEG = decoded[0] === 255 && decoded[1] === 216;
  const isWEBP = decoded[0] === 82 && decoded[1] === 73 && decoded[2] === 70 && decoded[3] === 70; // RIFF

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
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
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
        return new Response(JSON.stringify({ error: "prediction_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      const data = await res.json();

      const status = data.status;
      const result: Record<string, unknown> = { prediction_id: predictionId, status };

      if (status === "succeeded") {
        const output = data.output;
        result.output_image_url = Array.isArray(output) ? output[0] : output;
      } else if (status === "failed" || status === "canceled") {
        result.error = data.error || "Prediction failed";
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: Start a new prediction ──
    if (req.method === "POST") {
      const body = await req.json();
      const { person_image_base64, garment_image_base64, category } = body;

      if (!person_image_base64 || !garment_image_base64) {
        return new Response(JSON.stringify({ error: "person_image_base64 and garment_image_base64 required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate both images
      try {
        validateImageBase64(person_image_base64, "person_image_base64");
      } catch (err) {
        console.error("[virtual-tryon] Person image validation failed:", JSON.stringify(err));
        return new Response(JSON.stringify({ error: `Invalid person image: ${(err as Record<string, unknown>).reason}`, detail: err }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        validateImageBase64(garment_image_base64, "garment_image_base64");
      } catch (err) {
        console.error("[virtual-tryon] Garment image validation failed:", JSON.stringify(err));
        return new Response(JSON.stringify({ error: `Invalid garment image: ${(err as Record<string, unknown>).reason}`, detail: err }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log sizes only, never full base64
      console.log("[virtual-tryon] Images validated OK", {
        personLength: person_image_base64.length,
        personApproxKB: Math.round(person_image_base64.length * 0.75 / 1024),
        garmentLength: garment_image_base64.length,
        garmentApproxKB: Math.round(garment_image_base64.length * 0.75 / 1024),
      });

      // Size check (~5MB limit each)
      const personSizeBytes = (person_image_base64.length * 3) / 4;
      const garmentSizeBytes = (garment_image_base64.length * 3) / 4;
      if (personSizeBytes > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Person image too large. Max 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (garmentSizeBytes > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Garment image too large. Max 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const vtonCategory = mapCategory(category);

      const res = await fetch(REPLICATE_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985",
          input: {
            human_img: person_image_base64,
            garm_img: garment_image_base64,
            category: vtonCategory,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[virtual-tryon] Replicate error:", JSON.stringify(data));
        return new Response(JSON.stringify({ error: data.detail || "Failed to start prediction" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ prediction_id: data.id, status: data.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[virtual-tryon] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
