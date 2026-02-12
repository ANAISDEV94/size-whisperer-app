

# Fix Modal Bounce — Unified Panel Shell

## Problem
The modal "bounces" (slides in/out) between journey steps because:
- The **Auth screen** renders its own separate 404x733 container
- The **main panel** is wrapped in `AnimatePresence` and re-mounts with a slide animation each time

When a user completes auth, one modal unmounts and another slides in — causing a jarring double-animation.

## Solution
Merge everything into **one persistent modal container** that slides in once when opened and slides out once when closed. All screens (auth, profile, analyzing, recommendation, confirmed) render as content **inside** that single shell.

## Changes

### 1. Refactor `ExtensionPanel.tsx`
- Remove the separate `{showAuth && <AuthScreen />}` block
- Remove the separate `<AnimatePresence>` wrapper for the main panel
- Create a single `isOpen` state that covers both auth and main flows
- Use one `<AnimatePresence>` with one `<motion.div>` shell (the 404x733 container)
- Inside that shell, render `<PanelHeader>` + the current screen (auth OR profile/analyzing/recommendation/confirmed)
- The internal screen transitions use a simple opacity/crossfade (no slide), so content swaps feel smooth

### 2. Refactor `AuthScreen.tsx`
- Strip out the outer fixed-position container, border, background, and header (logo + close button) — those now live in the shared shell
- Export only the **inner content** (the sign-in/sign-up forms)
- The `onClose` prop is no longer needed here since the shared `PanelHeader` close button handles it

### 3. Update `handleOpen` logic
- When the user clicks "Find My Size", always open the single modal
- Set `panelState` to `"auth"` if not logged in / not guest, otherwise `"profile"`
- Remove the separate `showAuth` state entirely

### 4. Smooth internal transitions
- Wrap `renderScreen()` output in a simple `<AnimatePresence mode="wait">` with a short opacity fade (150-200ms)
- Each screen gets a unique `key` so React swaps them with a crossfade instead of a jump

## Result
- Modal slides in **once** on open, slides out **once** on close
- All screen changes (auth to profile to analyzing to confirmed) happen as smooth content fades inside the fixed shell
- "Find My Size" button reappears only after the modal fully closes

## Technical Detail

```text
Before:
  [FloatingWidget] -> click -> [AuthScreen (own modal)] -> auth done -> unmount -> [Panel (new modal, slides in)]

After:
  [FloatingWidget] -> click -> [Single Modal slides in]
                                  |-- auth screen (content)
                                  |-- profile screen (content)
                                  |-- analyzing screen (content)
                                  |-- recommendation screen (content)
                                  |-- confirmed screen (content)
                               [Single Modal slides out] -> [FloatingWidget]
```

Files modified:
- `src/components/panel/ExtensionPanel.tsx` — unified shell, removed dual modal logic
- `src/components/panel/screens/AuthScreen.tsx` — stripped to inner content only
