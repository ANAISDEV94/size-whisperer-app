# ALTAANA Essential V1 — Test Readiness Checklist

> Optimized for a **3-minute smoke test** and a **30-minute user test**.

---

## 1. Pre-Test Setup

- [ ] Chrome extension loaded via `chrome://extensions` → Load unpacked (`extension/` folder)
- [ ] Extension icons (`icon48.png`, `icon128.png`) present
- [ ] Airtable sync completed — run `sync-airtable` and verify `sizing_charts` table is populated
- [ ] Row quality backfilled — confirm `row_quality >= 2` for major brands (`SELECT brand_key, count(*) FROM sizing_charts WHERE row_quality >= 2 GROUP BY brand_key`)
- [ ] Test accounts ready:
  - Google OAuth account (for sign-in flow)
  - Email/password account (for email flow)
  - Guest session (clear `altaana_guest_session` from localStorage to reset)
- [ ] Debug mode: append `?debug=1` to URL for smoke tests; remove for user tests
- [ ] Preview URL accessible: `https://size-whisperer-app.lovable.app`
- [ ] Browser console open (for smoke test log review)

---

## 2. 3-Minute Smoke Test (5 Steps)

Run at `/?debug=1`. Click **"Run Smoke Tests"** button (bottom-left).

| Step | Action | PASS | FAIL |
|------|--------|------|------|
| **1** | Click "Run Smoke Tests" | All 5 scenarios execute without exceptions | Any scenario throws an unhandled error |
| **2** | Scenario A: Alo M → Alo tops | Returns **M**, 100% confidence | Any size other than M |
| **3** | Scenario B: Reformation S → Alo dresses | Returns XS/S/M (non-extreme) | Returns XXS, XXXS, 00, 4X, or 20 |
| **4** | Scenario C: Zimmermann 2 → Alo tops | Does **not** return 20; track = `brand_specific` | Returns 20 (brand-specific guard failed) |
| **5** | Scenario D: Unknown brand → Unknown target | Triggers "Need more info" | Returns a size with no data backing it |

**Overall PASS**: 0 red ❌ results, ≤ 1 yellow ⚠️ warning.

---

## 3. 30-Minute User Test Checklist

### Authentication (5 min)
- [ ] Google OAuth: sign in → lands on Profile screen
- [ ] Email sign-in: existing account → lands on Profile or Recommendation
- [ ] Email sign-up: new account → receives verification email → can sign in after verify
- [ ] Guest mode: "Continue without saving" → lands on Profile screen
- [ ] Returning user: refresh page → bypasses auth screen (session persisted)

### Profile Creation (5 min)
- [ ] Select 1 anchor brand + size → Next enabled
- [ ] Select 2 anchor brands + sizes → Next enabled
- [ ] Fit preference toggles between Fitted / Standard / Relaxed
- [ ] Size selector shows correct scale per brand (letter, numeric, EU, denim, UK)
- [ ] Brand search filters correctly (type "Zim" → shows Zimmermann)

### Recommendation Flow (10 min)
- [ ] Analyzing screen appears with spinner
- [ ] Recommendation screen shows: size, brand name, confidence badge, "Why this size" bullets
- [ ] Confidence badge color: green (≥70%), yellow (50-69%), red (<50%)
- [ ] "Boost accuracy" collapsible opens → enter weight/height → Recalculate works
- [ ] "Need more info" screen appears when data is insufficient (test with obscure brand combo)
- [ ] Need more info asks for correct measurement (bust for tops, waist for denim, hips for dresses)

### Adjustment Logging (5 min)
- [ ] Click "Size down" → Confirmed screen shows adjusted size
- [ ] Click "Keep" → Confirmed screen shows original size
- [ ] Click "Size up" → Confirmed screen shows adjusted size
- [ ] Adjustment is logged to `user_adjustments` table (verify via database)

### Extension Integration (5 min)
- [ ] Navigate to supported brand site (e.g., `aloyoga.com` product page)
- [ ] Floating widget appears on right side
- [ ] Click widget → panel opens with auth/profile/recommendation flow
- [ ] "Go to size selector" button on confirmed screen → scrolls to native size picker on PDP
- [ ] Panel closes cleanly via X button

---

## 4. Common Failure Modes

| Symptom | What to Check |
|---------|---------------|
| **Wrong brand detected** | `content.js` domain→brand mapping; for Revolve, check URL path parsing |
| **Category "unknown"** | `sync-airtable` category normalization; check `sizing_charts.category` values for target brand |
| **Extreme size returned** (XXS, 20) | Extreme-size guard in `recommend-size`; verify anchor size isn't already extreme |
| **Low confidence unexpectedly** | Check `row_quality` of matched rows; verify `sizing_charts.measurements` has ≥2 non-null dimensions |
| **Wrong track selected** | Debug trace → `anchorScaleTrack` / `trackUsed`; ensure `size_scale` column is correct in `sizing_charts` |
| **"Need more info" too often** | Confidence threshold is 70%; check if target brand has sufficient measurement data |
| **"Need more info" never triggers** | Test with genuinely unknown brands; verify fallback detection raises threshold to 85% |
| **Recalculate does nothing** | Ensure weight/height fields are non-empty; check edge function logs for errors |
| **Auth redirect loop** | Clear localStorage + cookies; check Cloud auth configuration |
| **Size selector scroll fails** | `content.js` selector strategy; site may have changed DOM structure |

---

## 5. Release Blockers

### 🔴 Must-Fix (Cannot Ship)
- [ ] Scenario C fails (Zimmermann 2 → 20 bug)
- [ ] Auth flow broken (can't sign in via any method)
- [ ] Recommendation returns empty/null size with no "Need more info" fallback
- [ ] Extension doesn't load on any supported domain
- [ ] Extreme sizes returned for non-extreme anchors without 95% confidence
- [ ] Row quality filter causes zero results with no fallback (blank recommendation)

### 🟡 Can Ship (Fix Soon)
- [ ] Confidence badge shows wrong color tier
- [ ] "Boost accuracy" recalculate doesn't change result (non-blocking UX)
- [ ] Debug panel data incomplete or missing fields
- [ ] One specific brand's category mapping is wrong (workaround: manual Airtable fix)
- [ ] Size selector scroll fails on a single brand site (user can manually select)
- [ ] Guest session doesn't persist across domains (known limitation)

### 🟢 Nice to Have (Post-V1)
- [ ] Additional smoke test scenarios (denim, swimwear)
- [ ] Automated CI smoke tests
- [ ] Performance benchmarks (response time < 2s)
- [ ] Multi-anchor brand weighting improvements
