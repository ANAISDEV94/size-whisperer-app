import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SUPPORTED_BRANDS, type AnchorBrand, type FitPreference, type UserProfile } from "@/types/panel";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// ── Size grouping helpers ──────────────────────────────────────
const LETTER_PATTERN = /^(XXXS|XXS|XS|S|M|L|XL|XXL|2X|3X|4X)$/i;
const EU_SIZES = new Set(["34","36","38","40","42","44","46","48"]);
const UK_SIZES = new Set(["4","6","8","10","12","14","16","18","20"]);
const DENIM_RANGE = { min: 22, max: 35 };

type SizeGroup = { label: string; sizes: string[] };

function classifySizes(sizes: string[], sizeScale: string): SizeGroup[] {
  if (sizeScale !== "mixed") {
    // For non-mixed scales, detect UK specifically
    if (sizeScale === "uk") {
      return [{ label: "UK", sizes }];
    }
    return [{ label: "", sizes }];
  }

  // Pre-scan: detect denim range by checking for odd numbers in 22-35
  const allNums = sizes.map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  const inDenimRange = allNums.filter(n => n >= DENIM_RANGE.min && n <= DENIM_RANGE.max);
  const hasOddInDenimRange = inDenimRange.some(n => n % 2 !== 0);
  const denimSet = hasOddInDenimRange ? new Set(inDenimRange.map(String)) : new Set<string>();

  // Detect if numeric sizes are UK (even numbers 4-20 with no 0/2)
  const nonLetterNonEU = sizes.filter(s => !LETTER_PATTERN.test(s) && !EU_SIZES.has(s) && !denimSet.has(s));
  const smallNums = nonLetterNonEU.map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n <= 20);
  const isUK = smallNums.length > 0 && smallNums.every(n => UK_SIZES.has(String(n))) && !smallNums.some(n => n === 0 || n === 2);

  const letters: string[] = [];
  const eu: string[] = [];
  const denim: string[] = [];
  const remaining: string[] = [];

  // First pass: classify letters, denim (before EU to handle overlap like 34), then EU
  for (const s of sizes) {
    if (LETTER_PATTERN.test(s)) {
      letters.push(s);
    } else if (denimSet.has(s)) {
      denim.push(s);
    } else if (EU_SIZES.has(s)) {
      eu.push(s);
    } else {
      remaining.push(s);
    }
  }

  // Second pass: classify remaining numbers
  const hasEU = eu.length > 0;
  const numeric: string[] = [];
  const euBrandSpecific: string[] = [];

  for (const s of remaining) {
    const n = parseInt(s, 10);
    if (isNaN(n)) continue;

    if (hasEU && n >= 1 && n <= 5 && s.length === 1) {
      euBrandSpecific.push(s);
    } else {
      numeric.push(s);
    }
  }

  const numericLabel = isUK ? "UK" : "US";
  const groups: SizeGroup[] = [];
  if (letters.length) groups.push({ label: "Letter", sizes: letters });
  if (numeric.length) groups.push({ label: numericLabel, sizes: numeric });
  if (eu.length) groups.push({ label: "EU", sizes: eu });
  if (denim.length) groups.push({ label: "Denim", sizes: denim });
  if (euBrandSpecific.length) groups.push({ label: "EU", sizes: euBrandSpecific });
  return groups.length ? groups : [{ label: "", sizes }];
}

interface ProfileScreenProps {
  onSave: (profile: UserProfile) => void;
  user?: User | null;
}

// Cache for brand sizes - use a mutable ref-like object that can be cleared
let brandSizesCache: Record<string, { sizes: string[]; sizeScale: string }> = {};

// Call this to invalidate the cache (e.g., after DB updates)
export function clearBrandSizesCache() {
  brandSizesCache = {};
}

