/**
 * Altaana Content Script
 *
 * Detects the current brand from the page domain, infers a garment category
 * from the URL path, and injects the hosted panel UI inside an iframe.
 * Captures garment images client-side as base64 PNG via canvas.
 */

// ── Debug flag – set to false to silence all [Altaana] console logs ──
const DEBUG = true;
function log(...args) { if (DEBUG) console.log("[Altaana]", ...args); }

const PANEL_ORIGIN = "https://size-whisperer-app.lovable.app";

// ── Domain → brand key mapping ────────────────────────────────────
const DOMAIN_TO_BRAND = {
  "shopcsb.com": "csb",
  "7forallmankind.com": "seven_for_all_mankind",
  "maison-alaia.com": "alaia",
  "aliceandolivia.com": "alice_and_olivia",
  "aloyoga.com": "alo_yoga",
  "aritzia.com": "aritzia",
  "us.balmain.com": "balmain",
  "usa.bardot.com": "bardot",
  "bronxandbanco.com": "bronx_and_banco",
  "carolinaherrera.com": "carolina_herrera",
  "cultgaia.com": "cult_gaia",
  "davidkoma.com": "david_koma",
  "dolcegabbana.com": "dolce_and_gabbana",
  "forloveandlemons.com": "for_love_and_lemons",
  "gucci.com": "gucci",
  "loversandfriends.us": "lovers_and_friends",
  "lululemon.com": "lululemon",
  "motherdenim.com": "mother",
  "nike.com": "nikeskims",
  "skims.com": "skims",
  "normakamali.com": "norma_kamali",
  "prada.com": "prada",
  "rabanne.com": "rabanne",
  "thereformation.com": "reformation",
  "retrofete.com": "retrofete",
  "stellamccartney.com": "stella_mccartney",
  "superdown.com": "superdown",
  "tomford.com": "tom_ford",
  "tomfordfashion.com": "tom_ford",
  "torrid.com": "torrid",
  "valentino.com": "valentino",
  "versace.com": "versace",
  "victoriabeckham.com": "victoria_beckham",
  "zimmermann.com": "zimmermann",
  "andorcollective.com": "and_or_collective",
};

const REVOLVE_PATH_BRANDS = {
  "/csb/": "csb",
  "/helsa/": "helsa",
  "/house-of-harlow-1960/": "house_of_harlow_1960",
  "/michael-costello/": "michael_costello",
  "/retrofete/": "retrofete",
  "/revolve-denim/": "revolve_denim",
  "/superdown/": "superdown",
  "/lovers-friends/": "lovers_and_friends",
  "/for-love-lemons/": "for_love_and_lemons",
  "/norma-kamali/": "norma_kamali",
  "/alice-olivia/": "alice_and_olivia",
  "/bronx-and-banco/": "bronx_and_banco",
  "/cult-gaia/": "cult_gaia",
  "/bardot/": "bardot",
  "/david-koma/": "david_koma",
};

// ── Display name → brandKey normalization ─────────────────────────
function slugifyBrandName(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "_and_")
    .replace(/\+/g, "_and_")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_+/g, "_");
}

// ── Revolve-specific DOM brand selectors (ordered by reliability) ─
const REVOLVE_BRAND_SELECTORS = [
  '[itemprop="brand"] [itemprop="name"]',
  'meta[itemprop="brand"]',
  '.product-details .brand-name a',
  '.product-details .product-brand a',
  '.product-brand__link',
  'a[href*="/r/br/"]',
  'a[href*="/br/"]',
];

// ── Normalized category enum ──────────────────────────────────────
const CATEGORY_KEYWORDS = {
  denim: ["jean", "denim", "selvage", "selvedge", "rigid-denim", "raw-denim"],
  swim: ["swim", "bikini", "one-piece", "swimsuit", "swimwear"],
  dresses: ["dress", "gown", "maxi-dress", "mini-dress", "midi-dress", "romper", "jumpsuit"],
  outerwear: ["jacket", "coat", "blazer", "vest", "puffer", "parka", "trench"],
  bottoms: ["pant", "trouser", "short", "skirt", "legging", "cargo", "chino", "jogger"],
  tops: ["top", "blouse", "shirt", "tee", "tank", "cami", "bodysuit", "sweater", "hoodie", "pullover", "cardigan", "crop-top", "bra", "sports-bra"],
};

