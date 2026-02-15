

# Virtual Try-On (VTO) MVP -- Architecture and Implementation Plan

## Overview

Add a "Try It On" feature to the ALTAANA extension panel that lets users upload a photo of themselves, automatically extracts the garment image from the current product page, and generates a realistic virtual try-on image using Replicate's AI model. The feature lives below the size recommendation as a new panel state, fully modular and separate from the sizing engine.

---

## 1. User Flow

```text
[Size Confirmed Screen]
        |
   "Try It On" button (replaces "Go to size selector")
        |
   [VTO Screen - Upload Phase]
        |--- Upload photo (or use cached photo)
        |--- Garment image auto-extracted (or manual URL fallback)
        |
   "Generate Try-On" CTA
        |
   [VTO Screen - Loading Phase]
        |--- Spinner + "Fitting you in..."
        |--- Polls backend every 3s for result
        |
   [VTO Screen - Result Phase]
        |--- Shows generated image
        |--- "Try Again" button (re-generates)
        |--- "Download Image" button (optional)
        |--- "Back to Sizing" link
```

---

## 2. New Panel State

Add `'vto'` to the `PanelState` type in `src/types/panel.ts`. The Confirmed Screen's primary CTA changes from "Go to size selector" to "Try It On", which sets `panelState` to `'vto'`.

---

## 3. Garment Image Extraction

**Where:** Inside `extension/content.js` (runs on the host PDP page).

**Strategy (ordered by reliability):**
1. `og:image` meta tag
2. `<meta property="product:image">` or `[itemprop="image"]`
3. JSON-LD `@type: Product` -> `image` field
4. Largest `<img>` inside the product gallery container (filter out icons under 200px)

**Delivery:** The content script extracts the garment image URL on page load and passes it to the iframe via a new URL parameter `&garment_image=...`. The panel reads it from `useTargetBrand()`.

**Fallback:** If no garment image is detected, the VTO screen shows a text input for the user to paste a garment image URL manually.

---

## 4. Backend: Replicate Edge Function

A new edge function `supabase/functions/virtual-tryon/index.ts` handles all Replicate communication. The Replicate API token is stored as a secret and never exposed to the frontend.

### API Design

**POST /virtual-tryon** -- Start a try-on prediction

Request body:
```json
{
  "person_image_base64": "<base64 string>",
  "garment_image_url": "https://cdn.example.com/product.jpg"
}
```

Response:
```json
{
  "prediction_id": "abc123",
  "status": "starting"
}
```

**GET /virtual-tryon?prediction_id=abc123** -- Poll for result

Response (in progress):
```json
{
  "status": "processing",
  "prediction_id": "abc123"
}
```

Response (complete):
```json
{
  "status": "succeeded",
  "prediction_id": "abc123",
  "output_image_url": "https://replicate.delivery/..."
}
```

Response (failed):
```json
{
  "status": "failed",
  "error": "Model inference failed"
}
```

### Replicate Model

Use `cuuupid/idm-vton` (IDM-VTON) -- a state-of-the-art image-based virtual try-on model available on Replicate. It accepts:
- `human_img`: person photo
- `garm_img`: garment image
- `category`: upper_body / lower_body / dresses

The edge function maps the ALTAANA category (tops, dresses, bottoms, etc.) to the model's category enum.

### Timeouts and Safety
- Replicate prediction timeout: 120 seconds max polling
- Individual poll interval: 3 seconds
- Max 40 polls before returning timeout error
- Edge function itself has a 25-second execution limit, so the function starts the prediction and returns the ID; polling happens from the frontend

---

## 5. Secret Setup

A new secret `REPLICATE_API_TOKEN` must be added to the project. You will be prompted to provide it before implementation begins.

---

## 6. Frontend Components

### New Files

| File | Purpose |
|------|---------|
| `src/components/panel/screens/VTOScreen.tsx` | Main VTO screen with upload, generate, and result phases |
| `src/hooks/useVirtualTryOn.ts` | Hook managing prediction lifecycle (start, poll, result) |

### VTOScreen.tsx -- Three Internal Phases

**Phase 1: Upload**
- Shows cached person photo thumbnail if available (stored in localStorage as base64)
- Upload button (file input, accept images only, max 5MB)
- Displays auto-detected garment image thumbnail (from URL param)
- Manual garment URL input as fallback
- "Generate Try-On" CTA (disabled until both images ready)

