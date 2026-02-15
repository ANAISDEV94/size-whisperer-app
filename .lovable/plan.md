
# Fix VTO: Upload Images to Replicate Files API Before Creating Prediction

## Root Cause

The error `"can only concatenate str (not 'NoneType') to str"` is a **Python error from the Replicate model**. It means the model received `None` for one of its image inputs.

**Why**: Replicate's raw HTTP API only reliably handles data URIs for files **under 256KB**. Your garment image is ~1.4MB and person photo is ~381KB. When data URIs exceed this limit, Replicate's server silently fails to parse them, passing `None` to the model's Python code, which then crashes.

**Fix**: Upload both images to Replicate's `/v1/files` endpoint first, get back hosted URLs, then pass those URLs to the prediction input.

---

## Changes

### 1. Edge Function: `supabase/functions/virtual-tryon/index.ts`

Add a helper function `uploadToReplicateFiles(base64DataUri, token)` that:
- Strips the `data:image/...;base64,` prefix
- Decodes the base64 to binary bytes
- POSTs the binary to `https://api.replicate.com/v1/files` as `multipart/form-data` with the correct MIME type
- Returns the resulting file URL from the response

Update the POST handler to:
1. Validate both base64 images (keep existing validation -- it works)
2. Upload person image via `/v1/files` --> get `personFileUrl`
3. Upload garment image via `/v1/files` --> get `garmentFileUrl`
4. Create prediction using the URLs instead of data URIs:
   ```
   input: {
     human_img: personFileUrl,
     garm_img: garmentFileUrl,
     category: vtonCategory,
   }
   ```
5. If either upload fails, return HTTP 400 with a clear error identifying which image failed

### 2. No frontend changes needed

The frontend and hook are working correctly -- they send base64, show errors, and poll properly. The fix is entirely in the edge function.

---

## Technical Details

### Replicate Files API

```text
POST https://api.replicate.com/v1/files
Authorization: Bearer {token}
Content-Type: multipart/form-data

Form field: content = binary file data with filename and MIME type

Response:
{
  "id": "...",
  "urls": {
    "get": "https://api.replicate.com/v1/files/..."
  }
}
```

The file URL from the response can be passed directly as input to predictions.

### Upload helper pseudocode

```
async function uploadToReplicateFiles(base64DataUri, filename, token):
  // Extract MIME type and raw base64
  match = base64DataUri.match(/^data:(image\/\w+);base64,(.+)$/)
  mimeType = match[1]
  rawBase64 = match[2]
  
  // Decode to binary
  binaryData = Uint8Array from atob(rawBase64)
  
  // Build multipart form
  formData = new FormData()
  formData.append("content", new Blob([binaryData], { type: mimeType }), filename)
  
  // Upload
  response = POST "https://api.replicate.com/v1/files" with formData
  
  // Return the URL Replicate can use
  return response.urls.get
```

### Updated prediction flow

```text
Client POST (unchanged):
  person_image_base64: "data:image/png;base64,..."  (~381 KB)
  garment_image_base64: "data:image/png;base64,..." (~1.4 MB)

Edge Function (updated):
  1. Validate both base64 images (existing logic)
  2. Upload person image -> https://api.replicate.com/v1/files/abc123
  3. Upload garment image -> https://api.replicate.com/v1/files/def456
  4. Create prediction with file URLs:
     human_img: "https://api.replicate.com/v1/files/abc123"
     garm_img: "https://api.replicate.com/v1/files/def456"
  5. Return prediction_id to client

Replicate:
  - Downloads images from its own file hosting (no CDN blocking)
  - Processes normally
```

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/virtual-tryon/index.ts` | Add `uploadToReplicateFiles()`, upload both images before creating prediction, pass URLs instead of data URIs |

No frontend, hook, or extension changes needed.
