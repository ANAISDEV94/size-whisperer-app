/**
 * Altaana Content Script
 *
 * Detects the current brand from the page domain, infers a garment category
 * from the URL path, and injects the hosted panel UI inside an iframe.
 */

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

// ── Category inference from URL path keywords ─────────────────────
const CATEGORY_KEYWORDS = {
  tops: ["top", "blouse", "shirt", "tee", "tank", "cami", "bodysuit", "sweater", "hoodie", "pullover", "cardigan"],
  bottoms: ["pant", "jean", "denim", "trouser", "short", "skirt", "legging"],
  dresses: ["dress", "gown", "maxi", "mini", "midi"],
  outerwear: ["jacket", "coat", "blazer", "vest"],
  swimwear: ["swim", "bikini", "one-piece"],
  activewear: ["sports-bra", "workout", "active", "yoga"],
};

// ── Widget dimensions (must match FloatingWidget.tsx) ─────────────
const WIDGET_WIDTH = 180;
const WIDGET_HEIGHT = 41;
const PANEL_IFRAME_WIDTH = 440;

function detectBrandFromDOM() {
  const pdpSelectors = [
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
    "trending", "just_in", "category",
  ];

  for (const sel of pdpSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.textContent || el.getAttribute("content") || "").trim();
      if (text && text.length > 1 && text.length < 60) {
        const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        if (!skipWords.includes(slug)) {
          return text;
        }
      }
    }
  }
  return null;
}

function detectBrand() {
  const hostname = location.hostname.replace(/^www\./, "");

  if (DOMAIN_TO_BRAND[hostname]) {
    return DOMAIN_TO_BRAND[hostname];
  }

  for (const [domain, brandKey] of Object.entries(DOMAIN_TO_BRAND)) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      return brandKey;
    }
  }

  if (hostname.includes("revolve.com")) {
    const path = location.pathname.toLowerCase();
    for (const [prefix, brandKey] of Object.entries(REVOLVE_PATH_BRANDS)) {
      if (path.includes(prefix)) return brandKey;
    }

    const domBrand = detectBrandFromDOM();
    if (domBrand) {
      const slug = domBrand.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      console.log(`[Altaana] Revolve brand from DOM: "${domBrand}" → ${slug}`);
      const skipWords = ["new", "sale", "clothing", "dresses", "tops", "bottoms", "shoes", "accessories", "designers", "beauty", "womens", "mens"];
      if (!skipWords.includes(slug)) {
        return slug;
      }
    }

    const brandMatch = path.match(/^\/([a-z0-9-]+)\//);
    if (brandMatch) {
      const segment = brandMatch[1];
      const skipSegments = ["new", "r", "sale", "clothing", "dresses", "dp", "shop", "category", "womens", "mens"];
      if (!skipSegments.includes(segment)) {
        const slug = segment.replace(/-/g, "_");
        console.log(`[Altaana] Revolve brand slug detected: ${slug}`);
        return slug;
      }
    }
    return null;
  }

  return null;
}

function inferCategory() {
  const path = location.pathname.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (path.includes(kw)) return category;
    }
  }
  return "tops";
}

function isProductPage() {
  const path = location.pathname;
  if (/\/(product|dp|p|item|shop)\//i.test(path)) return true;
  if (/dp\.jsp/i.test(path)) return true;
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 2;
}

function injectPanel(brandKey) {
  if (document.getElementById("altaana-panel-frame")) return;

  const category = inferCategory();
  const productUrl = encodeURIComponent(location.href);
  const iframeSrc = `${PANEL_ORIGIN}/?brand=${brandKey}&category=${category}&url=${productUrl}`;

  const iframe = document.createElement("iframe");
  iframe.id = "altaana-panel-frame";
  iframe.src = iframeSrc;
  iframe.allow = "clipboard-write";

  // Start in WIDGET mode: small iframe covering only the widget pill
  iframe.style.cssText = `
    position: fixed;
    top: 50%;
    right: 0;
    width: ${WIDGET_WIDTH}px;
    height: ${WIDGET_HEIGHT}px;
    transform: translateY(-50%);
    border: none;
    z-index: 2147483647;
    background: transparent;
    pointer-events: auto;
    overflow: hidden;
  `;

  document.body.appendChild(iframe);
  console.log(`[Altaana] Injected panel for brand="${brandKey}" category="${category}"`);
}

// ── Listen for messages from the panel iframe ────────────────────
window.addEventListener("message", (event) => {
  if (event.origin !== PANEL_ORIGIN) return;

  if (event.data?.type === "ALTAANA_SCROLL_TO_SIZE") {
    scrollToSizeSelector();
  }

  // Panel tells us when it opens/closes so we can resize the iframe
  if (event.data?.type === "ALTAANA_PANEL_RESIZE") {
    const iframe = document.getElementById("altaana-panel-frame");
    if (!iframe) return;

    if (event.data.mode === "panel") {
      // Expand iframe to cover the full panel area
      iframe.style.width = PANEL_IFRAME_WIDTH + "px";
      iframe.style.height = "100vh";
      iframe.style.top = "0";
      iframe.style.transform = "none";
    } else {
      // Shrink back to widget size
      iframe.style.width = WIDGET_WIDTH + "px";
      iframe.style.height = WIDGET_HEIGHT + "px";
      iframe.style.top = "50%";
      iframe.style.transform = "translateY(-50%)";
    }
  }
});

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

  console.log("[Altaana] No size selector found on page");
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
  console.log("[Altaana] Scrolled to size selector");
}

// ── Main ──────────────────────────────────────────────────────────
(function main() {
  const brand = detectBrand();
  if (!brand) {
    console.log("[Altaana] No supported brand detected on", location.hostname);
    return;
  }

  if (!isProductPage()) {
    console.log("[Altaana] Not a product page, skipping injection");
    return;
  }

  injectPanel(brand);
})();