const DOM_CATEGORY_SIGNALS = {
  denim: ["denim", "jeans", "jean", "selvage", "selvedge", "raw denim", "stretch denim", "rigid denim"],
  swim: ["swimwear", "bikini", "swim", "one-piece", "swimsuit", "coverup"],
  dresses: ["dress", "gown", "romper", "jumpsuit"],
  outerwear: ["jacket", "coat", "blazer", "puffer", "parka", "trench"],
  bottoms: ["pant", "trouser", "shorts", "skirt", "leggings", "jogger", "cargo"],
  tops: ["top", "blouse", "shirt", "tee", "tank", "cami", "bodysuit", "sweater", "hoodie", "cardigan", "sports bra", "bralette"],
};

// ── Widget dimensions ─────────────────────────────────────────────
const WIDGET_WIDTH = 180;
const WIDGET_HEIGHT = 41;
const PANEL_IFRAME_WIDTH = 440;

function detectBrandFromDOM() {
  const isRevolve = location.hostname.replace(/^www\./, "").includes("revolve.com");
  const selectors = isRevolve ? REVOLVE_BRAND_SELECTORS : [
    '.product-details .brand-name a',
    '.product-details .product-brand a',
    '.pdp-brand a',
    '.product-brand__link',
    '.product-details a[href*="/r/br/"]',
    '.product-name a[href*="/br/"]',
    '[itemprop="brand"] [itemprop="name"]',
    'meta[itemprop="brand"]',
    '[itemprop="brand"]',
    '.product-detail .brand-name',
    '.product-info .brand-name',
    '.pdp-header .brand-name',
  ];

  const skipWords = [
    "new", "sale", "clothing", "dresses", "tops", "bottoms", "shoes",
    "accessories", "designers", "beauty", "womens", "mens", "what_s_new",
    "best_sellers", "shop", "home", "view_all", "collections", "brands",
    "trending", "just_in", "category", "revolve",
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.textContent || el.getAttribute("content") || "").trim();
      if (text && text.length > 1 && text.length < 60) {
        const slug = slugifyBrandName(text);
        if (!skipWords.includes(slug)) {
          log("Brand from DOM selector:", sel, "→", text, "→", slug);
          return text;
        }
      }
    }
  }

  if (isRevolve) {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        const json = JSON.parse(script.textContent);
        const brand = json?.brand?.name || json?.brand;
        if (brand && typeof brand === "string" && brand.length > 1) {
          const slug = slugifyBrandName(brand);
          if (!skipWords.includes(slug)) {
            log("Brand from JSON-LD:", brand, "→", slug);
            return brand;
          }
        }
      }
    } catch (e) { /* ignore parse errors */ }
  }

  return null;
}

function detectBrand() {
  const hostname = location.hostname.replace(/^www\./, "");

  if (DOMAIN_TO_BRAND[hostname]) {
    return { brandKey: DOMAIN_TO_BRAND[hostname], brandSource: "domain" };
  }

  for (const [domain, brandKey] of Object.entries(DOMAIN_TO_BRAND)) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      return { brandKey, brandSource: "domain" };
    }
  }

  if (hostname.includes("revolve.com")) {
    const path = location.pathname.toLowerCase();

    for (const [prefix, brandKey] of Object.entries(REVOLVE_PATH_BRANDS)) {
      if (path.includes(prefix)) {
        log("Revolve brand from path prefix:", prefix, "→", brandKey);
        return { brandKey, brandSource: "path" };
      }
    }

    const domBrand = detectBrandFromDOM();
    if (domBrand) {
      const slug = slugifyBrandName(domBrand);
      log(`Revolve brand from DOM: "${domBrand}" → ${slug}`);
      return { brandKey: slug, brandSource: "dom" };
    }

    const brandMatch = path.match(/^\/([a-z0-9-]+)\//);
    if (brandMatch) {
      const segment = brandMatch[1];
      const skipSegments = ["new", "r", "sale", "clothing", "dresses", "dp", "shop", "category", "womens", "mens"];
      if (!skipSegments.includes(segment)) {
        const slug = segment.replace(/-/g, "_");
        log("Revolve brand from URL segment:", slug);
        return { brandKey: slug, brandSource: "url_segment" };
      }
    }

    log("Revolve brand detection failed, using fallback");
    return { brandKey: "revolve", brandSource: "fallback" };
  }

  return null;
}

