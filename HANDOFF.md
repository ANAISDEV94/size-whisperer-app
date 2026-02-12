# ALTAANA Essential V1 — Technical Handoff Document

*Last updated: February 12, 2026*

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [File Structure](#3-file-structure)
4. [Data Flow](#4-data-flow)
5. [Airtable Schema](#5-airtable-schema)
6. [Recommendation Algorithm](#6-recommendation-algorithm)
7. [What's Done vs What's Future](#7-whats-done-vs-whats-future)
8. [Lovable vs Claude Code](#8-lovable-vs-claude-code)
9. [How to Test & Debugging](#9-how-to-test--debugging)
10. [Glossary](#10-glossary)

---

## 1. System Overview

ALTAANA is a **Chrome Extension** that appears on product pages of supported fashion brand websites and tells the user what size to buy. It has two separate pieces:

### Piece 1: The Chrome Extension (the "shell")
A lightweight Chrome extension that lives in the `extension/` folder. It does three things:
- **Detects** which brand website you're on (e.g., Revolve, Alo Yoga, Reformation)
- **Detects** what type of garment you're looking at (dress, top, jeans, etc.)
- **Injects** a small floating "Find My Size" button and an invisible iframe onto the page

The extension itself has no UI of its own — it just creates a window (iframe) for the web app to appear in.

### Piece 2: The Web App (the "panel")
A React web app hosted at `https://size-whisperer-app.lovable.app`. This is the actual UI the user sees — the dark floating panel with the ALTAANA logo, sign-in screen, sizing profile form, and recommendation output. It's built with React, TypeScript, and Tailwind CSS.

The web app also has a backend powered by Lovable Cloud (Supabase under the hood) that stores user profiles, brand sizing data, and recommendation history. Two backend functions handle:
- **`recommend-size`**: The recommendation engine that calculates your size
- **`sync-airtable`**: Pulls sizing chart data from your Airtable into the database

### How they work together
When you visit `aloyoga.com/products/some-dress`, the extension says: "This is Alo Yoga, it's a dress." It then loads `https://size-whisperer-app.lovable.app/?brand=alo_yoga&category=dresses&url=...&source=extension` inside an iframe. The web app reads those URL parameters and knows what brand and garment to recommend for.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  USER'S BROWSER (on a brand website like aloyoga.com)           │
│                                                                 │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐  │
│  │  Chrome Extension Shell  │  │  Brand Website (host page)  │  │
│  │  ┌────────────────────┐  │  │                             │  │
│  │  │  content.js         │  │  │  Product images, prices,   │  │
│  │  │  - Detect brand     │  │  │  size selectors, etc.      │  │
│  │  │  - Detect category  │  │  │                             │  │
│  │  │  - Inject iframe    │──┼──│                             │  │
│  │  │  - Inject widget    │  │  │                             │  │
│  │  └────────────────────┘  │  │                             │  │
│  │  ┌────────────────────┐  │  └─────────────────────────────┘  │
│  │  │  background.js     │  │                                   │
│  │  │  - Store auth token│  │                                   │
│  │  └────────────────────┘  │                                   │
│  └──────────────────────────┘                                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  IFRAME (loads the hosted web app)                        │   │
│  │  https://size-whisperer-app.lovable.app/?brand=...        │   │
│  │                                                           │   │
│  │  ┌─ ALTAANA Panel UI ──────────────────────────────────┐  │   │
│  │  │  Auth Screen → Profile Screen → Analyzing →         │  │   │
│  │  │  Recommendation → Confirmed                         │  │   │
│  │  └────────────────────────────────────────────────────-─┘  │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │ API calls                                    │
└───────────────────┼─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  LOVABLE CLOUD (Backend)                                        │
│                                                                 │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Database Tables     │  │  Backend Functions               │  │
│  │  - brand_catalog     │  │  - recommend-size (AI + math)    │  │
│  │  - sizing_charts     │  │  - sync-airtable (data import)   │  │
│  │  - profiles          │  │                                  │  │
│  │  - recommendations   │  │  External:                       │  │
│  │  - user_adjustments  │  │  - Lovable AI Gateway            │  │
│  └─────────────────────┘  │  - Airtable API                  │  │
│                           └──────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────┐                                        │
│  │  Authentication      │                                       │
│  │  - Google OAuth      │                                       │
│  │  - Email/Password    │                                       │
│  │  - Guest mode        │                                       │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AIRTABLE (External Data Source)                                │
│  Contains sizing chart spreadsheets with brand measurements     │
│  Synced to database via sync-airtable function                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

### `extension/` — Chrome Extension Shell
| File | What it does |
|------|-------------|
| `manifest.json` | Chrome extension config: declares which websites to run on, permissions, icons |
| `content.js` | Runs on every supported brand page. Detects the brand, infers garment category, injects the floating widget button and iframe |
| `background.js` | Background worker that stores/retrieves auth tokens so the user stays logged in across page navigations |
| `icon48.png`, `icon128.png` | Extension icons shown in Chrome toolbar |
| `README.md` | Developer notes on how the extension works |

### `src/` — React Web App (the panel UI)

| Folder/File | What it does |
|-------------|-------------|
| `App.tsx` | App entry point, sets up routing |
| `pages/Index.tsx` | Main page — detects if running inside extension iframe or standalone, renders the panel accordingly |
| `components/panel/ExtensionPanel.tsx` | **Core state machine** — manages the entire user flow: auth → profile → analyzing → recommendation → confirmed |
| `components/panel/FloatingWidget.tsx` | The small "Find My Size" pill button (180×41px) that appears on the right side of the page. Suppressed in extension mode. |
| `components/panel/PanelHeader.tsx` | Logo + close button at the top of the panel |
| `components/panel/screens/AuthScreen.tsx` | Sign-in screen (Google, Email, or Guest) |
| `components/panel/screens/ProfileScreen.tsx` | Where users select their anchor brands and sizes, plus fit preference |
| `components/panel/screens/AnalyzingScreen.tsx` | Loading spinner shown while recommendation is being calculated |
| `components/panel/screens/RecommendationScreen.tsx` | Shows the recommended size with explanation bullets and Size Down/Keep/Size Up buttons |
| `components/panel/screens/ConfirmedScreen.tsx` | Post-confirmation screen with "Go to size selector" CTA and expandable comparisons |
| `hooks/useAuth.ts` | Authentication logic (sign up, sign in, Google OAuth, sign out) |
| `hooks/useRecommendation.ts` | Calls the `recommend-size` backend function and manages the response |
| `hooks/useConfirmationMemory.ts` | Remembers confirmed sizes in localStorage so returning users see their previous choice |
| `types/panel.ts` | TypeScript types: brand list, size arrays, recommendation shape |
| `index.css` | Global styles, design tokens (colors, fonts), embedded mode transparency |
| `integrations/supabase/client.ts` | Database client (auto-generated, do not edit) |
| `integrations/supabase/types.ts` | Database type definitions (auto-generated, do not edit) |
| `assets/` | Logo images and UI mockup screenshots |

### `supabase/functions/` — Backend Functions

| Function | What it does |
|----------|-------------|
| `recommend-size/index.ts` | **The recommendation engine.** Receives user profile + target brand, queries the database for sizing charts, calculates the best size using measurement math, calls AI to generate explanation bullets and scrape product fit info, and returns the recommendation. ~800 lines. |
| `sync-airtable/index.ts` | **Data importer.** Fetches all records from your Airtable base, normalizes measurement strings (e.g., "34-35" → `{min: 34, max: 35}`), and upserts them into the `sizing_charts` database table. ~400 lines. |

### `supabase/config.toml` — Backend Configuration
Declares both functions and sets `verify_jwt = false` (meaning they can be called without authentication — this is intentional because guest users also get recommendations).

---

## 4. Data Flow

### What the Extension Sends TO the Web App (via URL parameters)

| Parameter | Example | Description |
|-----------|---------|-------------|
| `brand` | `alo_yoga` | The brand key detected from the website domain |
| `category` | `dresses` | Garment category inferred from URL keywords |
| `url` | `https://aloyoga.com/products/...` | Full URL of the product page (used for AI scraping and logging) |
| `source` | `extension` | Tells the web app it's running inside the extension iframe |

### What the Web App Sends BACK to the Extension (via postMessage)

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `ALTAANA_PANEL_RESIZE` with `mode: "panel"` | Web App → Extension | "Make the iframe full-height so I can show the panel" |
| `ALTAANA_PANEL_RESIZE` with `mode: "widget"` | Web App → Extension | "Shrink the iframe back down, user closed the panel" |
| `ALTAANA_SCROLL_TO_SIZE` | Web App → Extension | "User confirmed their size — scroll the host page to the size selector" |

### What the Web App Sends to the Backend (API calls)

| Call | When | Payload |
|------|------|---------|
| `recommend-size` function | User saves their profile | `{ anchor_brands: [{brandKey, displayName, size}], fit_preference, target_brand_key, target_category, user_id?, product_url?, weight?, height? }` |
| `profiles` table (upsert) | User saves profile (if authenticated) | `{ anchor_brands, fit_preference }` |
| `user_adjustments` table (insert) | User clicks Size Down/Keep/Size Up | `{ recommendation_id, action, final_size }` |

### What the Backend Returns

The `recommend-size` function returns:
```json
{
  "size": "M",
  "brandName": "Alo Yoga",
  "sizeScale": "letter",
  "bullets": [
    "You wear S in Reformation",
    "Alo Yoga runs slightly large with stretchy fabric",
    "Adjusted for your fitted fit preference"
  ],
  "comparisons": [
    { "brandName": "Reformation", "size": "S", "fitTag": "runs small" },
    { "brandName": "Alo Yoga", "size": "M", "fitTag": "true to size" }
  ],
  "recommendation_id": "uuid-here"
}
```

---

## 5. Airtable Schema

### Required Fields

| Field Name | Type | Example | Notes |
|-----------|------|---------|-------|
| `Brand` | Text | `Alo Yoga` | Brand display name. Also accepts `Brand Name`. The sync function maps names to internal keys (e.g., `ALO` → `alo_yoga`) |
| `Size` | Text | `S`, `6`, `28` | The size label. Also accepts `Size Label` |

### Optional Fields (Measurements)

All measurement values are in **inches** by default. The system auto-detects `cm` if "(cm)" appears in the column name.

| Field Name(s) | Maps To | Example Values | Notes |
|---------------|---------|----------------|-------|
| `Bust (inches)`, `Chest` | `bust` | `34`, `34-35`, `34/35` | Ranges and slash-separated values are both supported |
| `Waist (inches)` | `waist` | `28`, `27-29` | |
| `Hips (inches)`, `Hip`, `Low Hip` | `hips` | `38`, `37-39` | |
| `Shoulder(s)` | `shoulders` | `15.5` | |
| `Sleeve Length`, `Sleeve`, `Arm` | `sleeve_length` | `32` | |
| `Underbust` | `underbust` | `30-31` | Important for bras, bodysuits, swimwear |
| `Thigh` | `thigh` | `22` | Important for denim/jeans |
| `Rise` | `rise` | `10.5` | Important for denim/jeans |
| `Inseam` | `inseam` | `30` | |
| `Length`, `Pants/Denim Length` | `length` | `40` | |
| `Neck` | `neck` | `14` | |
| `Torso` | `torso` | `28` | |
| `Bra Size(s)` | `bra_size` | `34B` | |
| `Notes` | `_notes` (metadata) | `Runs small` | Stored as `fit_notes`, not used in measurement math |

### Other Optional Fields

| Field Name | Maps To | Notes |
|-----------|---------|-------|
| `Category`, `Garment Category` | `category` | e.g., `tops`, `dresses`, `denim`. Defaults to `tops` if missing |

### Value Format Rules

- **Single number**: `34` → stored as `{value: 34}`
- **Range (dash)**: `34-35` → stored as `{min: 34, max: 35}`
- **Options (slash)**: `34/35` → stored as `{options: [34, 35]}`
- **Units**: Stripped from column names. "(inches)" and "(cm)" are detected and removed
- **Brackets**: Content in parentheses like "(inches)" is removed from column names during normalization

### Brand Name Aliases

The sync function recognizes these alternate names:
- `ALO`, `Alo`, `alo` → `alo_yoga`
- `DOLCE & GABBANA`, `D&G` → `dolce_and_gabbana`
- `NIKE X SKIMS`, `Nike x Skims` → `nikeskims`
- `skims`, `SKIMS` → `skims`
- `lululemon`, `LULULEMON` → `lululemon`

Any unrecognized brand name is auto-slugified: `"My Brand Name"` → `my_brand_name`

---

## 6. Recommendation Algorithm

### Step-by-Step

Here's exactly what happens when a user clicks "Save my profile":

#### Step 1: Receive Input
The function receives:
- **Anchor brands**: 1-2 brands the user already knows their size in (e.g., "I wear S in Reformation")
- **Fit preference**: `fitted`, `true_to_size`, or `relaxed`
- **Target brand**: The brand they're shopping (detected from the website)
- **Category**: The garment type (detected from the URL)
- **Optional**: Product URL, weight, height

#### Step 2: Fetch Data from Database
- Look up the **target brand** in `brand_catalog` to get its fit tendency (e.g., "runs small"), size scale (letter/numeric), and available sizes
- Look up **sizing chart measurements** for the target brand in the detected category
- Look up **sizing chart measurements** for the user's anchor brand(s) in the same category

#### Step 3: Find the User's Body Measurements
- Find the anchor brand's sizing chart row that matches the user's stated size
- Extract the measurements from that row (bust, waist, hips, etc.)
- If the user provided weight/height, AI estimates body measurements and fills in any gaps

#### Step 4: Match to Target Brand (Deterministic Math)
For each size the target brand offers:
1. Compare measurements using **category-specific priorities**:
   - Tops: bust, waist, shoulders, sleeve length
   - Dresses: bust, waist, hips, shoulders
   - Denim/Jeans: waist, hips, thigh, rise
   - Swimwear: bust, waist, hips, underbust
   - Sports bras/Bodysuits: bust, underbust
2. Calculate the average absolute difference between the user's measurements and each target size
3. Pick the size with the **smallest difference** (closest match)

#### Step 5: Apply Fit Preference
- If **fitted**: shift one size down
- If **true to size**: keep as-is
- If **relaxed**: shift one size up

#### Step 6: Handle Scale Conversions
The system handles multiple sizing scales:
- **US Numeric**: 00, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
- **US Letter**: XXXS, XXS, XS, S, M, L, XL, 2X, 3X, 4X
- **EU/IT**: 34, 36, 38, 40, 42, 44, 46, 48
- **UK**: 4, 6, 8, 10, 12, 14, 16, 18, 20
- **Denim waist**: 22-35
- **Brand-specific** (Zimmermann: 0-5, And/Or Collective: 1-3, etc.)

All sizes are mapped to a **universal index** for cross-scale comparison.

#### Step 7: Snap to Available Sizes
The final size is "snapped" to the closest size the brand actually sells (from their `available_sizes` list in the database).

#### Step 8: Generate Explanation (AI)
Lovable AI generates exactly 3 bullet points explaining the recommendation. It also scrapes the product page URL (if provided) for fabric composition and fit details to make the explanation more specific.

#### Step 9: Generate Comparisons
Shows how the recommended size compares to the user's anchor brands (e.g., "If you wear S in Reformation, that's M in Alo Yoga — Alo Yoga runs large").

### Fallback Logic
If no sizing chart data exists for either brand, the system falls back to a **universal index mapping** — it converts the anchor size to a normalized position and finds the closest size in the target brand's available sizes. This is less accurate but always produces a result.

### Example

**Input:**
- User wears **S in Reformation**, fit preference **fitted**
- Shopping on **Alo Yoga** for a **dress**

**Processing:**
1. Look up Reformation size S measurements: bust 34-35", waist 26-27", hips 36-37"
2. Compare to each Alo Yoga dress size's measurements
3. Closest match might be M (bust 35-36", waist 27-28", hips 37-38")
4. Fit preference is "fitted" → shift down one → S
5. S is in Alo Yoga's available sizes → keep it
6. AI generates: "You wear S in Reformation" / "Alo Yoga runs slightly large with stretchy fabric" / "Sized down for your fitted preference"

**Output:**
```json
{
  "size": "S",
  "brandName": "Alo Yoga",
  "sizeScale": "letter",
  "bullets": ["You wear S in Reformation", "Alo Yoga runs slightly large with stretchy fabric", "Sized down for your fitted preference"],
  "comparisons": [
    {"brandName": "Reformation", "size": "S", "fitTag": "true to size"},
    {"brandName": "Alo Yoga", "size": "S", "fitTag": "true to size"}
  ]
}
```

---

## 7. What's Done vs What's Future

### ✅ Done (Implemented Today)

| Feature | Details |
|---------|---------|
| Chrome extension shell | Brand detection for 35+ brands, category inference, iframe injection, widget button |
| Floating panel UI | 404×733px dark card with rounded corners, cyan accent, ALTAANA branding |
| Authentication | Google OAuth, Email/Password sign-up with email verification, Guest mode |
| Sizing profile creation | Select 1-2 anchor brands from supported list, choose size from brand's actual size list, pick fit preference |
| Recommendation engine | Deterministic measurement matching + AI-powered explanation bullets |
| Product page scraping | Extracts fabric composition and fit details from the product URL |
| Body measurement estimation | AI estimates bust/waist/hips from weight+height (optional "Boost Accuracy" feature) |
| Multi-scale size handling | US numeric, US letter, EU/IT, UK, denim waist, brand-specific (Zimmermann, etc.) |
| Cross-brand comparisons | Shows how the recommended size maps to anchor brand sizes |
| Size adjustment | User can confirm, size up, or size down after seeing recommendation |
| Adjustment logging | Records user's final choice in `user_adjustments` table |
| Airtable sync | Imports and normalizes sizing data from Airtable with field name mapping |
| Confirmation memory | Remembers confirmed sizes in localStorage per brand+product |
| Scroll to size selector | After confirming, scrolls the host page to the size picker with site-specific selectors |
| Embedded mode transparency | Panel floats with transparent background in iframe |
| Dynamic iframe resizing | Iframe expands/collapses via postMessage bridge |
| Revolve multi-brand detection | Detects specific brands within Revolve (CSB, Helsa, etc.) via URL paths and DOM scraping |

### 🔲 Not Yet Implemented (Future)

| Feature | Notes |
|---------|-------|
| Auth token relay to extension | `background.js` has token storage code but it's not wired to the panel's auth flow |
| Profile persistence for returning users | Profile is saved to DB but not loaded back on return visits |
| Chrome Web Store publishing | Extension is local-only; no CWS listing |
| Analytics dashboard | `recommendations` and `user_adjustments` data is collected but there's no UI to view it |
| Size recommendation accuracy tracking | Adjustment data exists but no feedback loop to improve the algorithm |
| Onboarding or first-run experience | No tutorial or explanation of what ALTAANA does |
| Multi-category per brand | Currently one category per page visit; no browsing between categories |
| Non-women's sizing | Only women's sizing is supported |
| Mobile / responsive design | Panel is fixed 404px width; no mobile adaptation |
| Error recovery UI | Minimal — only a "Try again" link on recommendation failure |
| Rate limiting / abuse prevention | Backend functions have no rate limiting |
| Automated Airtable sync schedule | `sync-airtable` must be triggered manually (no cron) |
| Admin panel for managing brand data | No UI to add/edit brands without direct DB access |

---

## 8. Lovable vs Claude Code

### What Must Be Built in Lovable

| Task | Why |
|------|-----|
| All React UI changes (screens, styling, layout) | Lovable hosts and builds the React app |
| Backend function changes (`recommend-size`, `sync-airtable`) | These are Lovable Cloud edge functions, deployed automatically |
| Database schema changes (new tables, columns, RLS policies) | Managed through Lovable's migration tool |
| Authentication configuration | Configured through Lovable Cloud |
| Adding new secrets (API keys, etc.) | Managed through Lovable's secrets system |
| Design system / CSS changes | `index.css` and Tailwind config live in the Lovable project |

### What Must Be Built Outside Lovable (e.g., Claude Code, manual editing)

| Task | Why |
|------|-----|
| Chrome extension `content.js` changes | While the file lives in the repo, testing requires loading the extension in Chrome manually |
| Chrome extension `background.js` changes | Same as above |
| Chrome extension `manifest.json` changes | Same as above |
| Chrome Web Store submission | Requires a Google Developer account and manual packaging |
| Airtable base setup and data entry | Airtable is a separate product |
| Domain-specific size selector CSS selectors | Requires inspecting each brand's website manually |

### What Can Be Built in Either

| Task | Notes |
|------|-------|
| Adding new brands to `DOMAIN_TO_BRAND` | Can edit `content.js` in Lovable, but testing requires Chrome |
| Adding new brands to `SUPPORTED_BRANDS` | Edit `src/types/panel.ts` in Lovable |
| Updating the recommendation algorithm | Edit the edge function in Lovable |

---

## 9. How to Test & Debugging

### Testing Checklist

#### Extension Testing
1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder from the repo
4. Navigate to a supported brand's product page (e.g., `aloyoga.com/products/...`)
5. Verify the "Find My Size" widget pill appears at bottom-right
6. Click it → panel should slide open from the right
7. Test auth flow: Google sign-in, email sign-up, guest mode
8. Test profile creation: select a brand, pick a size, choose fit preference
9. Verify recommendation appears with 3 bullets and correct brand name
10. Test Size Down / Keep / Size Up buttons
11. Test "Go to size selector" scrolling on the confirmed screen
12. Test closing the panel (X button) and reopening

#### Standalone Testing (without extension)
1. Visit `https://size-whisperer-app.lovable.app/` directly
2. The demo product page should show with the floating widget
3. All panel flows work identically to the extension

#### Embedded Mode Testing
1. Visit `https://size-whisperer-app.lovable.app/?source=extension&brand=alo_yoga&category=dresses`
2. Should show the panel immediately (no widget, no animation)
3. Background should be transparent (not black)
4. Panel should have rounded corners and cyan border

### Where to Look When Something Breaks

| Symptom | Where to look |
|---------|---------------|
| Widget doesn't appear on a brand site | `extension/content.js` — check `DOMAIN_TO_BRAND` mapping, check `isProductPage()` logic |
| Panel opens but is a black rectangle | `src/index.css` — check embedded mode background rules |
| "Something went wrong" on recommendation | Check the `recommend-size` edge function logs in Lovable Cloud |
| No sizes appear in the brand dropdown | Check `brand_catalog` table — does the brand have `available_sizes` populated? |
| Recommendation seems wrong | Check `sizing_charts` table — does the brand have measurement data for the correct category? |
| Airtable sync fails | Check secrets: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_NAME` must be set |
| Auth doesn't work | Check if Google OAuth is configured in Lovable Cloud settings |
| Panel doesn't close when X is clicked | Check postMessage flow: `ALTAANA_PANEL_RESIZE` with `mode: "widget"` |
| Panel doesn't open when widget is clicked | Check postMessage flow: `ALTAANA_PANEL_RESIZE` with `mode: "panel"` |
| Console says "No supported brand detected" | The hostname isn't in `DOMAIN_TO_BRAND` in `content.js` |
| Console says "Not a product page" | The URL doesn't match the `isProductPage()` heuristics in `content.js` |
| AI bullets are generic/fallback | Check if `LOVABLE_API_KEY` secret exists; check AI gateway response in function logs |

### Key Console Log Prefixes
- `[Altaana]` — from the Chrome extension `content.js`
- `[Altaana][panel]` — from the React web app (embedded mode detection)

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **PDP** | Product Detail Page — the page on a brand's website that shows a single product with images, sizes, "Add to Cart", etc. |
| **Content Script** | A JavaScript file that Chrome extensions inject into web pages. In our case, `content.js` runs on every supported brand site. |
| **Background Script (Service Worker)** | A script that runs in the background of the Chrome extension, independent of any web page. Handles tasks like storing auth tokens. |
| **iframe** | An "inline frame" — a window-within-a-window on a web page. The extension creates an iframe that loads the ALTAANA web app inside it. |
| **postMessage** | A browser API that lets two windows (like a page and an iframe) send messages to each other. Used for resize signals and scroll commands. |
| **Embedded Mode** | When the web app detects it's running inside the extension's iframe (via `source=extension` URL parameter). In this mode, it skips the floating widget and renders the panel directly with a transparent background. |
| **Anchor Brand** | A brand the user already knows their size in. They select 1-2 anchor brands in their profile. The system uses this known size to calculate sizes in other brands. |
| **Fit Preference** | How the user likes their clothes to fit: `fitted` (tighter), `true_to_size` (standard), or `relaxed` (looser). Shifts the recommendation by ±1 size. |
| **Size Scale** | The sizing system a brand uses: `letter` (S/M/L), `numeric` (0/2/4/6), `mixed` (both), or brand-specific. |
| **Universal Index** | An internal numbering system (0-11) that maps any size from any scale to a common position, enabling cross-brand comparison. |
| **Sizing Chart** | A table of measurements (bust, waist, hips, etc.) for each size a brand offers in a specific garment category. Stored in the `sizing_charts` database table. |
| **Brand Catalog** | The `brand_catalog` database table listing all supported brands with their size scales, available sizes, fit tendencies, and domain mappings. |
| **Edge Function** | A serverless backend function that runs on Lovable Cloud. Our two functions are `recommend-size` and `sync-airtable`. |
| **RLS (Row Level Security)** | Database security rules that control which users can read/write which rows. For example, users can only see their own profile. |
| **Lovable Cloud** | The backend platform that hosts the database, authentication, and edge functions. Built on Supabase technology. |
| **Lovable AI Gateway** | An AI service provided by Lovable Cloud that lets edge functions call AI models (like Gemini) without needing separate API keys. Used for generating explanation bullets, estimating body measurements, and scraping product pages. |
| **Snap to Available** | The final step in the algorithm where the calculated size is matched to the closest size the brand actually sells, preventing recommendations of sizes that don't exist. |
| **Fallback Mapping** | When no sizing chart data exists, the system uses a universal index to map sizes across brands. Less accurate but always works. |
| **Confirmation Memory** | Sizes the user has confirmed are saved in the browser's localStorage, so if they return to the same product, they see their confirmed size immediately. |
| **Widget** | The small floating pill button (180×41px) that says "FIND MY SIZE" and appears on the right edge of the page. Clicking it opens the panel. |
| **Panel** | The main ALTAANA UI — a 404×733px floating card with dark background, rounded corners, and a cyan accent border. Contains all screens (auth, profile, recommendation, etc.). |
