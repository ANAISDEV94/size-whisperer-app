

# Fix: Restore Panel Design in Embedded Mode

## Problem
In embedded mode, the panel renders as a full-screen flat black rectangle with sharp edges. The original design uses a 404x733px floating card with 20px rounded corners, a subtle cyan border, and vertical centering — this styling is completely missing in embedded mode.

## Solution
Update the embedded mode rendering in `ExtensionPanel.tsx` to use the same panel shell styling as normal mode: same dimensions, rounded corners, border, and centering. The only difference from normal mode is that the FloatingWidget is suppressed and there's no slide-in animation.

Also update the iframe in `extension/content.js` to use `background: transparent` again (now that `source=extension` is being passed, the app handles its own background correctly), so the rounded corners are visible against the host page.

## Changes

### File 1: `src/components/panel/ExtensionPanel.tsx`
Replace the embedded mode container (lines 246-261) with the same panel shell used in normal mode:
- Outer wrapper: `fixed right-4 top-0 bottom-0 flex items-center` (same positioning)
- Inner panel: `width: 404`, `height: 733`, `borderRadius: 20`, `border: 1px solid rgba(0, 206, 209, 0.18)`, same gradient background
- No FloatingWidget, no slide animation — panel is shown immediately
- Keep the existing `onClose` postMessage logic

### File 2: `extension/content.js`
- Change iframe `background` back from `#0D0D0D` to `transparent` so the rounded panel corners show properly against the host site
- Keep `allowtransparency="true"` (already there)

## What stays the same
- All screen flows, recommendation logic, auth, Airtable — untouched
- Normal (non-embedded) mode — untouched
- The `source=extension` parameter fix — stays
- The close button postMessage fix — stays
