import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NeedMoreInfoScreenProps {
  confidenceScore: number;
  confidenceReasons: string[];
  askFor: string; // "bust" | "waist"
  reason: string;
  onSubmitMeasurement: (key: string, value: string) => void;
  isLoading?: boolean;
}

const MEASUREMENT_LABELS: Record<string, { label: string; placeholder: string }> = {
  bust: { label: "Bust", placeholder: "e.g. 34" },
  waist: { label: "Waist", placeholder: "e.g. 28" },
  hips: { label: "Hips", placeholder: "e.g. 38" },
};

const NeedMoreInfoScreen = ({ confidenceScore, confidenceReasons, askFor, reason, onSubmitMeasurement, isLoading }: NeedMoreInfoScreenProps) => {
  const [value, setValue] = useState("");
  const info = MEASUREMENT_LABELS[askFor] || MEASUREMENT_LABELS.bust;

  return (
    <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto">
      <div className="text-center mb-5">
        <div className="w-12 h-12 rounded-full bg-yellow-900/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-yellow-400 text-xl">?</span>
        </div>
        <h2 className="font-serif-display text-xl text-foreground mb-1">Need more info</h2>
        <p className="text-xs text-muted-foreground">
          {reason || `We couldn't find a confident match (score: ${confidenceScore}%).`}
        </p>
      </div>

      {/* Reasons */}
      <div className="border-t border-border pt-3 mb-4 space-y-1">
        {confidenceReasons.map((r, i) => (
          <p key={i} className="text-[10px] text-muted-foreground">• {r}</p>
        ))}
      </div>

      {/* Single measurement input */}
      <div className="space-y-3">
        <p className="text-xs text-foreground">
          Share your <span className="text-primary font-medium">{info.label.toLowerCase()}</span> measurement to get an accurate recommendation:
        </p>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
            {info.label} (inches)
          </label>
          <Input
            type="text"
            placeholder={info.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-10 rounded-md border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <Button
          onClick={() => onSubmitMeasurement(askFor, value)}
          disabled={!value.trim() || isLoading}
          className="w-full rounded-full bg-primary text-primary-foreground text-xs"
          style={{ height: 48.5 }}
        >
          {isLoading ? "Recalculating..." : "Recalculate"}
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground text-center mt-auto pt-4 leading-relaxed">
        Your measurement is used only for this recommendation and is not stored.
      </p>
    </div>
  );
};

export default NeedMoreInfoScreen;
