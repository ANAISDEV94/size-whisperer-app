
# Global Design System Update: Optima Font, Button System, and Consistency

This plan applies the new design constraints across all screens in the extension panel. The changes are systematic -- updating the font family, removing all bold text, standardizing buttons, and ensuring the background color matches.

---

## 1. Font System: Switch from Playfair Display + Inter to Optima

**File: `src/index.css`**
- Remove the Google Fonts import for Playfair Display and Inter
- Set the base body font to `Optima, 'Lucida Grande', sans-serif`
- Update `.font-serif-display` class to also use Optima (removing Playfair Display) since all text uses the same font family now -- hierarchy is created via size, spacing, and color only

**Why Optima**: The design spec mandates Optima as the sole font with Regular weight only. No bold anywhere.

---

## 2. AuthScreen -- Background and Button Sizing Fix

**File: `src/components/panel/screens/AuthScreen.tsx`**
- Change modal background from `linear-gradient(#151213 -> #070506)` to a gradient based on `#0D0D0D` (e.g., `linear-gradient(180deg, #111010 0%, #0D0D0D 40%, #0A0909 100%)`)
- Change button heights from `56px` to `48.5px`
- Set button widths to `334px` (centered within the 404px modal with ~35px padding each side)
- Remove all `fontWeight: 500` -- set to `400` (Regular) everywhere
- Update heading `fontWeight` to `400` (already set, but confirm no `font-medium` or `font-semibold` classes leak in)

---

## 3. Panel Slide-in Screens -- Standardize Container and Typography

All screens rendered inside the `ExtensionPanel` slide-in drawer currently use a 340px-wide panel. These must be updated to match the 404x733 fixed container and the new design rules.

**File: `src/components/panel/ExtensionPanel.tsx`**
- Update the slide-in panel width from `w-[340px]` to `w-[404px]`
- Set fixed height to 733px with the same styling approach as the auth modal (right-aligned, 16px margin, rounded corners, `#0D0D0D` gradient background, teal border, shadow)
- Change from `fixed right-0 top-0 h-full` full-height panel to a vertically centered fixed-size modal matching the auth screen's container approach

**File: `src/components/panel/PanelHeader.tsx`**
- Remove `font-medium`, `font-semibold`, or any bold classes
- Ensure font is inherited (Optima Regular)

---

## 4. ProfileScreen -- Button and Typography Updates

**File: `src/components/panel/screens/ProfileScreen.tsx`**
- Remove `font-medium` from heading and all text
- Update "Save my profile" button: height `48.5px`, width `334px`, pill shape, Optima Regular
- Update fit preference pill buttons: remove `font-medium`
- Ensure all label text uses Optima Regular (no bold)

---

## 5. AnalyzingScreen -- Typography Update

**File: `src/components/panel/screens/AnalyzingScreen.tsx`**
- Remove `font-medium` from the "Analyzing fit..." heading
- Ensure Optima Regular is inherited

---

## 6. RecommendationScreen -- Button and Typography Updates

**File: `src/components/panel/screens/RecommendationScreen.tsx`**
- Remove `font-semibold` from the size heading
- Remove `font-medium` from the Keep button
- Standardize all three buttons (Size down / Keep / Size up) to `48.5px` height
- Ensure no bold text anywhere

---

## 7. ConfirmedScreen -- Button and Typography Updates

**File: `src/components/panel/screens/ConfirmedScreen.tsx`**
- Remove `font-medium` and `font-semibold` from all text
- Update "Add to cart with my size" button: height `48.5px`, width `334px`, pill, Optima Regular
- Remove `font-medium` from brand comparison items

---

## 8. FloatingWidget -- Font Update

**File: `src/components/panel/FloatingWidget.tsx`**
- Remove `fontWeight: 500` -- set to `400`
- Font will inherit Optima from the global CSS

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/index.css` | Replace fonts with Optima, remove Google Fonts import |
| `src/components/panel/screens/AuthScreen.tsx` | Background to #0D0D0D gradient, buttons 48.5px x 334px, font-weight 400 |
| `src/components/panel/ExtensionPanel.tsx` | Panel container: 404x733, right-aligned with margin, rounded corners, matching background |
| `src/components/panel/PanelHeader.tsx` | Remove bold classes |
| `src/components/panel/screens/ProfileScreen.tsx` | Remove bold, standardize button size |
| `src/components/panel/screens/AnalyzingScreen.tsx` | Remove bold |
| `src/components/panel/screens/RecommendationScreen.tsx` | Remove bold, standardize button heights |
| `src/components/panel/screens/ConfirmedScreen.tsx` | Remove bold, standardize button size |
| `src/components/panel/FloatingWidget.tsx` | Font-weight 400 |