function inferCategory() {
  const path = location.pathname.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (path.includes(kw)) {
        log("Category from URL:", category, "(keyword:", kw + ")");
        return category;
      }
    }
  }

  const breadcrumbSelectors = [
    'nav[aria-label="breadcrumb"]',
    '.breadcrumb', '.breadcrumbs',
    '[class*="breadcrumb"]',
    '.product-category',
    '[itemprop="category"]',
  ];
  for (const sel of breadcrumbSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.textContent || "").toLowerCase();
      for (const [category, signals] of Object.entries(DOM_CATEGORY_SIGNALS)) {
        for (const signal of signals) {
          if (text.includes(signal)) {
            log("Category from breadcrumb:", category, "(signal:", signal + ")");
            return category;
          }
        }
      }
    }
  }

  const detailSelectors = [
    '.product-details', '.product-description',
    '[class*="product-info"]', '[class*="pdp-"]',
    '.product-name', 'h1',
    '[itemprop="name"]', '[itemprop="description"]',
  ];
  for (const sel of detailSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.textContent || "").toLowerCase();
      for (const [category, signals] of Object.entries(DOM_CATEGORY_SIGNALS)) {
        for (const signal of signals) {
          if (text.includes(signal)) {
            log("Category from product details:", category, "(signal:", signal + ")");
            return category;
          }
        }
      }
    }
  }

  log("Category detection: no match, defaulting to tops");
  return "tops";
}

function isProductPage() {
  const path = location.pathname;
  if (/\/(product|dp|p|item|shop)\//i.test(path)) return true;
  if (/dp\.jsp/i.test(path)) return true;
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 2;
}

// ── Garment image extraction (returns URL) ──────────────────────
function extractGarmentImage() {
  // 1. og:image
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) {
    const url = ogImg.getAttribute("content");
    if (url) { log("Garment image from og:image:", url); return url; }
  }
  // 2. product:image or itemprop image
  const productImg = document.querySelector('meta[property="product:image"]') || document.querySelector('[itemprop="image"]');
  if (productImg) {
    const url = productImg.getAttribute("content") || productImg.getAttribute("src");
    if (url) { log("Garment image from itemprop/product:image:", url); return url; }
  }
  // 3. JSON-LD Product image
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const json = JSON.parse(script.textContent);
      const img = json?.image;
      if (img) {
        const url = Array.isArray(img) ? img[0] : (typeof img === "string" ? img : img?.url);
        if (url) { log("Garment image from JSON-LD:", url); return url; }
      }
    }
  } catch { /* ignore */ }
  // 4. Largest gallery image
  const imgs = document.querySelectorAll("img");
  let best = null;
  let bestArea = 0;
  for (const img of imgs) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < 200 || h < 200) continue;
    const area = w * h;
    if (area > bestArea) { bestArea = area; best = img; }
  }
  if (best) { log("Garment image from largest img:", best.src); return best.src; }
  log("No garment image found");
  return null;
}

// ── Capture image as PNG base64 via canvas ──────────────────────
async function captureImageAsBase64(imgUrl) {
  if (!imgUrl) return { base64: null, method: "failed" };

  // Resolve to absolute URL
  const absoluteUrl = new URL(imgUrl, location.href).href;
  log("captureImageAsBase64: attempting", absoluteUrl);

  // Strategy 1: Find matching DOM <img> and draw to canvas
  try {
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
      if (img.src === absoluteUrl || img.currentSrc === absoluteUrl ||
          img.src === imgUrl || img.currentSrc === imgUrl) {
        // Found matching element — try drawing to canvas
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          // toDataURL will throw if canvas is tainted (cross-origin)
          const dataUrl = canvas.toDataURL("image/png");
          log("captureImageAsBase64: DOM canvas success, length:", dataUrl.length);
          return { base64: dataUrl, method: "dom_canvas" };
        }
      }
    }
    log("captureImageAsBase64: no matching DOM img found or not loaded");
  } catch (e) {
    log("captureImageAsBase64: DOM canvas failed (likely tainted):", e.message);
  }

  // Strategy 2: fetch as blob → ImageBitmap → canvas
  try {
    const res = await fetch(absoluteUrl);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    log("captureImageAsBase64: fetch+canvas success, length:", dataUrl.length);
    return { base64: dataUrl, method: "fetch_canvas" };
  } catch (e) {
    log("captureImageAsBase64: fetch+canvas failed:", e.message);
  }

  log("captureImageAsBase64: all methods failed");
  return { base64: null, method: "failed" };
}

