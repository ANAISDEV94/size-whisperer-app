

# Fix: Embedded Mode Background and Close Button

## Root Causes Found

### 1. Iframe URL missing `source=extension` parameter
In `extension/content.js` (line 198), the iframe URL is built as:
```
${PANEL_ORIGIN}/?brand=${brandKey}&category=${category}&url=${productUrl}
```
It does NOT include `source=extension` or `embedded=1`. This means the Lovable app inside the iframe never detects embedded mode, so it renders in normal mode (with FloatingWidget, wrong layout, etc.).

### 2. Close button is a no-op in embedded mode
In `ExtensionPanel.tsx` (line 255), embedded mode passes `onClose={() => {}}` -- an empty function. Clicking the X does nothing. It should send a `postMessage` to the parent frame telling it to collapse the iframe.

### 3. Iframe background set to transparent
In `content.js` (line 285), the iframe has `background: transparent`. Combined with issue #1 (embedded mode not activating), the solid dark background CSS never applies, resulting in the see-through appearance.

## Fix Plan

### File 1: `extension/content.js`
- Add `&source=extension` to the iframe `src` URL so the Lovable app correctly detects embedded mode
- Change iframe `background` from `transparent` to `#0D0D0D` so there's always a dark fallback

### File 2: `src/components/panel/ExtensionPanel.tsx`
- Replace the empty `onClose={() => {}}` in the embedded branch with a function that sends `postMessage({ type: "ALTAANA_PANEL_RESIZE", mode: "widget" }, "*")` to the parent window, which will collapse the iframe

## What stays the same
- No changes to recommendation logic, auth, Airtable, screen flows, or any other files
- The normal (non-embedded) mode is untouched
- All styling, layout, spacing, and colors remain identical

