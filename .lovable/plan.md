

# Robust Garment Image Extraction Pipeline

## Problem
The content script's `extractGarmentImage()` and `captureImageAsBase64()` are too simplistic -- they miss common PDP gallery patterns, don't parse `srcset`, don't normalize URLs, and don't convert AVIF/WEBP formats. When extraction fails, there's no debug visibility.

## Changes

### 1. Content Script (`extension/content.js`) -- Major Overhaul

**A) Enhanced `extractGarmentImage()` with priority order:**

1. Gallery-scoped DOM images first: search inside `[data-testid*="gallery"]`, `.product-gallery`, `.carousel`, `.pdp-gallery`, `.product-images`, `[class*="product-image"]` for the largest `<img>` with width > 250 and height > 250
2. Largest visible `<img>` in viewport: filter out icons/logos (skip imgs inside `nav`, `header`, `footer`, `[class*="logo"]`, `[class*="icon"]`); require naturalWidth > 250 and naturalHeight > 250
3. `og:image` meta tag
4. `twitter:image` meta tag
5. JSON-LD Product image (existing)

**For the chosen img, resolve URL via:**
- `img.currentSrc` (handles responsive loading)
- Then `img.src`
- Then parse `srcset` for largest candidate (new helper `parseSrcsetLargest()`)

**URL normalization:**
- Protocol-relative `//` to `https://`
- Relative paths resolved against `location.origin`

**Returns `{ url, source }` where source is `"gallery_img"`, `"largest_img"`, `"og_image"`, `"twitter_image"`, `"json_ld"`, or `"none"`**

**B) Enhanced `captureImageAsBase64()` with format handling:**

1. DOM canvas capture (existing) -- but output as JPEG at 0.92 quality instead of PNG for smaller size
2. CORS fetch as blob -- check `blob.type`; if `image/avif` or `image/webp`, convert via canvas to JPEG before encoding
3. If security error on canvas, return `{ base64: null, method: "canvas_security_error" }`

**New helpers:**
- `parseSrcsetLargest(srcset)` -- parse srcset attribute, return URL of largest width descriptor
- `normalizeImageUrl(url)` -- protocol-relative and relative URL resolution
- Format detection already handled by canvas `toDataURL("image/jpeg", 0.92)`

### 2. VTOScreen (`src/components/panel/screens/VTOScreen.tsx`)

**Collapsed debug panel (no UI redesign):**
- Below the existing privacy notice, add a collapsible section showing:
  - `extractionMethod`
  - `garmentSourceUrl` (detected URL)
  - Garment image size in KB (if base64 available)
  - Person photo size in KB
- Use existing Collapsible component from `@radix-ui/react-collapsible`
- Only visible in dev mode (`import.meta.env.DEV`)

**"Test extraction" button (dev mode only):**
- Next to existing "Self-test backend" button
- Sends a postMessage to parent requesting extraction re-run
- Displays detected URL + preview + method in a toast or inline

**Payload validation (already partially done, strengthen):**
- Before calling `startPrediction`, verify `personPhoto` starts with `data:image/`
- If garment base64 exists, verify it starts with `data:image/`
- Block and toast if validation fails

### 3. ExtensionPanel (`src/components/panel/ExtensionPanel.tsx`)

- No changes needed -- already stores `garmentSourceUrl` and `garmentExtractionMethod` from postMessage and passes them to VTOScreen.

### 4. Edge Function (`supabase/functions/virtual-tryon/index.ts`)

- No changes needed -- already has defensive coalescing, validation, and try/catch wrapping from the previous implementation.

### 5. useVirtualTryOn Hook (`src/hooks/useVirtualTryOn.ts`)

- No changes needed -- already coalesces all optional fields.

## Files Changed

| File | Change |
|------|--------|
| `extension/content.js` | Overhaul `extractGarmentImage()` with gallery selectors, size thresholds, srcset parsing, URL normalization. Enhance `captureImageAsBase64()` with JPEG output and AVIF/WEBP conversion. Add `parseSrcsetLargest()` and `normalizeImageUrl()` helpers. |
| `src/components/panel/screens/VTOScreen.tsx` | Add dev-mode collapsed debug panel showing extraction details. Add "Test extraction" button. Strengthen payload validation. |

## Technical Details

### srcset parsing helper

```text
function parseSrcsetLargest(srcset):
  Split by comma, trim each entry
  For each entry: split by space, get URL and descriptor
  Parse descriptors ending in "w" as width values
  Return URL with largest width, or first URL if no width descriptors
```

### Gallery selector priority list

```text
const GALLERY_SELECTORS = [
  '[data-testid*="gallery"]',
  '.product-gallery',
  '.pdp-gallery',
  '.product-images',
  '[class*="product-image"]',
  '[class*="pdp-image"]',
  '.carousel',
  '[class*="carousel"]',
  '[class*="slider"]',
  '[class*="swiper"]',
];
```

### Icon/logo exclusion for largest-img fallback

```text
Skip images inside: nav, header, footer, [class*="logo"], [class*="icon"],
  [class*="badge"], [class*="banner"], [class*="promo"], [class*="recommend"],
  [class*="similar"], [class*="also-like"]
```

### Debug panel fields

```text
- Extraction method: "og_image/dom_canvas"
- Source URL: https://cdn.shopify.com/...
- Garment size: 342 KB
- Person photo: 128 KB
- Fetch status: ok | cors_blocked | canvas_security_error | skipped
```

