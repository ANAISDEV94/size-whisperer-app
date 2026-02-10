

# Fix Brand Sizes in Profile Onboarding + Airtable Sync

## Problem

The size picker in the profile onboarding screen shows incorrect sizes for many brands. For example, **7 For All Mankind** shows standard US sizes (00, 0, 2, 4...) when it should show denim waist sizes (22, 23, 24, 25...). This affects at least 5-6 brands.

## Plan

### Step 1: Run Airtable Sync

Trigger the `sync-airtable` backend function to pull actual sizing chart data from Airtable. This populates the `sizing_charts` table with real size labels per brand, giving us ground truth to verify against.

### Step 2: Update `available_sizes` for All Incorrect Brands

After reviewing the synced data, update the `brand_catalog` table with corrected sizes. Known corrections:

| Brand | Current Sizes | Corrected Sizes | Scale |
|-------|--------------|-----------------|-------|
| 7 For All Mankind | 00, 0, 2, 4, 6, 8, 10, 12, 14 | 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 | denim |
| Mother | 00, 0, 2, 4, 6, 8, 10, 12, 14 | 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34 | denim |
| Revolve Denim | 00, 0, 2, 4, 6, 8, 10, 12, 14 | 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 | denim |
| Retrofete | XS, S, M, L, XL (scale: numeric) | Fix scale to "letter" |
| Torrid | 10-30 (scale: letter) | Fix scale to "numeric" |
| Alaïa | 34-48 (scale: letter) | Fix scale to "eu" |
| Balmain | 34-48 (scale: numeric) | Fix scale to "eu" |
| Other EU brands (Dolce, Gucci, Prada, etc.) | 34-48 (scale: numeric) | Fix scale to "eu" |

The exact sizes for each brand will be refined using the synced Airtable data as the source of truth.

### Step 3: Auto-Derive Sizes from Synced Data (Enhancement)

After the sync, query `sizing_charts` to extract the distinct `size_label` values per brand. Use these to update any `brand_catalog` entries that don't match reality. This ensures future Airtable syncs can automatically keep `available_sizes` accurate.

### Step 4: Update Universal Size Map in Recommendation Engine

Add "denim" scale entries to the `BRAND_SCALE_MAPS` in the `recommend-size` backend function so cross-brand recommendations work correctly when a denim brand (like 7 For All Mankind size 27) is the anchor.

### Step 5: Clear Frontend Cache

The `ProfileScreen` caches brand sizes in memory (`brandSizesCache`). Add cache invalidation or ensure the cache is keyed properly so updated database values are reflected immediately.

---

## Technical Details

### Database updates (data operations, not schema changes)
Multiple `UPDATE` statements against `brand_catalog` to fix `available_sizes`, `size_scale` for ~15 brands.

### Edge function changes
- `recommend-size/index.ts`: Add denim scale mappings (e.g., waist size 24 maps to roughly US size 0, waist 26 to US 2, etc.) to `BRAND_SCALE_MAPS` and `UNIVERSAL_SIZE_MAP`.

### Frontend changes
- `ProfileScreen.tsx`: Minor fix to clear the `brandSizesCache` module-level variable when needed, or convert to a React ref so it respects component lifecycle.

### Airtable sync
- Trigger the existing `sync-airtable` function, then query `sizing_charts` to validate/refine the corrected sizes.

