

# Enhance Recommendation Engine and Add "Boost Accuracy" Feature

## Overview

This plan addresses three key areas: (1) syncing your Airtable sizing data so the engine actually uses it, (2) ensuring the recommendation logic fully leverages all measurement fields from your database, and (3) adding the "Boost accuracy (optional)" section with weight and height inputs as shown in your wireframe.

## Current State

- The `sizing_charts` table is **empty** -- the Airtable sync has never been run. This means every recommendation currently falls back to simple scale-conversion logic instead of using your actual measurement data.
- The recommendation engine already has solid logic for measurement-based matching (bust, waist, hips) and PDP fabric scraping, but it cannot work without data.
- The "Boost accuracy" feature (weight + height inputs) does not exist yet.

## What Will Change

### 1. Sync Airtable Data

Run the existing `sync-airtable` edge function to populate the `sizing_charts` table with all 38 brands' measurement data. This is the critical missing piece -- once the data is in the database, the deterministic measurement-matching logic will activate automatically.

### 2. Update Recommendation Screen UI

Redesign the recommendation screen to match the wireframe:
- **"WHY THIS SIZE"** section shown as always-visible (not collapsed by default)
- **"Boost accuracy (optional)"** collapsible section below the Size down/Keep/Size up buttons with:
  - Weight input (e.g., "140 lbs")
  - Height input (e.g., "5'6\"")
  - Helper text: "Helpful for fitted or non-returnable items"
- When the user provides weight/height and taps a "Recalculate" button, re-run the recommendation with those extra parameters

### 3. Enhance the Backend to Use Weight and Height

Update the `recommend-size` edge function to:
- Accept optional `weight` and `height` parameters
- Use AI to estimate body measurements from weight + height + fit preference
- Blend those estimated measurements with the anchor-brand-based approach for a more precise recommendation
- The AI prompt will factor in the full measurement data from the database (bust ranges, waist ranges, hip ranges, underbust, etc.)

### 4. Expand Measurement Matching

Update the `findClosestSize` function to consider additional measurement fields beyond bust/waist/hips when available:
- `underbust` (important for sports bras, bodysuits -- Lululemon, Alo, CSB)
- `thigh` and `rise` (important for denim/jeans)
- `shoulders` and `sleeve_length` (useful for fitted tops/jackets)
- Weight each measurement by relevance to the garment category

---

## Technical Details

### Files to modify:

**`src/components/panel/screens/RecommendationScreen.tsx`**
- Change "Why this size" from collapsed-by-default to always-expanded
- Add "Boost accuracy (optional)" collapsible section with weight/height text inputs
- Add "Recalculate" button that triggers a re-recommendation with the new inputs
- Style to match wireframe (teal link text, dark input fields)

**`src/types/panel.ts`**
- Add optional `weight` and `height` fields to `UserProfile` or create a new `BoostAccuracyData` type

**`src/hooks/useRecommendation.ts`**
- Add optional `weight` and `height` parameters to `fetchRecommendation`

**`src/components/panel/ExtensionPanel.tsx`**
- Wire up the boost accuracy recalculation flow
- Pass recalculate handler to RecommendationScreen

**`supabase/functions/recommend-size/index.ts`**
- Accept `weight` and `height` in request body
- When provided, use AI to estimate bust/waist/hip measurements from weight + height
- Expand `findClosestSize` keys array to include category-relevant measurements (underbust for bras, thigh/rise for denim, etc.)
- Add category-to-measurement-priority mapping (e.g., denim prioritizes waist > hips > thigh > rise; tops prioritize bust > waist > shoulders)

### Data sync:
- Trigger the `sync-airtable` function to populate `sizing_charts` with your Airtable data
- This is a one-time action that fills the database so the measurement-based engine works

