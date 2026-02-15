

# Fix VTO: Server-Side Garment Image Fetching (Eliminate Manual Upload Requirement)

## Problem

The content script successfully finds the garment image URL (via og:image, JSON-LD, etc.), but the client-side base64 canvas capture fails due to browser CORS restrictions on cross-origin CDN images (e.g., Shopify CDN at cdn.shopify.com). When base64 is null, the VTO screen shows "No garment image detected" and the only option is manual upload -- bad UX.

## Solution

Pass the garment image **URL** to the edge function as a fallback. The edge function fetches the image server-side (no CORS), uploads it to Supabase Storage, and passes the public URL to Replicate. Manual upload remains as a last-resort fallback but is no longer the primary path when auto-capture fails.

## Changes

### 1. Content Script (`extension/content.js`)

Always send the garment image source URL in the postMessage, even when base64 capture fails. Currently it sends `sourceUrl` but the panel doesn't use it for VTO. No major changes needed here -- `sourceUrl` is already sent.

### 2. ExtensionPanel (`src/components/panel/ExtensionPanel.tsx`)

- Store the `sourceUrl` from the postMessage in state (alongside `garmentImageBase64`)
- Pass it to VTOScreen as a new `garmentImageSourceUrl` prop

### 3. VTOScreen (`src/components/panel/screens/VTOScreen.tsx`)

- Accept `garmentImageSourceUrl` prop
- When sending to the edge function: if base64 is available, send it as before; if only URL is available, send `garment_image_url` instead
- Show the garment image preview using the URL when base64 isn't available (for preview only -- the URL may work in an img tag even if canvas capture failed)
- Remove the prominent "No garment image detected" state when a URL is available

### 4. useVirtualTryOn Hook (`src/hooks/useVirtualTryOn.ts`)

- Update `startPrediction` to accept an optional `garmentImageUrl` parameter
- Send `garment_image_url` in the POST body when base64 isn't available

### 5. Edge Function (`supabase/functions/virtual-tryon/index.ts`)

- Accept `garment_image_url` as an alternative to `garment_image_base64`
- When URL is provided: fetch the image server-side, convert to binary, upload to Supabase Storage, get public URL
- The person image continues to use base64 (user uploads it directly, so no CORS issue)
- Add a new helper `fetchImageFromUrl(url)` that downloads the image and returns binary data

## Flow After Fix

```text
Content script:
  1. Extract garment URL (og:image, JSON-LD, etc.) -- almost always succeeds
  2. Attempt base64 capture via canvas -- may fail due to CORS
  3. Send postMessage with { garmentImageBase64, sourceUrl, extractionMethod }

Panel (VTOScreen):
  - Has base64? Send garment_image_base64 to edge function (existing path)
  - No base64 but has URL? Send garment_image_url to edge function (new path)
  - Neither? Show manual upload fallback (rare edge case)

Edge function:
  - garment_image_base64 provided? Decode + upload to storage (existing path)
  - garment_image_url provided? Fetch server-side + upload to storage (new path)
  - Pass public storage URL to Replicate as garm_img
```

## Technical Details

### Edge function: new URL fetch helper

```text
async function fetchAndUploadFromUrl(imageUrl, supabaseUrl, supabase):
  1. Fetch imageUrl with standard headers (User-Agent, Accept)
  2. Get response as ArrayBuffer
  3. Detect content type from response headers
  4. Generate UUID filename
  5. Upload to vto-temp bucket
  6. Return public URL
```

### VTOScreen garment preview improvement

When base64 capture failed but URL exists:
- Show the garment image using the URL directly in an `<img>` tag (browser img tags handle cross-origin fine, unlike canvas)
- The preview will work normally; the "No garment image detected" message only shows when there's truly no image at all

## Files Changed

| File | Change |
|------|--------|
| `src/components/panel/ExtensionPanel.tsx` | Store garment source URL from postMessage, pass to VTOScreen |
| `src/components/panel/screens/VTOScreen.tsx` | Accept URL prop, use it as fallback for both preview and generation |
| `src/hooks/useVirtualTryOn.ts` | Accept optional garment URL parameter, send in request body |
| `supabase/functions/virtual-tryon/index.ts` | Accept `garment_image_url`, fetch server-side, upload to storage |

No changes needed to `extension/content.js` -- it already sends `sourceUrl` in the postMessage.