const ProfileScreen = ({ onSave, user }: ProfileScreenProps) => {
  const [anchors, setAnchors] = useState<AnchorBrand[]>([{ brandKey: "", displayName: "", size: "" }]);
  const [fitPreference, setFitPreference] = useState<FitPreference>("true_to_size");
  const [openBrandIndex, setOpenBrandIndex] = useState<number | null>(null);
  const [openSizeIndex, setOpenSizeIndex] = useState<number | null>(null);
  const [brandSizes, setBrandSizes] = useState<Record<number, { sizes: string[]; sizeScale: string }>>({});

  // Fetch available sizes when a brand is selected
  const fetchSizesForBrand = async (brandDisplayName: string, index: number) => {
    const brandKey = brandDisplayName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    if (brandSizesCache[brandKey]) {
      setBrandSizes(prev => ({ ...prev, [index]: brandSizesCache[brandKey] }));
      return;
    }

    const { data } = await supabase
      .from("brand_catalog")
      .select("available_sizes, size_scale")
      .eq("display_name", brandDisplayName)
      .maybeSingle();

    const entry = {
      sizes: (data?.available_sizes as string[]) || [],
      sizeScale: (data?.size_scale as string) || "letter",
    };
    brandSizesCache[brandKey] = entry;
    setBrandSizes(prev => ({ ...prev, [index]: entry }));
  };

  const addAnchor = () => {
    if (anchors.length < 2) {
      setAnchors([...anchors, { brandKey: "", displayName: "", size: "" }]);
    }
  };

  const removeAnchor = (index: number) => {
    if (anchors.length > 1) {
      setAnchors(anchors.filter((_, i) => i !== index));
      setBrandSizes(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    }
  };

  const updateAnchor = (index: number, field: keyof AnchorBrand, value: string) => {
    const updated = [...anchors];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "displayName") {
      updated[index].brandKey = value.toLowerCase().replace(/[^a-z0-9]/g, "_");
      updated[index].size = ""; // Reset size when brand changes
      fetchSizesForBrand(value, index);
    }
    setAnchors(updated);
  };

  const canSave = anchors.every((a) => a.displayName && a.size);

  const handleSave = async () => {
    if (!canSave) return;
    const profile: UserProfile = { anchorBrands: anchors, fitPreference };

    if (user) {
      await supabase
        .from("profiles")
        .update({
          anchor_brands: anchors as unknown as Record<string, unknown>,
          fit_preference: fitPreference,
        } as Record<string, unknown>)
        .eq("user_id", user.id);
    }

    onSave(profile);
  };

  const fitOptions: { label: string; value: FitPreference }[] = [
    { label: "Fitted", value: "fitted" },
    { label: "Standard", value: "true_to_size" },
    { label: "Relaxed", value: "relaxed" },
  ];

  return (
    <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto">
      <h2 className="font-serif-display text-lg text-foreground mb-1">
        Your sizing profile
      </h2>
      <p className="text-xs text-primary mb-6">Takes about 60 seconds</p>

      <div className="space-y-4 mb-6">
        {anchors.map((anchor, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                {index === 0 ? "Your go-to brand" : "Second brand"}
              </label>
              {index > 0 && (
                <button onClick={() => removeAnchor(index)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Brand searchable popover */}
            <Popover open={openBrandIndex === index} onOpenChange={(open) => setOpenBrandIndex(open ? index : null)}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground hover:bg-panel-elevated transition-colors">
                  <span className={anchor.displayName ? "text-foreground" : "text-muted-foreground"}>
                    {anchor.displayName || "Select a brand"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 bg-card border-border z-[60]" align="start">
                <Command className="bg-transparent">
                  <CommandInput placeholder="Search brands..." className="text-sm" />
                  <CommandList>
                    <CommandEmpty>No brand found.</CommandEmpty>
                    <CommandGroup>
                      {SUPPORTED_BRANDS.map((brand) => (
                        <CommandItem
                          key={brand}
                          value={brand}
                          onSelect={() => {
                            updateAnchor(index, "displayName", brand);
                            setOpenBrandIndex(null);
                          }}
                          className="text-sm cursor-pointer"
                        >
                          {brand}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Size searchable popover */}
            <Popover open={openSizeIndex === index} onOpenChange={(open) => setOpenSizeIndex(open ? index : null)}>
              <PopoverTrigger asChild>
                <button
                  disabled={!anchor.displayName}
                  className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground hover:bg-panel-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={anchor.size ? "text-foreground" : "text-muted-foreground"}>
                    {anchor.size || "Select your usual size"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 bg-card border-border z-[60]" align="start">
                <Command className="bg-transparent">
                  <CommandInput placeholder="Search sizes..." className="text-sm" />
                  <CommandList>
                    <CommandEmpty>No size found.</CommandEmpty>
                    {(() => {
                      const entry = brandSizes[index];
                      if (!entry) return null;
                      const groups = classifySizes(entry.sizes, entry.sizeScale);
                      return groups.map((group) => (
                        <CommandGroup key={group.label} heading={group.label || undefined}>
                          {group.sizes.map((size) => (
                            <CommandItem
                              key={`${group.label}-${size}`}
                              value={`${group.label} ${size}`}
                              onSelect={() => {
                                updateAnchor(index, "size", size);
                                setOpenSizeIndex(null);
                              }}
                              className="text-sm cursor-pointer"
                            >
                              {size}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ));
                    })()}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        ))}
      </div>

      {anchors.length < 2 && (
        <button
          onClick={addAnchor}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mb-6"
        >
          <Plus className="w-3.5 h-3.5" />
          Add another brand (recommended)
        </button>
      )}

      <div className="mb-8">
        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-3">
          Fit preference
        </label>
        <div className="flex gap-2">
          {fitOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFitPreference(opt.value)}
              className={`flex-1 py-2 px-3 rounded-full text-xs transition-all ${
                fitPreference === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-panel-elevated"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={!canSave}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm mt-auto mx-auto"
        style={{ height: 48.5, width: 334 }}
      >
        Save my profile
      </Button>
    </div>
  );
};

export default ProfileScreen;
