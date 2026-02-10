import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SUPPORTED_BRANDS, ALL_SIZES, type AnchorBrand, type FitPreference, type UserProfile } from "@/types/panel";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Plus, X } from "lucide-react";

interface ProfileScreenProps {
  onSave: (profile: UserProfile) => void;
}

const ProfileScreen = ({ onSave }: ProfileScreenProps) => {
  const [anchors, setAnchors] = useState<AnchorBrand[]>([{ brandKey: "", displayName: "", size: "" }]);
  const [fitPreference, setFitPreference] = useState<FitPreference>("true_to_size");
  const [openBrandIndex, setOpenBrandIndex] = useState<number | null>(null);

  const addAnchor = () => {
    if (anchors.length < 2) {
      setAnchors([...anchors, { brandKey: "", displayName: "", size: "" }]);
    }
  };

  const removeAnchor = (index: number) => {
    if (anchors.length > 1) {
      setAnchors(anchors.filter((_, i) => i !== index));
    }
  };

  const updateAnchor = (index: number, field: keyof AnchorBrand, value: string) => {
    const updated = [...anchors];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "displayName") {
      updated[index].brandKey = value.toLowerCase().replace(/[^a-z0-9]/g, "_");
    }
    setAnchors(updated);
  };

  const canSave = anchors.every((a) => a.displayName && a.size);

  const handleSave = () => {
    if (canSave) {
      onSave({ anchorBrands: anchors, fitPreference });
    }
  };

  const fitOptions: { label: string; value: FitPreference }[] = [
    { label: "Fitted", value: "fitted" },
    { label: "True to size", value: "true_to_size" },
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

            <Popover open={openBrandIndex === index} onOpenChange={(open) => setOpenBrandIndex(open ? index : null)}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground hover:bg-panel-elevated transition-colors">
                  <span className={anchor.displayName ? "text-foreground" : "text-muted-foreground"}>
                    {anchor.displayName || "Select a brand"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 bg-card border-border" align="start">
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

            <Select value={anchor.size} onValueChange={(val) => updateAnchor(index, "size", val)}>
              <SelectTrigger className="bg-secondary border-border text-sm">
                <SelectValue placeholder="Select your usual size" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {ALL_SIZES.map((size) => (
                  <SelectItem key={size} value={size} className="text-sm">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
