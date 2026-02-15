
# Fix Virtual Try-On (VTO) -- Three Root Causes

## Problems Identified

From the screenshot and edge function logs, three issues are preventing VTO from working:

### Issue 1: Replicate cannot fetch retailer garment images
The error `"cannot identify image file '/tmp/tmpj26m1uxrLOVF-WD4350'"` means Replicate's servers tried to download the garment image URL (e.g., from loversandfriends.us) but got blocked by CDN anti-hotlinking, redirects, or Cloudflare protection. Replicate received HTML/garbage instead of an image.

**Fix:** The edge function must download the garment image server-side and convert it to a base64 data URI before passing it to Replicate. This way both images go to Replicate as base64, bypassing any CDN restrictions.

### Issue 2: Garment image not rendering in the panel
The `<img>` tag in VTOScreen shows broken alt text "Product garment". This is likely the same root cause -- the garment URL from the retailer CDN blocks cross-origin requests from the extension iframe.

**Fix:** This is cosmetic and lower priority since the image will work once VTO generates. But we can add an `onError` fallback that shows "Image detected but preview unavailable" instead of a broken image icon.

### Issue 3: Replicate model version may be invalid
The logs show `"The specified version does not exist"`. While the version hash `0513734a...` appears on the Replicate docs, the API now supports using `model` field with `owner/name` format instead of `version` field, which is more resilient to version deprecation.

**Fix:** Switch from `version`-based API to `model`-based API format: `"model": "cuuupid/idm-vton"` instead of `"version": "0513734a..."`.

---

## Changes

### 1. Edge function: `supabase/functions/virtual-tryon/index.ts`

- **Proxy the garment image**: On POST, fetch the garment_image_url server-side, convert to base64, and send both images as data URIs to Replicate
- **Switch to model-based API**: Use `"model": "cuuupid/idm-vton"` instead of `"version": "0513..."` for more stable model resolution
- **Add User-Agent header** when fetching the garment image to avoid bot-detection blocks
- **Add error handling** if the garment image fetch fails (return a clear error: "Could not load garment image")
- **Add size limit** for the garment image (5MB max)

### 2. Frontend: `src/components/panel/screens/VTOScreen.tsx`

- Add `onError` handler to the garment `<img>` tag that shows a fallback message ("Image detected -- preview unavailable") instead of a broken icon
- This handles cases where retailer CDNs block cross-origin image loading in the iframe

### 3. Frontend: `src/hooks/useVirtualTryOn.ts`

- No changes needed -- the polling logic is correct

### 4. Extension: `extension/content.js`

- No changes needed -- the garment extraction logic is working (it found the URL)

---

## Technical Details

### Garment image proxy flow (edge function)

```text
Client POST:
  person_image_base64: "data:image/jpeg;base64,..."
  garment_image_url: "https://cdn.loversandfriends.us/product.jpg"

Edge function:
  1. Fetch garment_image_url with User-Agent header
  2. Read response as ArrayBuffer
  3. Convert to base64 data URI
  4. Send both as data URIs to Replicate:
     human_img: "data:image/jpeg;base64,..."  (from client)
     garm_img: "data:image/jpeg;base64,..."   (proxied)

Replicate:
  - Receives both images as base64 -- no external fetching needed
  - No CDN blocking possible
```

### Model API change

Before:
```json
{ "version": "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985", "input": { ... } }
```

After:
```json
{ "model": "cuuupid/idm-vton", "input": { ... } }
```

This uses Replicate's newer model-based prediction API which automatically resolves to the latest version.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/virtual-tryon/index.ts` | Proxy garment image as base64, switch to model-based API |
| `src/components/panel/screens/VTOScreen.tsx` | Add onError fallback for garment image preview |

No UI layout changes. No changes to sizing logic.
