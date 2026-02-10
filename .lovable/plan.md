

# Milestone 4 — Brand Data + Airtable Integration

This milestone sets up the database tables for brand/sizing data, builds the Airtable sync edge function with robust measurement normalization, and extends the profiles table to persist sizing profiles.

---

## Overview

```text
+------------------+       Edge Function        +-------------------+
|   Airtable Base  |  ---- sync-airtable ---->  |  Lovable Cloud DB |
|  (sizing charts) |                            |                   |
+------------------+                            |  brand_catalog    |
                                                |  sizing_charts    |
                                                |  profiles (extended)
                                                +-------------------+
```

The sync edge function fetches records from Airtable, normalizes messy measurement strings, and upserts them into the database. Both raw and normalized values are stored.

---

## Step 1: Database Schema Migration

Create three new tables and extend the existing `profiles` table.

### 1a. `brand_catalog` table
Stores each supported brand with its domain mappings and general fit tendency.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| brand_key | TEXT (unique) | Normalized key, e.g. `alo_yoga` |
| display_name | TEXT | Human-readable, e.g. "Alo Yoga" |
| domains | TEXT[] | Array of domains, e.g. `{"aloyoga.com"}` |
| fit_tendency | TEXT | "runs_small", "true_to_size", "runs_large", or null |
| garment_categories | TEXT[] | e.g. `{"tops", "bottoms", "dresses"}` |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

RLS: Public read (no auth needed to look up brands), no public write.

### 1b. `sizing_charts` table
Stores per-brand, per-category, per-size measurement data with both raw and normalized values.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| brand_key | TEXT (FK to brand_catalog) | |
| category | TEXT | e.g. "tops", "bottoms", "dresses" |
| size_label | TEXT | e.g. "M", "6", "Large" |
| measurements | JSONB | Normalized structure (see below) |
| raw_measurements | JSONB | Original values from Airtable as-is |
| fit_notes | TEXT | Brand/category specific notes |
| airtable_record_id | TEXT | For upsert tracking |
| synced_at | TIMESTAMPTZ | Last sync timestamp |
| created_at | TIMESTAMPTZ | Default now() |

RLS: Public read, no public write.

### 1c. Extend `profiles` table
Add columns for the sizing profile data that is currently only stored in local state.

| New Column | Type | Notes |
|------------|------|-------|
| anchor_brands | JSONB | Array of `{brand_key, display_name, size}` (up to 2) |
| fit_preference | TEXT | "fitted", "true_to_size", or "relaxed" |

### 1d. Create tables for logging (preparing for Milestone 5/6)

**`recommendations`** table:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID | References auth.users |
| brand_key | TEXT | Target brand |
| product_url | TEXT | URL of the product page |
| recommended_size | TEXT | The size we recommended |
| explanation_bullets | JSONB | Array of 3 bullet strings |
| created_at | TIMESTAMPTZ | |

**`user_adjustments`** table:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| recommendation_id | UUID | FK to recommendations |
| action | TEXT | "size_down", "keep", or "size_up" |
| final_size | TEXT | The size after adjustment |
| created_at | TIMESTAMPTZ | |

RLS for recommendations/user_adjustments: Users can read/insert their own records only.

---

## Step 2: Measurement Normalization Logic

The core of this milestone. A normalization module inside the edge function that converts messy Airtable strings into a consistent structure.

### Normalized measurement format (JSONB)

```text
{
  "bust": { "min": 34, "max": 35, "unit": "in" },
  "waist": { "min": 26, "max": 27, "unit": "in" },
  "hips": { "options": [34, 35], "unit": "in" }
}
```

Each measurement field becomes an object with either:
- `min` + `max` (for ranges like "34-35")
- `options` array (for OR values like "34/35")
- `value` (for single values like "34")

### Parsing rules

