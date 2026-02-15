

# Client-Side Garment Capture and Base64 Pipeline for VTO

## Overview

The current VTO flow passes a garment image **URL** to the backend, which tries to download it server-side. This fails on most retailer CDNs due to hotlink protection, redirects, and bot detection. The fix is to capture the garment image **in the browser** (where the page already loaded it), convert it to PNG base64 via canvas, and send it directly to the edge function -- no server-side image fetching at all.

## Architecture Change

```text
BEFORE:
  Content Script --[URL via query param]--> Panel --[URL]--> Edge Function --[fetch URL]--> Replicate
  (fails: CDN blocks server-side fetch)

AFTER:
  Content Script --[captures image, converts to PNG base64 via canvas]--> postMessage --> Panel
  Panel --[base64]--> Edge Function --[validates base64, forwards]--> Replicate
  (works: image already loaded in browser, no external fetch needed)
```

## Why postMessage Instead of URL Params

Base64 images are ~500KB-2MB as strings -- far too large for URL query parameters (browsers cap at ~2KB-8KB). The content script must send the garment base64 to the panel iframe via `window.postMessage`.

---

## Step-by-Step Changes

### 1. Content Script (`extension/content.js`)

**Replace `extractGarmentImage()` return value from URL to base64:**

- Keep the existing image detection logic (og:image, JSON-LD, largest img)
- After finding the best image URL, add a new function `captureImageAsBase64(imgUrl)`:
  - First try: find the matching `<img>` element already in the DOM, draw it onto a canvas, export as PNG `toDataURL`
  - If the DOM element isn't found or tainted (CORS), fallback: `fetch(imgUrl)` as blob, create `ImageBitmap`, draw to canvas, export
  - If fetch also fails (CORS), set `garmentBase64 = null` and log the failure
- Send the base64 to the iframe via `postMessage` after iframe loads:
  ```
  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage({
      type: "ALTAANA_GARMENT_IMAGE",
      garmentImageBase64: base64String,
      extractionMethod: "dom_canvas" | "fetch_canvas" | "failed",
      sourceUrl: originalUrl
    }, PANEL_ORIGIN);
  });
  ```
- Remove `garment_image` from the iframe URL params (no longer needed)
- Keep passing `brand`, `category`, `url`, `source`, `brand_source` as URL params (they're small strings)

**New function: `captureImageAsBase64(imgUrl)`**
- Find DOM `<img>` with matching `src` or `currentSrc`
- Create an offscreen canvas, draw the image, call `toDataURL("image/png")`
- If canvas is tainted (cross-origin image without CORS headers), catch the error
- Fallback: `fetch(imgUrl)` -> blob -> `createImageBitmap` -> canvas -> `toDataURL`
- Return `{ base64, method }` or `{ base64: null, method: "failed" }`

### 2. Panel App: Listen for postMessage (`src/components/panel/ExtensionPanel.tsx`)

- Add a `useEffect` that listens for `window.addEventListener("message", ...)` 
- On receiving `ALTAANA_GARMENT_IMAGE`, store `garmentImageBase64` and `extractionMethod` in state
- Pass `garmentImageBase64` (not URL) to `VTOScreen`
- Keep `garmentImage` from URL params as a display-only fallback for the preview image (if postMessage hasn't arrived yet)

### 3. VTO Screen (`src/components/panel/screens/VTOScreen.tsx`)

**Updated props:**
- Add `garmentImageBase64: string | null` prop (the actual base64 to send to backend)
- Keep `garmentImageUrl: string | null` for preview display only
- Add `extractionMethod?: string` for debug display

**UI updates:**
- Garment preview: show base64 if available, fall back to URL, fall back to "no image" placeholder
- Add manual garment file upload button (shown always as secondary option, or primary if auto-capture failed)
- Error state: add a collapsible "Show details" section with:
  - Extraction method used
  - Image sizes (person photo KB, garment KB)
  - Full error message from backend
- "Generate Try-On" sends `garmentImageBase64` (not URL) to the hook

**Manual garment upload:**
- Same file input pattern as person photo
- Convert to PNG base64 via canvas (reuse the `readFileAsBase64` helper)
- This serves as fallback when auto-capture fails

### 4. VTO Hook (`src/hooks/useVirtualTryOn.ts`)

**Change the `startPrediction` signature:**
```typescript
startPrediction(
  personImageBase64: string,
  garmentImageBase64: string,  // was garmentImageUrl
  category?: string
)
```

**Change the POST body:**
```typescript
body: JSON.stringify({
  person_image_base64: personImageBase64,
  garment_image_base64: garmentImageBase64,  // was garment_image_url
  category,
})
```

**Debug logging update:**
- Log `garmentImageBase64` length and approx KB (not URL)
- Log `personImageBase64` length and approx KB

### 5. Edge Function (`supabase/functions/virtual-tryon/index.ts`)

**Remove server-side image fetching entirely:**
- Delete the `fetchImageAsDataUri()` function
- Accept `garment_image_base64` in the POST body (instead of `garment_image_url`)

**Add base64 validation for both images:**
```typescript
function validateImageBase64(base64: string, fieldName: string) {
  if (!base64) throw { field: fieldName, reason: "missing" };
  
  // Must be a data URI
  const match = base64.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
  if (!match) throw { field: fieldName, reason: "not a data URI", snippet: base64.substring(0, 80) };
  
  // Decode and check magic bytes
  const raw = base64.split(",")[1];
  const decoded = Uint8Array.from(atob(raw.substring(0, 16)), c => c.charCodeAt(0));
  
  const isPNG = decoded[0] === 137 && decoded[1] === 80;
  const isJPEG = decoded[0] === 255 && decoded[1] === 216;
  if (!isPNG && !isJPEG) throw { field: fieldName, reason: "invalid magic bytes", detected: Array.from(decoded.slice(0, 4)) };
}
```

**Updated POST handler:**
- Read `person_image_base64` and `garment_image_base64` from body
- Validate both with `validateImageBase64`
- On validation failure: return HTTP 400 with field name, reason, and safe snippet
- Pass both directly to Replicate (they're already data URIs)
- Log only lengths, never full base64

### 6. Smoke Test Update (`src/components/panel/SmokeTestRunner.tsx`)

- Update the VTO test case (if it exists) to send `garment_image_base64` instead of `garment_image_url`

---

## Files Changed

| File | Change |
|------|--------|
| `extension/content.js` | Add `captureImageAsBase64()`, send base64 via postMessage, remove `garment_image` URL param |
| `src/components/panel/ExtensionPanel.tsx` | Add postMessage listener for garment base64, pass to VTOScreen |
| `src/components/panel/screens/VTOScreen.tsx` | Accept base64 prop, add manual garment upload, add "Show details" collapsible |
| `src/hooks/useVirtualTryOn.ts` | Change signature to accept base64 instead of URL |
| `supabase/functions/virtual-tryon/index.ts` | Remove `fetchImageAsDataUri`, accept and validate base64, add magic byte checks |

