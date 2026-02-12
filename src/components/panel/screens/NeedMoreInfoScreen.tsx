import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NeedMoreInfoScreenProps {
  confidenceScore: number;
  confidenceReasons: string[];
  onSubmitMeasurement: (key: string, value: string) => void;
  isLoading?: boolean;
}

const MEASUREMENT_OPTIONS = [
  { key: "bust", label: "Bust", placeholder: "e.g. 34" },
  { key: "waist", label: "Waist", placeholder: "e.g. 28" },
  { key: "hips", label: "Hips", placeholder: "e.g. 38" },
];

const NeedMoreInfoScreen = ({ confidenceScore, confidenceReasons, onSubmitMeasurement, isLoading }: NeedMoreInfoScreenProps) => {
  const [selectedKey, setSelectedKey] = useState("bust");
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto">
      <div className="text-center mb-5">
        <div className="w-12 h-12 rounded-full bg-yellow-900/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-yellow-400 text-xl">?</span>
        </div>
        <h2 className="font-serif-display text-xl text-foreground mb-1">Need more info</h2>
        <p className="text-xs text-muted-foreground">
          We couldn't find a confident match (score: {confidenceScore}%). One measurement will help.
        </p>
      </div>

      {/* Reasons */}
      <div className="border-t border-border pt-3 mb-4 space-y-1">
        {confidenceReasons.map((r, i) => (
          <p key={i} className="text-[10px] text-muted-foreground">• {r}</p>
        ))}
      </div>

      {/* Measurement input */}
      <div className="space-y-3">
        <p className="text-xs text-foreground">Share one measurement to improve accuracy:</p>

        <div className="flex gap-2">
          {MEASUREMENT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedKey(opt.key)}
              className={`flex-1 rounded-full text-[10px] py-1.5 border transition-colors ${
                selectedKey === opt.key
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Input
          type="text"
          placeholder={MEASUREMENT_OPTIONS.find(o => o.key === selectedKey)?.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 rounded-md border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground"
        />

        <Button
          onClick={() => onSubmitMeasurement(selectedKey, value)}
          disabled={!value.trim() || isLoading}
          className="w-full rounded-full bg-primary text-primary-foreground text-xs"
          style={{ height: 48.5 }}
        >
          {isLoading ? "Recalculating..." : "Get recommendation"}
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground text-center mt-auto pt-4 leading-relaxed">
        Your measurement is used only for this recommendation and is not stored.
      </p>
    </div>
  );
};

export default NeedMoreInfoScreen;
