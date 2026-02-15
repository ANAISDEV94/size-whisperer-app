# Fix VTO: Use Supabase Storage for Temporary Image Hosting

## Problem

Replicate's Files API returns authenticated URLs (`https://api.replicate.com/v1/files/{id}`) that the model worker cannot download. The model receives `None` for both image inputs and crashes with the Python error shown in the UI.

## Solution

Upload both images to a **public Supabase Storage bucket** (`vto-temp`) instead. This gives Replicate plain HTTP URLs it can download without authentication.

## Changes

### 1. Create Storage Bucket

Create a public `vto-temp` storage bucket via SQL migration. Files will be cleaned up after use.

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('vto-temp', 'vto-temp', true);
CREATE POLICY "Allow anon uploads to vto-temp" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vto-temp');
CREATE POLICY "Allow public reads from vto-temp" ON storage.objects FOR SELECT USING (bucket_id = 'vto-temp');
CREATE POLICY "Allow deletes from vto-temp" ON storage.objects FOR DELETE USING (bucket_id = 'vto-temp');
```

### 2. Edge Function (`supabase/functions/virtual-tryon/index.ts`)

Replace `uploadToReplicateFiles()` with `uploadToSupabaseStorage()`:

- Decode base64 to binary
- Upload to `vto-temp` bucket with a UUID filename using the Supabase client
- Construct the public URL: `{SUPABASE_URL}/storage/v1/object/public/vto-temp/{filename}`
- Pass these public URLs to Replicate as `human_img` and `garm_img`
- After the prediction is created, optionally schedule cleanup (or let files expire)

The key change in the prediction creation:

```
input: {
  human_img: publicPersonUrl,   // https://{project}.supabase.co/storage/v1/object/public/vto-temp/{uuid}.png
  garm_img: publicGarmentUrl,   // https://{project}.supabase.co/storage/v1/object/public/vto-temp/{uuid}.png
  category: vtonCategory,
}
```

### 3. No Frontend Changes

The frontend already correctly sends base64 and polls for results. The garment auto-capture via content script + postMessage pipeline remains unchanged.

### 4. UX: Garment Auto-Capture is Primary Path

The current flow already auto-captures the garment from the PDP via the content script. The manual upload button appears only as a small "Select garment image manually" link below the auto-captured preview -- it is NOT the primary path. No UX changes needed here; the auto-capture is working (the screenshot shows the garment was captured successfully at ~99KB).  
I uple goaded tharment image but the image should load on its own or take a screenshot of the garment image.

## Technical Details

### Upload helper

```text
async function uploadToSupabaseStorage(base64DataUri, filename):
  1. Extract MIME type and raw base64 from data URI
  2. Decode base64 to Uint8Array
  3. Create Supabase admin client (using service role key available in edge functions)
  4. Upload binary to vto-temp/{filename}
  5. Return public URL: {SUPABASE_URL}/storage/v1/object/public/vto-temp/{filename}
```

### Updated flow

```text
Client POST (unchanged):
  person_image_base64: "data:image/png;base64,..."
  garment_image_base64: "data:image/png;base64,..."

Edge Function:
  1. Validate both base64 images (existing logic, unchanged)
  2. Upload person to Supabase Storage -> public URL
  3. Upload garment to Supabase Storage -> public URL
  4. Create Replicate prediction with public URLs
  5. Return prediction_id

Replicate:
  - Downloads images from public Supabase Storage URLs (no auth needed)
  - Processes normally
```

## Files Changed


| File                                        | Change                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| SQL Migration                               | Create `vto-temp` public storage bucket with upload/read/delete policies                    |
| `supabase/functions/virtual-tryon/index.ts` | Replace `uploadToReplicateFiles` with `uploadToSupabaseStorage` using Supabase admin client |


No frontend, hook, or extension changes needed.  
  
