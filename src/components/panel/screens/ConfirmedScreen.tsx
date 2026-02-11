import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { SizeRecommendation } from "@/types/panel";

interface ConfirmedScreenProps {
  recommendation: SizeRecommendation;
  onAddToCart: () => void;
}

const ConfirmedScreen = ({ recommendation, onAddToCart }: ConfirmedScreenProps) => {
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [compareExpanded, setCompareExpanded] = useState(false);

  return (
    <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto">
      <div className="text-center mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
          <Check className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-serif-display text-lg text-foreground mb-1">
          Size confirmed
        </h2>
        <p className="text-xs text-muted-foreground">
          We'll remember this fit for similar items.
        </p>
      </div>

      <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-center mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary mb-1">
          Your size for this item
        </p>
        <p className="font-serif-display text-2xl text-foreground">
          {recommendation.size}
        </p>
      </div>

      <Button
        onClick={() => {
          // Tell the host page (via content script) to scroll to the size selector
          window.parent.postMessage({ type: "ALTAANA_SCROLL_TO_SIZE" }, "*");
          onAddToCart();
        }}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm mb-6 mx-auto"
        style={{ height: 48.5, width: 334 }}
      >
        Go to size selector
      </Button>

      {/* Why this recommendation */}
      <button
        onClick={() => setWhyExpanded(!whyExpanded)}
        className="flex items-center justify-between w-full py-3 border-t border-border text-left"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Why this recommendation
        </span>
        {whyExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {whyExpanded && (
        <ul className="space-y-2 pb-4 pl-1">
          {recommendation.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-secondary-foreground">
              <span className="text-primary mt-0.5">•</span>
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {/* Compare across brands */}
      <button
        onClick={() => setCompareExpanded(!compareExpanded)}
        className="flex items-center justify-between w-full py-3 border-t border-border text-left"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Compare across brands
        </span>
        {compareExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {compareExpanded && (
        <div className="space-y-2 pb-4">
          {recommendation.comparisons.map((comp, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary">
              <div>
                <p className="text-xs text-foreground">{comp.brandName}</p>
                <p className="text-[10px] text-muted-foreground">{comp.size}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-panel-elevated text-secondary-foreground">
                {comp.fitTag}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground text-center mt-4 leading-relaxed border-t border-border pt-4">
        Sizing insights are based on aggregated public product data and shopper patterns. ALTAANA is not affiliated with or endorsed by the brands shown.
      </p>
    </div>
  );
};

export default ConfirmedScreen;