| Input Pattern | Interpretation | Normalized Output |
|---------------|---------------|-------------------|
| `"34"` | Single value | `{ "value": 34 }` |
| `"34-35"`, `"34 - 35"`, `"34--35"` | Range (hyphen/en-dash/em-dash) | `{ "min": 34, "max": 35 }` |
| `"34/35"`, `"34\35"` | OR options | `{ "options": [34, 35] }` |
| `"34-35 / 36"` | Range OR single | `{ "options": [{"min":34,"max":35}, 36] }` |
| `""` or whitespace-only | Empty/missing | `null` |
| Non-numeric text (e.g. "Petite") | Descriptive note | `{ "note": "Petite" }` |

### Implementation approach
- Strip all whitespace around delimiters
- Detect delimiter priority: slash/backslash first (splits into OR options), then dash/en-dash/em-dash (splits into range)
- Parse each segment as a number; if not numeric, store as a `note`
- Always preserve the `unit` field (default "in" for inches; detect "cm" if present)

---

## Step 3: Airtable Sync Edge Function

**File:** `supabase/functions/sync-airtable/index.ts`

### Prerequisites
- An Airtable API key must be stored as a secret (name: `AIRTABLE_API_KEY`)
- The Airtable base ID and table name will need to be provided (stored as secrets or hardcoded if stable: `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_NAME`)

### Flow

```text
1. Fetch all records from Airtable (paginated)
2. For each record:
   a. Extract brand name, category, size label, measurement fields
   b. Normalize brand name to brand_key
   c. Store raw measurement values in raw_measurements
   d. Run normalization function on each measurement field
   e. Store normalized values in measurements
3. Upsert into sizing_charts (keyed on airtable_record_id)
4. Upsert brand info into brand_catalog
5. Return summary (records synced, errors encountered)
```

### Configuration

In `supabase/config.toml`, add:
```text
[functions.sync-airtable]
verify_jwt = false
```

JWT verification is disabled so it can be called by a cron job, but the function will check for a shared secret or service role key to prevent unauthorized access.

### Brand name normalization mapping
A lookup table in the function maps display names to brand_keys:
- "Alo Yoga" -> `alo_yoga`
- "7 For All Mankind" -> `seven_for_all_mankind`
- "&/Or Collective" -> `and_or_collective`
- etc.

This is derived from the existing `SUPPORTED_BRANDS` array.

---

## Step 4: Seed `brand_catalog` with Supported Brands

An initial migration (or part of the sync function's first run) seeds the `brand_catalog` table with all 38 brands from `SUPPORTED_BRANDS`, including known domain mappings for the pilot brands:
- Alo Yoga: `aloyoga.com`
- CSB: `revolve.com` (with brand detection logic needed later)

Other brand domains will be filled in progressively.

---

## Step 5: Update ProfileScreen to Persist to Database

Modify `ProfileScreen.tsx` and `ExtensionPanel.tsx` so that when a logged-in user saves their profile, the `anchor_brands` and `fit_preference` fields are written to the `profiles` table via Supabase client. Guest users continue with local-only state.

---

## Step 6: Secret Setup

Before the edge function can work, three secrets need to be configured:
- `AIRTABLE_API_KEY` — the user's Airtable personal access token
- `AIRTABLE_BASE_ID` — the ID of the Airtable base containing sizing data
- `AIRTABLE_TABLE_NAME` — the table name within that base

These will be requested from the user before implementing the edge function.

---

## Technical Summary

| Component | Action |
|-----------|--------|
| Database migration | Create `brand_catalog`, `sizing_charts`, `recommendations`, `user_adjustments` tables; add `anchor_brands` and `fit_preference` columns to `profiles` |
| Edge function | `sync-airtable/index.ts` with Airtable fetch, normalization module, and upsert logic |
| Normalization module | Parse ranges (dash), OR values (slash), singles, blanks, and non-numeric text into structured JSONB |
| Frontend | Update `ProfileScreen` to save profile data to the database for authenticated users |
| Secrets | Request `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_NAME` from user |
| Brand seed | Populate `brand_catalog` with all 38 brands and known domains |

