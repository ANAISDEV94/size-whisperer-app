import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SizeRecommendation } from "@/types/panel";

interface RecommendationScreenProps {
  recommendation: SizeRecommendation;
  onSizeDown: () => void;
  onKeep: () => void;
  onSizeUp: () => void;
}

const RecommendationScreen = ({ recommendation, onSizeDown, onKeep, onSizeUp }: RecommendationScreenProps) => {
  const [whyExpanded, setWhyExpanded] = useState(false);

  return (
    <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto">
      <div className="text-center mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Your recommended size
        </p>
        <h2 className="font-serif-display text-3xl text-foreground">
          {recommendation.size}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          for {recommendation.brandName}
        </p>
      </div>

      <button
        onClick={() => setWhyExpanded(!whyExpanded)}
        className="flex items-center justify-between w-full py-3 border-t border-b border-border text-left"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Why this size</span>
        {whyExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {whyExpanded && (
        <ul className="space-y-2 py-4 pl-1">
          {recommendation.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-secondary-foreground">
              <span className="text-primary mt-0.5">•</span>
              {bullet}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 mt-auto pt-6">
        <Button
          onClick={onSizeDown}
          variant="outline"
          className="flex-1 rounded-full border-border text-foreground text-xs"
          style={{ height: 48.5 }}
        >
          Size down
        </Button>
        <Button
          onClick={onKeep}
          className="flex-[2] rounded-full bg-primary text-primary-foreground text-xs"
          style={{ height: 48.5 }}
        >
          Keep
        </Button>
        <Button
          onClick={onSizeUp}
          variant="outline"
          className="flex-1 rounded-full border-border text-foreground text-xs"
          style={{ height: 48.5 }}
        >
          Size up
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground text-center mt-4 leading-relaxed">
        Sizing insights are based on aggregated public product data and shopper patterns. ALTAANA is not affiliated with or endorsed by the brands shown.
      </p>
    </div>
  );
};

export default RecommendationScreen;
