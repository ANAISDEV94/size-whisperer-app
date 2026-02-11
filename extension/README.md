# Altaana Chrome Extension Shell

## Local Testing

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this `extension/` folder
4. Add placeholder icon files (`icon48.png`, `icon128.png`) — any 48×48 and 128×128 PNG will work
5. Navigate to a supported brand site (e.g., `shopcsb.com`, `revolve.com`, `aloyoga.com`)
6. The Altaana panel should appear on any product detail page

## How It Works

- **`content.js`** — Runs on supported brand domains. Detects the brand from the hostname (or Revolve URL path), infers the garment category from the URL, and injects an iframe pointing to the published Lovable app with `?brand=...&category=...&url=...` params.
- **`background.js`** — Service worker that stores/retrieves auth tokens via `chrome.storage.local` so the user stays logged in across page navigations.
- **`manifest.json`** — Manifest V3 config with host permissions for all supported brand domains.

## Domain Detection

| Domain | Brand Key |
|--------|-----------|
| shopcsb.com | csb |
| revolve.com | (detected from URL path) |
| aloyoga.com | alo_yoga |
| ... | (see content.js for full mapping) |

## Revolve Multi-Brand

Revolve hosts multiple brands. The content script matches URL path segments like `/helsa/`, `/csb/`, `/house-of-harlow-1960/` to determine the brand.
