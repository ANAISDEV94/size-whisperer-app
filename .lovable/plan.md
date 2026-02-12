

# Update Airtable API Key and Sync Data

## Steps

1. **Update the stored secret** -- Replace the current `AIRTABLE_API_KEY` with the new personal access token you provided.

2. **Run the sync** -- Call the `sync-airtable` backend function to pull all 38 brands' measurement data into the database.

3. **Verify** -- Confirm the data landed correctly by checking the `sizing_charts` table for records.

This is a quick operational task with no code changes needed.

