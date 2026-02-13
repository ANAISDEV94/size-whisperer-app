/**
 * Altaana Content Script
 *
 * Detects the current brand from the page domain, infers a garment category
 * from the URL path, and injects the hosted panel UI inside an iframe.
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
// Handles &, +, punctuation, accented chars
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
  // Structured data (most reliable)
  '[itemprop="brand"] [itemprop="name"]',
  'meta[itemprop="brand"]',
  // Revolve-specific PDP selectors
  '.product-details .brand-name a',
  '.product-details .product-brand a',
  '.product-brand__link',
  'a[href*="/r/br/"]',
  'a[href*="/br/"]',
  // JSON-LD fallback handled separately
];

// ── Normalized category enum ──────────────────────────────────────
// Valid categories: tops, bottoms, dresses, denim, swim, outerwear
const CATEGORY_KEYWORDS = {
  denim: ["jean", "denim", "selvage", "selvedge", "rigid-denim", "raw-denim"],
  swim: ["swim", "bikini", "one-piece", "swimsuit", "swimwear"],
  dresses: ["dress", "gown", "maxi-dress", "mini-dress", "midi-dress", "romper", "jumpsuit"],
  outerwear: ["jacket", "coat", "blazer", "vest", "puffer", "parka", "trench"],
  bottoms: ["pant", "trouser", "short", "skirt", "legging", "cargo", "chino", "jogger"],
  tops: ["top", "blouse", "shirt", "tee", "tank", "cami", "bodysuit", "sweater", "hoodie", "pullover", "cardigan", "crop-top", "bra", "sports-bra"],
};

// Keywords to scan in DOM text for category signals
const DOM_CATEGORY_SIGNALS = {
  denim: ["denim", "jeans", "jean", "selvage", "selvedge", "raw denim", "stretch denim", "rigid denim"],
  swim: ["swimwear", "bikini", "swim", "one-piece", "swimsuit", "coverup"],
  dresses: ["dress", "gown", "romper", "jumpsuit"],
  outerwear: ["jacket", "coat", "blazer", "puffer", "parka", "trench"],
  bottoms: ["pant", "trouser", "shorts", "skirt", "leggings", "jogger", "cargo"],
  tops: ["top", "blouse", "shirt", "tee", "tank", "cami", "bodysuit", "sweater", "hoodie", "cardigan", "sports bra", "bralette"],
};

// ── Widget dimensions (must match FloatingWidget.tsx) ─────────────
const WIDGET_WIDTH = 180;
const WIDGET_HEIGHT = 41;
const PANEL_IFRAME_WIDTH = 440;

function detectBrandFromDOM() {
  // Strategy 1: Try Revolve-specific selectors first (on Revolve)
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

  // Strategy 2: JSON-LD structured data
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

// Returns { brandKey, brandSource } where brandSource is "domain"|"path"|"dom"|"url_segment"|"fallback"
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

    // 1. Known path prefix mapping
    for (const [prefix, brandKey] of Object.entries(REVOLVE_PATH_BRANDS)) {
      if (path.includes(prefix)) {
        log("Revolve brand from path prefix:", prefix, "→", brandKey);
        return { brandKey, brandSource: "path" };
      }
    }

    // 2. DOM-based detection (selectors + JSON-LD)
    const domBrand = detectBrandFromDOM();
    if (domBrand) {
      const slug = slugifyBrandName(domBrand);
      log(`Revolve brand from DOM: "${domBrand}" → ${slug}`);
      return { brandKey: slug, brandSource: "dom" };
    }

    // 3. URL first-segment heuristic
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

    // 4. Fallback — can't determine brand
    log("Revolve brand detection failed, using fallback");
    return { brandKey: "revolve", brandSource: "fallback" };
  }

  return null;
}

function inferCategory() {
  // 1. URL path keywords (highest priority — most reliable)
  const path = location.pathname.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (path.includes(kw)) {
        log("Category from URL:", category, "(keyword:", kw + ")");
        return category;
      }
    }
  }

  // 2. Breadcrumb / category nav text
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

  // 3. Product details / description text
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

function injectPanel(brandKey, brandSource) {
  // Prevent duplicate injection
  if (document.getElementById("altaana-root")) {
    log("Root already exists, skipping injection");
    return;
  }

  const category = inferCategory();
  log("Detected category:", category);

  const productUrl = encodeURIComponent(location.href);
  let iframeSrc = `${PANEL_ORIGIN}/?brand=${brandKey}&category=${category}&url=${productUrl}&source=extension`;
  if (brandSource) {
    iframeSrc += `&brand_source=${brandSource}`;
  }

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
      // Toggle iframe visibility by resizing to panel mode
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
}

// ── Listen for messages from the panel iframe ────────────────────
window.addEventListener("message", (event) => {
  if (event.origin !== PANEL_ORIGIN) return;
  log("postMessage received:", event.data?.type);

  if (event.data?.type === "ALTAANA_SCROLL_TO_SIZE") {
    scrollToSizeSelector();
  }

  // Panel tells us when it opens/closes so we can resize the iframe
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
