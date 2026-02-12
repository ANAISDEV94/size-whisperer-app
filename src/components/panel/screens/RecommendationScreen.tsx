import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { SizeRecommendation } from "@/types/panel";
import DebugPanel from "../DebugPanel";

interface RecommendationScreenProps {
  recommendation: SizeRecommendation;
  onSizeDown: () => void;
  onKeep: () => void;
  onSizeUp: () => void;
  onRecalculate?: (weight: string, height: string) => void;
  isRecalculating?: boolean;
  debugMode?: boolean;
}

const RecommendationScreen = ({ recommendation, onSizeDown, onKeep, onSizeUp, onRecalculate, isRecalculating, debugMode }: RecommendationScreenProps) => {
  const [boostOpen, setBoostOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);

  const handleRecalculate = () => {
    if (onRecalculate && (weight || height)) {
      onRecalculate(weight, height);
    }
  };

  const hasConfidence = !!recommendation.confidence;
  const confidenceScore = recommendation.confidence?.score ?? 100;

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
        {/* Confidence badge */}
        {hasConfidence && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                confidenceScore >= 70
                  ? "bg-green-500"
                  : confidenceScore >= 50
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-[10px] text-muted-foreground">
              {confidenceScore}% confidence
            </span>
          </div>
        )}
      </div>

      {/* WHY THIS SIZE — always expanded */}
      <div className="border-t border-b border-border py-3 mb-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Why this size</span>
        <ul className="space-y-2 pt-3 pl-1">
          {recommendation.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-secondary-foreground">
              <span className="text-primary mt-0.5">•</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      {/* Size action buttons */}
      <div className="flex gap-2">
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

      {/* Boost Accuracy — collapsible */}
      <Collapsible open={boostOpen} onOpenChange={setBoostOpen} className="mt-5">
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left">
          <span className="text-xs text-primary">Boost accuracy (optional)</span>
          {boostOpen ? (
            <ChevronUp className="w-4 h-4 text-primary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-primary" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Helpful for fitted or non-returnable items
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Weight</label>
              <input
                type="text"
                placeholder="e.g. 140 lbs"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background/50 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Height</label>
              <input
                type="text"
                placeholder={`e.g. 5'6"`}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background/50 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <Button
            onClick={handleRecalculate}
            disabled={(!weight && !height) || isRecalculating}
            className="w-full rounded-full bg-primary text-primary-foreground text-xs"
            style={{ height: 40 }}
          >
            {isRecalculating ? "Recalculating..." : "Recalculate"}
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Debug mode panel */}
      {debugMode && recommendation.debug && recommendation.confidence && (
        <Collapsible open={debugOpen} onOpenChange={setDebugOpen} className="mt-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left">
            <span className="text-xs text-primary flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5" />
              Debug trace
            </span>
            {debugOpen ? (
              <ChevronUp className="w-4 h-4 text-primary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-primary" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <DebugPanel debug={recommendation.debug} confidence={recommendation.confidence} />
          </CollapsibleContent>
        </Collapsible>
      )}

      <p className="text-[9px] text-muted-foreground text-center mt-auto pt-4 leading-relaxed">
        Sizing insights are based on aggregated public product data and shopper patterns.
      </p>
    </div>
  );
};

export default RecommendationScreen;