function injectPanel(brandKey, brandSource) {
  if (document.getElementById("altaana-root")) {
    log("Root already exists, skipping injection");
    return;
  }

  const category = inferCategory();
  log("Detected category:", category);

  const productUrl = encodeURIComponent(location.href);
  // NOTE: garment_image is NO LONGER passed as URL param — sent via postMessage instead
  let iframeSrc = `${PANEL_ORIGIN}/?brand=${brandKey}&category=${category}&url=${productUrl}&source=extension`;
  if (brandSource) {
    iframeSrc += `&brand_source=${brandSource}`;
  }

  // Extract garment image URL (for base64 capture)
  const garmentImgUrl = extractGarmentImage();

  // ── 1. Root container ──────────────────────────────────────────
  const root = document.createElement("div");
  root.id = "altaana-root";
  root.setAttribute("data-altaana-root", "true");
  root.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;
  document.body.appendChild(root);
  log("Injected root container #altaana-root");

  // ── 2. Floating widget button ──────────────────────────────────
  const widget = document.createElement("div");
  widget.id = "altaana-widget";
  widget.setAttribute("data-altaana-widget", "true");
  widget.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: ${WIDGET_WIDTH}px;
    height: ${WIDGET_HEIGHT}px;
    z-index: 2147483647;
    pointer-events: auto;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    border-radius: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    user-select: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  `;
  widget.textContent = "Find My Size";
  widget.addEventListener("mouseenter", () => {
    widget.style.transform = "scale(1.05)";
    widget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.3)";
  });
  widget.addEventListener("mouseleave", () => {
    widget.style.transform = "scale(1)";
    widget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
  });
  widget.addEventListener("click", () => {
    const frame = document.getElementById("altaana-panel-frame");
    if (frame) {
      const isPanel = frame.style.height === "100vh";
      if (isPanel) {
        frame.style.width = "0px";
        frame.style.height = "0px";
        frame.style.pointerEvents = "none";
      } else {
        frame.style.width = PANEL_IFRAME_WIDTH + "px";
        frame.style.height = "100vh";
        frame.style.pointerEvents = "auto";
      }
    }
  });
  root.appendChild(widget);
  log("Injected widget button [data-altaana-widget]");

  // ── 3. Panel iframe (hidden initially) ─────────────────────────
  const iframe = document.createElement("iframe");
  iframe.id = "altaana-panel-frame";
  iframe.setAttribute("data-altaana-iframe", "true");
  iframe.src = iframeSrc;
  iframe.allow = "clipboard-write";
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border: none;
    z-index: 2147483647;
    background: transparent;
    pointer-events: none;
    overflow: hidden;
  `;
  root.appendChild(iframe);
  log("Injected iframe [data-altaana-iframe], src:", iframeSrc);

  // ── 4. Capture garment image as base64 and send via postMessage ─
  if (garmentImgUrl) {
    iframe.addEventListener("load", async () => {
      log("Iframe loaded, starting garment image capture...");
      const result = await captureImageAsBase64(garmentImgUrl);
      const message = {
        type: "ALTAANA_GARMENT_IMAGE",
        garmentImageBase64: result.base64,
        extractionMethod: result.method,
        sourceUrl: garmentImgUrl,
      };
      iframe.contentWindow.postMessage(message, PANEL_ORIGIN);
      log("Sent ALTAANA_GARMENT_IMAGE via postMessage, method:", result.method,
          "size:", result.base64 ? Math.round(result.base64.length / 1024) + "KB" : "null");
    });
  } else {
    log("No garment image URL found, skipping base64 capture");
  }
}

// ── Listen for messages from the panel iframe ────────────────────
window.addEventListener("message", (event) => {
  if (event.origin !== PANEL_ORIGIN) return;
  log("postMessage received:", event.data?.type);

  if (event.data?.type === "ALTAANA_SCROLL_TO_SIZE") {
    scrollToSizeSelector();
  }

  if (event.data?.type === "ALTAANA_PANEL_RESIZE") {
    const iframe = document.getElementById("altaana-panel-frame");
    const widget = document.getElementById("altaana-widget");
    if (!iframe) return;

    if (event.data.mode === "panel") {
      iframe.style.width = PANEL_IFRAME_WIDTH + "px";
      iframe.style.height = "100vh";
      iframe.style.top = "0";
      iframe.style.pointerEvents = "auto";
      if (widget) widget.style.display = "none";
      log("Panel expanded");
    } else {
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.pointerEvents = "none";
      if (widget) widget.style.display = "flex";
      log("Panel collapsed, widget shown");
    }
  }
});
log("postMessage listener attached");

