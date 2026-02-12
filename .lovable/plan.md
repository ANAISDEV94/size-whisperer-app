

# Fix: Remove Black Rectangle Behind Panel in Embedded Mode

## Problem
The CSS for embedded mode (`src/index.css`, lines 1-10) forces `background: #0D0D0D` on the entire page (`html`, `body`, `#root`). This fills the whole iframe with a solid black color. Since the panel card has `borderRadius: 20`, the black page background is visible in the corners, creating the ugly black rectangle behind the floating panel.

In the correct version (your second screenshot), the page background is **transparent**, so the host website shows through everywhere except where the panel card is rendered.

## Solution
One simple CSS change: set the embedded mode background to `transparent` instead of `#0D0D0D`.

### File: `src/index.css` (lines 1-10)
Change the embedded mode styles from:
```css
background: #0D0D0D !important;
background-color: #0D0D0D !important;
```
to:
```css
background: transparent !important;
background-color: transparent !important;
```

This way:
- The iframe page itself is see-through (host site visible)
- The panel card keeps its own dark gradient background (`linear-gradient(180deg, #111010 0%, #0D0D0D 40%, #0A0909 100%)`) and rounded corners
- The rounded corners display correctly against the host page, exactly as in your second screenshot

## What stays the same
- Panel card dimensions, border, rounded corners, gradient -- all untouched
- Normal (non-embedded) mode -- untouched
- Close button postMessage logic -- untouched
- Extension `content.js` -- no changes needed (already set to `transparent`)

