

# ALTAANA Essential V1 — Chrome Extension MVP

## Architecture Overview

This Lovable project serves as **both** the extension's panel UI (React app) **and** the entire backend (Lovable Cloud: database, auth, edge functions, secrets). A thin Chrome extension shell (~5 files managed via GitHub export) will inject your Lovable-hosted panel as an iframe on supported product pages.

**Design language:** Dark panel (#1a1a1a/near-black), cyan/teal accents, luxury serif logo, minimal typography. Matches your mockups exactly.

---

## Milestone 1 — Extension Panel UI Shell + Floating Widget

Build all panel screens as a single-page React app with internal state routing:

- **Floating widget:** A compact "FIND MY SIZE" pill with the ALTAANA logo, fixed to the right side of the viewport. Clicking it opens the panel.
- **Panel container:** A right-anchored slide-in panel (~340px wide, full height) with dark background, close (X) button, and ALTAANA Essential logo header.
- **State machine:** The panel cycles through states: `idle → auth → profile → analyzing → recommendation → confirmed`. Each state renders the matching screen from your mockups.
- **Close behavior:** X closes panel back to floating widget. State is preserved.

---

## Milestone 2 — Authentication + Session Persistence

- **Lovable Cloud auth** with Google sign-in and email/password options.
- **"Continue without saving"** option that creates an anonymous/guest session (profile won't persist across devices).
- **Session persistence:** Auth token stored in `chrome.storage.local` by the extension shell. On panel open, token is passed to the iframe, so returning users skip sign-in entirely.
- **Sign-in screen UI** matches your mockup: logo, headline "Save your size for future shopping", Google button (cyan), email button (outlined), "Continue without saving" link, privacy reassurance text.

---

## Milestone 3 — Sizing Profile Creation + Save

- **Brand selector:** Searchable dropdown of all 38 supported brands. User picks up to 2 anchor brands.
- **Size selector per brand:** Dropdown showing both numeric (00–20) and letter (XXXS–4X) sizes.
- **"+ Add another brand (recommended)"** button to add second anchor.
- **Fit preference:** Three toggle buttons — Fitted / True to size (default selected, cyan) / Relaxed.
- **Save to database:** Profile saved to Lovable Cloud backend. Profile is editable later.
- **UI matches your mockup** with "Takes about 60 seconds" cyan subtitle.

---

## Milestone 4 — Brand Data + Airtable Integration

- **Airtable sync via edge function:** A scheduled edge function fetches your Airtable base (using your Airtable API key stored as a Lovable secret) and caches all 38 brands' sizing data into the Lovable Cloud database. Runs nightly with manual trigger option.
- **Brand catalog table:** Normalized brand names mapped to keys, sizing charts (size → measurements/notes), fit tendency ("runs small", "runs large", "true to size"), and garment category notes.
- **PDP detection:** The Chrome extension content script reads the current page URL/domain to identify the brand. A mapping table connects domains (e.g., `aloyoga.com`, `revolve.com`) to brand keys. The detected brand + product category is sent to the backend.

---

## Milestone 5 — Size Recommendation Engine + Display

- **Rule-based recommendation logic (edge function):**
  1. Look up user's anchor brand sizes from their profile
  2. Look up the target brand's sizing chart from cached Airtable data
  3. Cross-reference sizes using measurement overlap or size-index mapping
  4. Apply fit tendency adjustments (e.g., "runs small" → size up)
  5. Apply user's fit preference modifier
  6. Return: recommended size, 3 explanation bullets, and cross-brand comparison data

- **"Analyzing fit…" screen:** Spinner with loading text while the API call runs. Matches your mockup.

- **Recommendation screen:**
  - "YOUR RECOMMENDED SIZE" label + size in bold (e.g., "Large")
  - "WHY THIS SIZE" section with 3 contextual bullets (e.g., "You wear Medium in Alo Yoga", "This CSB top runs smaller in the bust", "Similar shoppers size up in CSB tops")
  - Three action buttons: Size down / **Keep** (cyan, primary) / Size up
  - "Boost accuracy (optional)" expandable section
  - Disclaimer at bottom

---

## Milestone 6 — Size Confirmed + Post-Confirmation

- **Size confirmed screen:**
  - Checkmark + "Size confirmed" + "We'll remember this fit for similar items."
  - Teal card showing "YOUR SIZE FOR THIS ITEM" + size
  - **"Add to cart with my size"** CTA (cyan) — scrolls the product page to the size selector/dropdown
  - Collapsible "Why this recommendation" (3 bullets)
  - Collapsible "Compare across brands" showing anchor brands + target brand with size and fit tag badges (e.g., "true to size", "runs small", "snug fit")
  - Disclaimer footer

- **Feedback logging:** User's choice (size down/keep/size up) is saved to the database for future learning.
- **Memory:** After confirmation, closing returns to widget. Re-opening on the same product shows the confirmed state directly.

---

## Milestone 7 — Chrome Extension Shell + Integration Testing

- **Export project to GitHub** from Lovable settings.
- **Add extension shell files** (managed in GitHub):
  - `manifest.json` (Manifest V3, permissions for activeTab + storage)
  - `content.js` — detects supported brand domains, injects floating widget + iframe pointing to your published Lovable app URL
  - `background.js` — handles auth token relay between extension storage and iframe
  - Extension icons (from your logo asset)
- **Test end-to-end** on 2 pilot brands: **Alo Yoga** (`aloyoga.com`) and **CSB** (likely on `revolve.com`), then expand domain mappings to all 38 brands.

---

## Database Schema (Lovable Cloud)

- **users** — handled by Lovable Cloud auth
- **profiles** — user_id, anchor_brands (up to 2 with sizes), fit_preference, created/updated timestamps
- **brand_catalog** — brand_key, display_name, domains[], fit_tendency, garment_categories
- **sizing_charts** — brand_key, category, size_label, measurements (JSON), notes, synced_at
- **recommendations** — user_id, brand_key, product_url, recommended_size, explanation_bullets, created_at
- **user_adjustments** — recommendation_id, action (size_down/keep/size_up), final_size, created_at

---

## API Endpoints (Edge Functions)

- `auth/session` — validate/refresh session token
- `profile` — create, read, update sizing profile
- `brands` — list supported brands for dropdown
- `recommend` — accept brand_key + product context, return size recommendation
- `feedback` — log user's size adjustment choice
- `sync-airtable` — fetch + cache Airtable data (triggered manually or by schedule)

---

## Airtable Integration

- Store your Airtable API key as a **Lovable secret**
- Edge function fetches all records from your sizing table, normalizes brand names to keys, and upserts into the `sizing_charts` and `brand_catalog` tables
- **Nightly sync** is ideal; manual trigger available for immediate updates after you edit Airtable
- Brand name normalization: a mapping table handles variations (e.g., "7 For All Mankind" → `seven_for_all_mankind`)

---

## Landing Page (Outline Only — Separate Project Later)

- Separate Lovable project under same account
- Pages: Hero + value prop, How it works (3 steps), Supported brands grid, Privacy/disclaimer, Chrome Web Store install link
- Links to extension install page; shared auth system so sign-up on landing page carries over

---

## Build Order Summary

1. Panel UI shell with all screen states + dark luxury design
2. Lovable Cloud setup: auth (Google + email) + session handling
3. Profile creation flow + database save
4. Airtable sync edge function + brand catalog + sizing charts in DB
5. Recommendation engine edge function + display
6. Confirmation flow + feedback logging + "Add to cart" scroll behavior
7. GitHub export + Chrome extension shell + end-to-end testing on Alo Yoga & CSB

