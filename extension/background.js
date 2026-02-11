/**
 * Altaana Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * 1. Relay auth tokens between extension storage and the hosted iframe panel
 * 2. Listen for messages from content script / popup
 */

const PANEL_ORIGIN = "https://size-whisperer-app.lovable.app";

// ── Auth token relay ──────────────────────────────────────────────
// The hosted panel can postMessage its Supabase session token to the
// extension for persistent storage, and the extension can push it
// back on subsequent page loads.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STORE_AUTH_TOKEN") {
    chrome.storage.local.set({ authToken: message.token }, () => {
      console.log("[Altaana BG] Auth token stored");
      sendResponse({ ok: true });
    });
    return true; // async response
  }

  if (message.type === "GET_AUTH_TOKEN") {
    chrome.storage.local.get("authToken", (result) => {
      sendResponse({ token: result.authToken || null });
    });
    return true;
  }

  if (message.type === "CLEAR_AUTH_TOKEN") {
    chrome.storage.local.remove("authToken", () => {
      console.log("[Altaana BG] Auth token cleared");
      sendResponse({ ok: true });
    });
    return true;
  }
});

// ── Listen for messages from the iframe (via content script proxy) ─
// Content script forwards postMessage events from the iframe to the
// background via chrome.runtime.sendMessage.
