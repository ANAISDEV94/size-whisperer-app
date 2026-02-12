import type { DebugTrace, ConfidenceInfo } from "@/types/panel";

interface DebugPanelProps {
  debug: DebugTrace;
  confidence: ConfidenceInfo;
}

const DebugPanel = ({ debug, confidence }: DebugPanelProps) => {
  return (
    <div className="mt-4 border border-border rounded-lg bg-panel-surface/50 p-3 text-[10px] font-mono space-y-3 overflow-y-auto max-h-[320px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-primary font-bold uppercase tracking-wider text-[9px]">Debug Trace</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            confidence.score >= 70
              ? "bg-green-900/40 text-green-400"
              : confidence.score >= 50
                ? "bg-yellow-900/40 text-yellow-400"
                : "bg-red-900/40 text-red-400"
          }`}
        >
          Confidence: {confidence.score}%
        </span>
        <span className="text-muted-foreground">({confidence.matchMethod})</span>
      </div>

      {/* Confidence reasons */}
      <Section title="Confidence reasons">
        {confidence.reasons.map((r, i) => (
          <div key={i} className="text-muted-foreground">• {r}</div>
        ))}
      </Section>

      {/* Category & anchor */}
      <Section title="Detected category">
        <Val>{debug.detectedCategory}</Val>
      </Section>

      <Section title="Anchor brand">
        <Val>{debug.anchorBrand} — size {debug.anchorSize}</Val>
      </Section>

      {/* Anchor measurements */}
      <Section title="Anchor measurements (midpoints)">
        {Object.keys(debug.anchorMeasurements).length > 0 ? (
          Object.entries(debug.anchorMeasurements).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-foreground">{v}"</span>
            </div>
          ))
        ) : (
          <span className="text-muted-foreground italic">No measurements available</span>
        )}
      </Section>

      {/* Target brand */}
      <Section title="Target brand">
        <Val>
          {debug.targetBrandDisplayName} ({debug.targetBrandKey})
          {debug.targetFitTendency && ` — ${debug.targetFitTendency}`}
        </Val>
        <div className="text-muted-foreground mt-0.5">
          Scale: {debug.targetSizeScale} | Denim: {debug.isDenimScale ? "yes" : "no"} | Fallback: {debug.usedFallback ? "yes" : "no"} | Est. body: {debug.usedEstimatedMeasurements ? "yes" : "no"}
        </div>
      </Section>

      {/* Target row used */}
      <Section title="Target size chart row used">
        {debug.targetRowUsed ? (
          <>
            <Val>Size: {debug.targetRowUsed.size_label}</Val>
            {debug.targetRowUsed.measurements && (
              <div className="mt-1 space-y-0.5">
                {Object.entries(debug.targetRowUsed.measurements).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground">{JSON.stringify(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {debug.targetRowUsed.fit_notes && (
              <div className="text-muted-foreground mt-1">Notes: {debug.targetRowUsed.fit_notes}</div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground italic">No chart row matched (fallback used)</span>
        )}
      </Section>

      {/* All size scores */}
      {debug.allSizeScores.length > 0 && (
        <Section title="Comparison scores (lower = better)">
          {debug.allSizeScores.map((s, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-foreground">{s.size}</span>
              <span className="text-muted-foreground">
                score: {s.score.toFixed(2)} ({s.matched} dims)
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Comparison logic */}
      <Section title="Comparison logic">
        {debug.comparisonLogic.map((c, i) => (
          <div key={i} className="text-muted-foreground">• {c}</div>
        ))}
      </Section>

      {/* Available sizes */}
      <Section title="Available sizes">
        <Val>{debug.availableSizes.join(", ") || "none"}</Val>
      </Section>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-primary/70 uppercase tracking-wider mb-0.5">{title}</div>
      {children}
    </div>
  );
}

function Val({ children }: { children: React.ReactNode }) {
  return <div className="text-foreground">{children}</div>;
}

export default DebugPanel;