function scrollToSizeSelector() {
  const hostname = location.hostname.replace(/^www\./, "");

  const SITE_SELECTORS = {
    "tomford.com": ['[data-testid="size-selector"]', '.product-sizes', 'select[name*="size" i]', '.size-selector', '#size-select', '.product-form select'],
    "tomfordfashion.com": ['[data-testid="size-selector"]', '.product-sizes', 'select[name*="size" i]', '.size-selector', '#size-select', '.product-form select'],
    "revolve.com": ['#sizeSelect', '.sizes-list', '.product-sizes', '[class*="size-selector"]'],
    "aloyoga.com": ['[data-testid*="size"]', '.product-sizes', '[class*="size-selector"]'],
    "thereformation.com": ['[class*="size-selector"]', '[data-testid*="size"]'],
  };

  let siteSelectors = [];
  for (const [domain, sels] of Object.entries(SITE_SELECTORS)) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      siteSelectors = sels;
      break;
    }
  }

  const genericSelectors = [
    '[class*="size-selector"]',
    '[class*="sizeSelector"]',
    '[class*="size-picker"]',
    '[class*="sizePicker"]',
    '[data-testid*="size"]',
    '[aria-label*="size" i]',
    'select[name*="size" i]',
    '#sizeSelect',
    '.sizes-list',
    '.product-sizes',
  ];

  const allSelectors = [...siteSelectors, ...genericSelectors];
  const mainContent = document.querySelector('main, [role="main"], .product-detail, .pdp-container, .product-page') || document.body;

  for (const sel of allSelectors) {
    const el = mainContent.querySelector(sel);
    if (el && isInProductArea(el)) {
      highlightAndScroll(el);
      return;
    }
  }

  const addToCartBtn = findAddToCartButton();
  const sizeLabels = findSizeLabels(mainContent);

  if (sizeLabels.length > 0) {
    let best = sizeLabels[0];
    if (addToCartBtn) {
      const cartRect = addToCartBtn.getBoundingClientRect();
      let bestDist = Infinity;
      for (const label of sizeLabels) {
        const rect = label.getBoundingClientRect();
        const dist = Math.abs(rect.top - cartRect.top);
        if (dist < bestDist) {
          bestDist = dist;
          best = label;
        }
      }
    }
    highlightAndScroll(best);
    return;
  }

  log("No size selector found on page");
}

function isInProductArea(el) {
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  if (rect.top > viewportHeight * 3) return false;
  let parent = el.closest('[class*="recommend"], [class*="similar"], [class*="also-like"], [class*="you-may"], footer');
  return !parent;
}

function findAddToCartButton() {
  const buttons = document.querySelectorAll("button, a, input[type='submit']");
  for (const btn of buttons) {
    const text = (btn.textContent || btn.value || "").trim().toLowerCase();
    if (/add to (cart|bag)|buy now/i.test(text)) return btn;
  }
  return null;
}

function findSizeLabels(container) {
  const labels = container.querySelectorAll("label, span, p, div, h3, h4, legend");
  const results = [];
  for (const label of labels) {
    const text = (label.textContent || "").trim();
    if (/^size:?\s*$/i.test(text) || /^select\s+size/i.test(text) || /^choose\s+(a\s+)?size/i.test(text)) {
      if (isInProductArea(label)) {
        results.push(label);
      }
    }
  }
  return results;
}

function highlightAndScroll(el) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.outline = "2px solid #00CED1";
  el.style.outlineOffset = "4px";
  setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 2500);
  log("Scrolled to size selector");
}

// ── Main ──────────────────────────────────────────────────────────
(function main() {
  log("Content script started");
  log("URL:", location.href);
  log("Hostname:", location.hostname);

  const result = detectBrand();
  if (!result) {
    log("No supported brand detected on", location.hostname);
    return;
  }
  log("Detected brand:", result.brandKey, "(source:", result.brandSource + ")");

  if (!isProductPage()) {
    log("Not a product page, skipping injection");
    return;
  }

  injectPanel(result.brandKey, result.brandSource);
  log("Injection complete ✓");
})();
