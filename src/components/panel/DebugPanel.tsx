import type { DebugTrace } from "@/types/panel";

interface DebugPanelProps {
  debug: DebugTrace;
}

const DebugPanel = ({ debug }: DebugPanelProps) => {
  return (
    <div className="mt-4 border border-border rounded-lg bg-panel-surface/50 p-3 text-[10px] font-mono space-y-3 overflow-y-auto max-h-[320px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-primary font-bold uppercase tracking-wider text-[9px]">Debug Trace</span>
      </div>

      {/* Match explanation */}
      {debug.matchExplanation && (
        <Section title="Match result">
          <Val>{debug.matchExplanation}</Val>
          {debug.betweenSizes && (
            <div className="text-yellow-400 mt-0.5">Between sizes: {debug.betweenSizes[0]} and {debug.betweenSizes[1]}</div>
          )}
        </Section>
      )}

      {/* Category & detection */}
      <Section title="Detected category">
        <Val>{debug.normalizedCategory}</Val>
        {debug.detectedCategoryRaw && debug.detectedCategoryRaw !== debug.normalizedCategory && (
          <div className="text-muted-foreground mt-0.5">Raw: {debug.detectedCategoryRaw}</div>
        )}
        {debug.categoryFallbackUsed && (
          <div className="text-yellow-400 mt-0.5">⚠ Category not found — used brand-only fallback</div>
        )}
      </Section>

      {/* Anchor brand */}
      <Section title="Anchor brand">
        <Val>{debug.anchorBrand} — size {debug.anchorSize}</Val>
        {debug.anchorSizeType && (
          <div className="text-muted-foreground mt-0.5">Size type: <span className="text-foreground">{debug.anchorSizeType}</span></div>
        )}
        {debug.anchorScaleTrack && (
          <div className="text-muted-foreground mt-0.5">Scale track: <span className="text-foreground">{debug.anchorScaleTrack}</span></div>
        )}
      </Section>

      {/* Scale tracks */}
      {debug.targetTracksAvailable && (
        <Section title="Scale tracks">
          <div className="text-muted-foreground">Available: <span className="text-foreground">{debug.targetTracksAvailable.join(", ")}</span></div>
          <div className="text-muted-foreground mt-0.5">Used: <span className="text-foreground">{debug.trackUsed || "—"}</span></div>
        </Section>
      )}

      {/* Target brand */}
      <Section title="Target brand">
        <Val>
          {debug.targetBrandDisplayName} ({debug.targetBrandKey})
          {debug.targetFitTendency && ` — ${debug.targetFitTendency}`}
        </Val>
        <div className="text-muted-foreground mt-0.5">
          Scale: {debug.targetSizeScale} | Fallback: {debug.usedFallback ? "yes" : "no"} | Est. body: {debug.usedEstimatedMeasurements ? "yes" : "no"}
        </div>
        {debug.conversionFallbackUsed && (
          <div className="text-yellow-400 mt-0.5">⚠ Conversion fallback used</div>
        )}
      </Section>

      {/* Size containment details */}
      {debug.sizeDetails && Object.keys(debug.sizeDetails).length > 0 && (
        <Section title="Size containment details">
          {Object.entries(debug.sizeDetails).map(([size, dims]) => (
            <div key={size} className="mb-2">
              <div className="text-foreground font-bold">{size}</div>
              <div className="ml-3 mt-0.5 space-y-0.5">
                {dims.map((d, j) => (
                  <div key={j} className="flex justify-between text-muted-foreground">
                    <span>{d.dimension}</span>
                    <span>
                      user: {d.userMid.toFixed(1)}″ → [{d.rangeMin.toFixed(1)}-{d.rangeMax.toFixed(1)}]
                      {d.contained
                        ? <span className="text-green-400 ml-1">✓ contained</span>
                        : <span className="text-yellow-400 ml-1">✗ outside</span>
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Target row used */}
      <Section title="Chosen target size row">
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

      {/* Key dimensions */}
      <Section title="Key dimensions">
        <Val>{debug.keyDimensionsList?.join(", ") || "none"}</Val>
      </Section>

      {/* Available sizes */}
      <Section title="Available sizes">
        <Val>{debug.availableSizes.join(", ") || "none"}</Val>
      </Section>

      {debug.targetRowsConsidered !== undefined && (
        <Section title="Rows considered">
          <Val>{debug.targetRowsConsidered} rows</Val>
        </Section>
      )}
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

function Val({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className || "text-foreground"}>{children}</div>;
}

export default DebugPanel;
