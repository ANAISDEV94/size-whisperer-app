

# Update Airtable Credentials and Add Debug Connectivity Check

## Summary

The `sync-airtable` edge function already reads all Airtable config from secrets — nothing is hardcoded. The only work needed is updating two secret values via the Lovable UI and adding a debug log at the start of the sync function.

---

## What needs to change

### 1. Update two secrets (no code change — done in Lovable UI)

The following secrets need new values. Navigate to:

**Settings (gear icon, top-left) -> Lovable Cloud -> Secrets**

| Secret Name | New Value |
|---|---|
| `AIRTABLE_BASE_ID` | `appIo7XMhdyhwdllv` |
| `AIRTABLE_TABLE_NAME` | `Imported table - FIX` |

These secrets already exist, so you will be updating (not creating) them.

### 2. Paste the new token (same UI path)

In the same Secrets panel, update:

| Secret Name | Action |
|---|---|
| `AIRTABLE_API_KEY` | Paste your new Personal Access Token here |

### 3. Add debug connectivity check (code change)

Add a small block at the top of the sync handler in `supabase/functions/sync-airtable/index.ts` that, when the request body contains `{ "debug": true }`, logs the table name, last 4 characters of the base ID, and attempts to fetch one record to confirm connectivity — then returns the result without doing a full sync.

This is a ~20-line addition inside the existing `try` block, after secrets are loaded and before the full sync runs. No UI changes.

---

## Files changed

| File | Change |
|---|---|
| `supabase/functions/sync-airtable/index.ts` | Add debug connectivity probe (~20 lines) |

No other files are touched. No UI, layout, or styling changes.

---

## Post-update test checklist

1. **Trigger sync**: Call the `sync-airtable` function with `{ "debug": true }` to confirm connectivity (should log base ID last 4, table name, and whether a sample record was fetched).
2. **Full sync**: Call `sync-airtable` without debug flag and confirm rows are imported from the new table.
3. **Smoke test**: Navigate to `/?debug=1`, click "Run Smoke Tests", and confirm no crashes and at least Scenario A passes.