**Phase 2: Loading**
- Centered spinner animation
- "Fitting you in..." text
- Cancel button

**Phase 3: Result**
- Generated try-on image displayed at full panel width
- "Try Again" button (outline style, re-triggers generation)
- "Download Image" button (optional, uses anchor download)
- "Back to Sizing" link at bottom

### Styling
- All buttons follow the 48.5px height, 334px width pill system
- Dark luxury aesthetic, no box shadows
- Loading spinner uses the ALTAANA teal primary color
- Person photo stored as base64 in `localStorage` under `altaana_vto_photo` so users do not re-upload on every visit

---

## 7. ExtensionPanel.tsx Changes

- Import `VTOScreen`
- Add `'vto'` case to `renderScreen()` switch
- Pass garment image URL (from `useTargetBrand`) and recommendation data to VTOScreen
- No changes to any other screen or the panel shell structure

---

## 8. ConfirmedScreen.tsx Changes

- Replace "Go to size selector" button text with "Try It On"
- Replace the `onAddToCart` callback with a new `onTryItOn` callback that sets panel state to `'vto'`
- Keep the `ALTAANA_SCROLL_TO_SIZE` postMessage as a secondary text link below ("or go to size selector")

---

## 9. Error Handling

| Scenario | User-Facing Behavior |
|----------|---------------------|
| No garment image found | Show manual URL input field |
| Invalid user image (too small, wrong format) | Toast: "Please upload a clear, front-facing photo" |
| Replicate timeout (>120s) | "Generation took too long. Please try again." + Try Again button |
| Replicate failure | "Something went wrong. Please try again." + Try Again button |
| Rate limiting | "Too many requests. Please wait a moment." |
| Network error | "Connection lost. Check your internet and try again." |

No scenario causes a freeze or crash. All errors are caught and displayed inline on the VTO screen.

---

## 10. File Structure Summary

```text
src/
  types/panel.ts                          -- Add 'vto' to PanelState
  components/panel/
    ExtensionPanel.tsx                     -- Add VTO routing
    screens/
      ConfirmedScreen.tsx                  -- Change CTA to "Try It On"
      VTOScreen.tsx                        -- NEW: VTO screen component
  hooks/
    useVirtualTryOn.ts                     -- NEW: Replicate polling hook

extension/
  content.js                              -- Add garment image extraction + URL param

supabase/
  functions/virtual-tryon/index.ts        -- NEW: Replicate proxy edge function
  config.toml                             -- Add [functions.virtual-tryon] verify_jwt = false
```

---

## 11. Security Considerations

- Replicate API token stored as a backend secret, never in frontend code or extension
- Person photo sent as base64 directly to the edge function over HTTPS; never stored server-side
- Garment image URL is a public CDN URL from the retailer -- no sensitive data
- Edge function validates image size (max 5MB base64) and content type before forwarding
- No user PII is sent to Replicate -- only anonymized image data
- CORS headers follow existing edge function patterns

---

## 12. Implementation Sequence

1. **Secret setup** -- Add `REPLICATE_API_TOKEN` secret
2. **Edge function** -- Create `virtual-tryon/index.ts` with start + poll endpoints
3. **Types** -- Add `'vto'` to PanelState
4. **Hook** -- Create `useVirtualTryOn.ts`
5. **VTO Screen** -- Build `VTOScreen.tsx` with all three phases
6. **Confirmed Screen** -- Swap CTA to "Try It On"
7. **ExtensionPanel** -- Wire up VTO routing
8. **Content script** -- Add garment image extraction
9. **Testing** -- End-to-end test of the full flow

---

## 13. Build Complexity Estimate

| Component | Complexity | Estimated Effort |
|-----------|-----------|-----------------|
| Edge function (Replicate proxy) | Medium | Core backend work |
| useVirtualTryOn hook | Medium | Polling state machine |
| VTOScreen component | Medium | Three-phase UI |
| Garment image extraction | Low-Medium | DOM heuristics |
| ConfirmedScreen CTA change | Low | Text + callback swap |
| ExtensionPanel routing | Low | One switch case |
| Secret setup | Low | One-time config |

Overall: **Medium complexity MVP** -- self-contained, modular, no impact on existing sizing logic.

