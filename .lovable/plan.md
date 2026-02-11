

# Fix Plan: Background Transparency, Auth Persistence, Brand Detection, Size Scale, and Size Selector

## Issues Identified

1. **Background still visible behind the widget/modal** -- The AuthScreen component renders a full-screen overlay (`fixed inset-0` with `bg-black/60`) that fills the entire 440px-wide iframe, creating a visible dark rectangle on the host page even when the panel is closed or only showing the widget.

2. **Auth screen repeats on every site** -- Supabase auth is stored per-origin. Since the iframe always loads from `size-whisperer-app.lovable.app`, sessions should persist. The likely issue is that Google OAuth redirect flow breaks inside an iframe (popup blocked or redirect fails). Need to ensure auth state is properly checked before showing the auth screen.

3. **Brand detection picks up "New" instead of brand name** -- The Revolve DOM scraping fallback grabs nav category text ("New") instead of the actual brand name from the product detail page.

4. **Denim sizes (22-24) getting "Medium" recommendation** -- The category inference from URL keywords may miss denim-specific paths, or the size scale conversion incorrectly maps denim waist sizes to letter sizes.

5. **"Go to size selector" doesn't work / scrolls to wrong section** -- The `handleAddToCart` callback in ExtensionPanel.tsx only logs to console. While ConfirmedScreen sends a `postMessage`, the content script's selector list may not match the target site's DOM.

---

## Planned Changes

### 1. Fix Background Transparency

**Files:** `src/components/panel/screens/AuthScreen.tsx`, `src/components/panel/ExtensionPanel.tsx`

- Remove the full-screen backdrop overlay (`fixed inset-0 bg-black/60`) from AuthScreen when running in embedded mode. Instead, render the AuthScreen as a panel (same dimensions as the main panel) without any full-screen overlay.
- Ensure the iframe container in content.js uses `pointer-events: none` on the iframe itself, with `pointer-events: auto` only on interactive elements inside. This prevents the invisible iframe area from blocking clicks on the host page.

### 2. Fix Auth Persistence Across Sites

**Files:** `src/components/panel/ExtensionPanel.tsx`, `src/hooks/useAuth.ts`

- The iframe always loads from the same origin (`size-whisperer-app.lovable.app`), so Supabase sessions should persist across different host sites automatically.
- Add logic: if a user session already exists when the widget is clicked, skip the auth screen entirely and go straight to the profile or analyzing screen.
- For "Continue without saving" (guest) users: store a flag in `localStorage` so they aren't prompted for auth again during the browser session.

### 3. Fix Brand Detection on Revolve

**File:** `extension/content.js`

- Improve `detectBrandFromDOM()` to target Revolve-specific brand selectors more precisely (e.g., the brand link near the product title on the PDP, not navigation categories).
- Expand the `skipWords` list to filter out common navigation terms like "new", "sale", "clothing", etc.
- Add a more targeted Revolve PDP selector: look for the brand name element that appears directly above/near the product title on Revolve product pages.

### 4. Fix Denim Size Scale Mismatch

**Files:** `extension/content.js`, `supabase/functions/recommend-size/index.ts`

- Update the `inferCategory()` function in content.js to detect denim from URL patterns (e.g., URLs containing "jean", "denim", or waist-size numbers).
- In the edge function, when the target brand's available sizes are denim waist sizes (22-35), ensure the recommendation snaps to a denim size rather than converting to letter scale. The `snapToAvailableSize` function should already handle this, but the category being passed may be wrong (defaulting to "tops" instead of "bottoms").
- Add a heuristic: if available_sizes contains numbers in the 22-35 range, treat as denim scale regardless of category parameter.

### 5. Fix "Go to Size Selector" Button

**Files:** `src/components/panel/screens/ConfirmedScreen.tsx`, `extension/content.js`

- The ConfirmedScreen already sends `postMessage` to parent, but the content script needs better site-specific selectors.
- Add Tom Ford-specific selectors (e.g., `select[name*="size"]`, `.product-size-select`).
- Add a smarter fallback: search for elements containing text "SIZE" (case-insensitive) near the top of the product info area, filtering out footer/recommendation sections.
- Add a "no size selector found" graceful handling: if nothing is found, show a brief toast or message instead of doing nothing.

---

## Technical Details

### AuthScreen Changes
- Detect embedded mode via `window.location !== window.parent.location`
- In embedded mode: render AuthScreen as a panel-sized card (404x733) positioned right, without the full-screen overlay
- In non-embedded mode: keep existing behavior

### Guest Session Persistence
- On "Continue without saving": set `localStorage.setItem("altaana_guest_session", "true")`
- In `ExtensionPanel.handleOpen`: check for guest session flag OR existing auth user -- skip auth screen if either exists
- Clear guest flag on explicit sign-out

### Content Script Brand Detection
- Add Revolve-specific selectors targeting `.product-brand a` or the brand name link that appears above the product title
- Add more skip words: "new", "sale", "best_sellers", "what_s_new"

### Size Selector Improvements  
- Add per-site selector maps for known brand sites (Tom Ford, Revolve, Alo Yoga, etc.)
- Use a scoring system: prefer elements near the "Add to cart" button or product price area
- Limit scroll target search to the main product content area (not recommendations/footer)

