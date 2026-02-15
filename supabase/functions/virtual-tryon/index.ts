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

// Fetch a remote image and return it as a base64 data URI
async function fetchImageAsDataUri(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch garment image: ${res.status} ${res.statusText}`);
  }

  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);

  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error("Garment image too large (max 5MB)");
  }

  // Detect content type
  const ct = res.headers.get("content-type") || "";
  const mime = ct.startsWith("image/") ? ct.split(";")[0] : "image/jpeg";

  // Convert to base64
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return `data:${mime};base64,${btoa(binary)}`;
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
      const { person_image_base64, garment_image_url, category } = body;

      if (!person_image_base64 || !garment_image_url) {
        return new Response(JSON.stringify({ error: "person_image_base64 and garment_image_url required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate person image size (~5MB limit)
      const sizeBytes = (person_image_base64.length * 3) / 4;
      if (sizeBytes > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Image too large. Max 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure person image has data URI prefix
      const personImg = person_image_base64.startsWith("data:")
        ? person_image_base64
        : `data:image/jpeg;base64,${person_image_base64}`;

      // Proxy garment image: fetch server-side and convert to base64
      let garmentImg: string;
      try {
        console.log("[virtual-tryon] Fetching garment image:", garment_image_url);
        garmentImg = await fetchImageAsDataUri(garment_image_url);
        console.log("[virtual-tryon] Garment image proxied successfully, length:", garmentImg.length);
      } catch (err) {
        console.error("[virtual-tryon] Garment fetch error:", err);
        return new Response(JSON.stringify({ error: "Could not load garment image. The retailer may be blocking access." }), {
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
            human_img: personImg,
            garm_img: garmentImg,
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
