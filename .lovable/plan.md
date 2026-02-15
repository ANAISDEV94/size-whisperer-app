

# Make VTO Pipeline Robust and Defensive

## Problem
The error "can only concatenate str (not 'NoneType') to str" is caused by null/undefined values flowing through string operations in both the frontend payload and the edge function.

## Changes

### 1. Content Script (`extension/content.js`)
- In `extractGarmentImage()`, track which method succeeded and return it alongside the URL
- In `captureImageAsBase64()`, the `method` field already returns proper strings ("dom_canvas", "fetch_canvas", "failed")
- In the postMessage, ensure `extractionMethod` combines both: e.g. "og_image" (source) + capture method
- When no garment image is found at all, send `extractionMethod: "none"` (never null/undefined)

### 2. ExtensionPanel (`src/components/panel/ExtensionPanel.tsx`)
- Default `garmentExtractionMethod` to `"unknown"` instead of `undefined`
- In the postMessage handler, coalesce: `event.data.extractionMethod || "unknown"`

### 3. VTOScreen (`src/components/panel/screens/VTOScreen.tsx`)
- Default `extractionMethod` prop to `"unknown"` via destructuring default
- Before calling `startPrediction`, validate that personPhoto and at least one garment source exist; if not, show a toast and block the call
- In error detail display, use `??` for all optional fields
- Add a dev-mode "Self-test" button that sends two tiny built-in sample base64 images to the edge function

### 4. useVirtualTryOn Hook (`src/hooks/useVirtualTryOn.ts`)
- Coalesce `category` to `"unknown"` in the request body
- Use `?? null` or `?? "unknown"` for all optional fields in the request body and console logs

### 5. Edge Function (`supabase/functions/virtual-tryon/index.ts`)
- Coalesce all optional fields from the request body:
  ```typescript
  const extractionMethod = body.extractionMethod ?? "unknown";
  const garmentType = body.garmentType ?? "unknown";
  const category = body.category ?? "unknown";
  ```
- Remove any string concatenation that could include a null (e.g., in log statements or error messages, use template literals with `?? "unknown"`)
- Wrap the Replicate API call in a dedicated try/catch that returns HTTP 502 with `{ ok: false, error, debugInfo }` on failure
- On image validation failure, return HTTP 400 with `{ ok: false, error, debugInfo: { extractionMethod, userSizeKB, garmentSizeKB } }`
- Add `ok: true` to success responses for consistency

## Technical Details

### Content script extraction method tracking

Update `extractGarmentImage()` to return `{ url, source }` where source is one of: `"og_image"`, `"product_image"`, `"json_ld"`, `"largest_img"`, or `null`. Then combine with the capture method in the postMessage:

```javascript
// Before:
extractionMethod: result.method  // could be "failed" or capture method only

// After:
extractionMethod: result.base64
  ? (garmentSource + "/" + result.method)  // e.g. "og_image/dom_canvas"
  : (garmentSource ? garmentSource + "/cors_blocked" : "none")
```

### Edge function Replicate try/catch

```typescript
let replicateResponse;
try {
  replicateResponse = await fetch(REPLICATE_API_URL, { ... });
} catch (err) {
  return new Response(JSON.stringify({
    ok: false,
    error: "Replicate request failed",
    debugInfo: { status: 0, message: (err as Error).message, extractionMethod }
  }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const data = await replicateResponse.json();
if (!replicateResponse.ok) {
  return new Response(JSON.stringify({
    ok: false,
    error: data?.detail ?? "Failed to start prediction",
    debugInfo: { status: replicateResponse.status, extractionMethod }
  }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

### Self-test button (dev mode only)

A small button rendered at the bottom of VTOScreen when `import.meta.env.DEV` is true. It sends two hardcoded 1x1 pixel PNG base64 strings to the edge function and toasts success/failure. This validates the Replicate token and request path without needing real images.

## Files Changed

| File | Change |
|------|--------|
| `extension/content.js` | Return extraction source from `extractGarmentImage()`, combine with capture method, never send null extractionMethod |
| `src/components/panel/ExtensionPanel.tsx` | Default `garmentExtractionMethod` to `"unknown"`, coalesce in handler |
| `src/components/panel/screens/VTOScreen.tsx` | Default prop, validate before calling backend, safe `??` everywhere, add self-test button |
| `src/hooks/useVirtualTryOn.ts` | Coalesce all optional fields in request body |
| `supabase/functions/virtual-tryon/index.ts` | Coalesce all body fields, wrap Replicate in try/catch with 502, return `ok` field and `debugInfo`, safe template literals |

