

# Fix VTO Error Visibility and Add Debug Logging

## Problem

When the edge function returns a non-2xx status (e.g., 422 from Replicate), the Supabase JS client throws a generic error: `"Edge Function returned a non-2xx status code"`. The actual JSON body with status code and error details is discarded, making debugging impossible from the UI.

## Changes

### 1. `src/hooks/useVirtualTryOn.ts` -- Extract full error details

The Supabase `functions.invoke` method returns `{ data, error }`. When the edge function returns non-2xx, `error` is a `FunctionsHttpError` that contains the response context, but `data` may still hold the parsed JSON body. The fix:

- Check if `error` exists and if `data` contains an `error` or `detail` field from the edge function's JSON response
- If the Supabase client swallows the body, switch to using raw `fetch` instead of `supabase.functions.invoke` for the POST call so we can read the response status and body directly
- Build a detailed error string: `"[HTTP {status}] {error message from JSON}"` and set it in state
- Add `console.log` before the POST call logging:
  - `garmentImageUrl` value
  - `personImageBase64` length (in characters and approx KB)
  - `category` value

### 2. `src/components/panel/screens/VTOScreen.tsx` -- Show full error in banner

The error banner already exists (lines ~131-135). Update it to:

- Display the full error string (which now includes status code and server message)
- Use `whitespace-pre-wrap` so multi-line errors render properly
- No layout changes otherwise

### 3. Specific code approach for the hook

Replace `supabase.functions.invoke` with a direct `fetch` call for the POST endpoint. This gives us full control over response handling:

```
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/virtual-tryon`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
  body: JSON.stringify({ ... }),
});

if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  const detail = body.error || body.detail || JSON.stringify(body);
  setState({ status: "failed", error: `[${res.status}] ${detail}`, ... });
  return;
}
```

Same approach for the GET poll call -- switch to raw fetch so we can surface errors.

### 4. Console debug logging

Add before the fetch call:
```
console.log("[VTO] Starting prediction", {
  garmentImageUrl,
  personImageBase64Length: personImageBase64.length,
  personImageApproxKB: Math.round(personImageBase64.length * 0.75 / 1024),
  category,
});
```

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useVirtualTryOn.ts` | Replace `supabase.functions.invoke` with raw `fetch`, extract full error details, add console logging |
| `src/components/panel/screens/VTOScreen.tsx` | Add `whitespace-pre-wrap` to error banner text |

No backend or extension changes needed.

