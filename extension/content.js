/**
 * Altaana Content Script
 *
 * Detects the current brand from the page domain, infers a garment category
 * from the URL path, and injects the hosted panel UI inside an iframe.
 */

const PANEL_ORIGIN = "https://size-whisperer-app.lovable.app";

// ── Domain → brand key mapping ────────────────────────────────────
// Brands that share revolve.com are handled separately via URL path.
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

// Revolve hosts multiple brands – detect from URL path or breadcrumb brand name
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

function detectBrandFromDOM() {
  // Try to find brand name from common PDP elements on Revolve
  // Revolve shows brand name in a specific element near the product title
  const selectors = [
    // Revolve brand link near product title
    '.product-brand a',
    '.brand-name a',
    '[data-comp="ProductBrand"] a',
    'a[href*="/br/"]',
    // Generic brand selectors
    '.product-brand',
    '.brand-name',
    '[itemprop="brand"]',
    'meta[itemprop="brand"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.textContent || el.getAttribute("content") || "").trim();
      if (text && text.length > 1 && text.length < 60) {
        return text;
      }
    }
  }
  return null;
}

function detectBrand() {
  const hostname = location.hostname.replace(/^www\./, "");

  // Check exact hostname first (handles subdomains like us.balmain.com)
  if (DOMAIN_TO_BRAND[hostname]) {
    return DOMAIN_TO_BRAND[hostname];
  }

  // Check if hostname ends with a known domain
  for (const [domain, brandKey] of Object.entries(DOMAIN_TO_BRAND)) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      return brandKey;
    }
  }

  // Revolve: detect brand from URL path or DOM
  if (hostname.includes("revolve.com")) {
    const path = location.pathname.toLowerCase();
    // Check known brand paths first
    for (const [prefix, brandKey] of Object.entries(REVOLVE_PATH_BRANDS)) {
      if (path.includes(prefix)) return brandKey;
    }

    // Try scraping brand name from the page DOM
    const domBrand = detectBrandFromDOM();
    if (domBrand) {
      // Convert display name to slug: "Norma Kamali" → "norma_kamali"
      const slug = domBrand.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      console.log(`[Altaana] Revolve brand from DOM: "${domBrand}" → ${slug}`);
      // Skip generic words that aren't brand names
      const skipWords = ["new", "sale", "clothing", "dresses", "tops", "bottoms", "shoes", "accessories", "designers", "beauty", "womens", "mens"];
      if (!skipWords.includes(slug)) {
        return slug;
      }
    }

    // Try URL path as last resort, but skip common non-brand segments
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
  return "tops"; // default fallback
}

function isProductPage() {
  // Heuristic: product pages typically have /product/, /dp/, or long slug paths
  const path = location.pathname;
  if (/\/(product|dp|p|item|shop)\//i.test(path)) return true;
  // Revolve PDP pattern: /r/dp.jsp or similar with product detail
  if (/dp\.jsp/i.test(path)) return true;
  // Fallback: if path has 3+ segments it's likely a PDP
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 2;
}

function injectPanel(brandKey) {
  // Don't inject twice
  if (document.getElementById("altaana-panel-frame")) return;

  const category = inferCategory();
  const productUrl = encodeURIComponent(location.href);
  const iframeSrc = `${PANEL_ORIGIN}/?brand=${brandKey}&category=${category}&url=${productUrl}`;

  const iframe = document.createElement("iframe");
  iframe.id = "altaana-panel-frame";
  iframe.src = iframeSrc;
  iframe.allow = "clipboard-write";
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 440px;
    height: 100vh;
    border: none;
    z-index: 2147483647;
    background: transparent;
    pointer-events: auto;
  `;

  document.body.appendChild(iframe);
  console.log(`[Altaana] Injected panel for brand="${brandKey}" category="${category}"`);
}

// ── Listen for messages from the panel iframe ────────────────────
window.addEventListener("message", (event) => {
  if (event.origin !== PANEL_ORIGIN) return;

  if (event.data?.type === "ALTAANA_SCROLL_TO_SIZE") {
    // Find the size selector on the host page and scroll to it
    const sizeSelectors = [
      // Common size selector elements across e-commerce sites
      '[class*="size-selector"]',
      '[class*="sizeSelector"]',
      '[class*="size-picker"]',
      '[class*="sizePicker"]',
      '[class*="size-buttons"]',
      '[data-testid*="size"]',
      '[aria-label*="size" i]',
      '[aria-label*="Size" i]',
      'fieldset:has(legend)',
      // Revolve specific
      '#sizeSelect',
      '.sizes-list',
      '.product-sizes',
      // Generic patterns
      'select[name*="size" i]',
      'div:has(> button:nth-child(3))', // grid of size buttons
    ];

    // Also try finding by text content "Size:" label
    const labels = document.querySelectorAll("label, span, p, div, h3, h4");
    for (const label of labels) {
      if (/^size:?\s*$/i.test(label.textContent?.trim() || "")) {
        label.scrollIntoView({ behavior: "smooth", block: "center" });
        // Flash highlight
        label.style.outline = "2px solid #00CED1";
        setTimeout(() => { label.style.outline = ""; }, 2000);
        console.log("[Altaana] Scrolled to size label");
        return;
      }
    }

    for (const sel of sizeSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "2px solid #00CED1";
        setTimeout(() => { el.style.outline = ""; }, 2000);
        console.log(`[Altaana] Scrolled to size selector: ${sel}`);
        return;
      }
    }

    console.log("[Altaana] No size selector found on page");
  }
});

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
