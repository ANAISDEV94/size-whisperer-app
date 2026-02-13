import type { DebugTrace, ConfidenceInfo, DimensionDeviation } from "@/types/panel";

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

      {/* Category & detection source */}
      <Section title="Detected category">
        <Val>{debug.normalizedCategory || debug.detectedCategory}</Val>
        {debug.detectedCategoryRaw && debug.detectedCategoryRaw !== (debug.normalizedCategory || debug.detectedCategory) && (
          <div className="text-muted-foreground mt-0.5">Raw: {debug.detectedCategoryRaw}</div>
        )}
        <div className="text-muted-foreground mt-0.5">Source: {debug.detectionSource}</div>
        {debug.categoryFallbackUsed && (
          <div className="text-yellow-400 mt-0.5">⚠ Category not found — used brand-only fallback</div>
        )}
        {debug.airtableCategoryMatchesCount !== undefined && (
          <div className="text-muted-foreground mt-0.5">Chart rows for brand: {debug.airtableCategoryMatchesCount}</div>
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
        {debug.anchorRowChosen && (
          <div className="text-muted-foreground mt-0.5">
            Row chosen: <span className="text-foreground">{debug.anchorRowChosen.sizeLabel}</span>
          </div>
        )}
      </Section>

      {/* Scale track info */}
      {debug.targetTracksAvailable && (
        <Section title="Scale tracks">
          <div className="text-muted-foreground">Available: <span className="text-foreground">{debug.targetTracksAvailable.join(", ")}</span></div>
          <div className="text-muted-foreground mt-0.5">Used: <span className="text-foreground">{debug.trackUsed || "—"}</span></div>
          {debug.trackSelectionReason && (
            <div className="text-muted-foreground mt-0.5 text-[9px]">{debug.trackSelectionReason}</div>
          )}
        </Section>
      )}

      {/* Anchor measurements with min/max */}
      <Section title="Anchor measurements (min / max / midpoint)">
        {debug.anchorMeasurementsRaw && Object.keys(debug.anchorMeasurementsRaw).length > 0 ? (
          Object.entries(debug.anchorMeasurementsRaw).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-foreground">
                {v.min ?? "—"} / {v.max ?? "—"} / {v.midpoint ?? "—"}"
              </span>
            </div>
          ))
        ) : (
          <span className="text-muted-foreground italic">No measurements available</span>
        )}
      </Section>

      {/* Missing dimensions */}
      {debug.missingDimensions && debug.missingDimensions.length > 0 && (
        <Section title="Missing dimensions">
          <Val className="text-red-400">{debug.missingDimensions.join(", ")}</Val>
        </Section>
      )}

      {/* Measurement coverage */}
      <Section title="Measurement coverage">
        <Val>
          {debug.measurementCoverage} / {debug.keyDimensionsList?.length ?? "?"} key dimensions
        </Val>
        <div className="text-muted-foreground mt-0.5">
          Keys: {debug.keyDimensionsList?.join(", ") || "none"}
        </div>
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
        {debug.targetSizeTypeSearched && (
          <div className="text-muted-foreground mt-0.5">
            Target size type searched: <span className="text-foreground">{debug.targetSizeTypeSearched}</span>
          </div>
        )}
        {debug.conversionFallbackUsed && (
          <div className="text-yellow-400 mt-0.5">
            ⚠ Conversion fallback used — anchor type ({debug.anchorSizeType}) differs from target rows ({debug.targetSizeTypeSearched})
          </div>
        )}
        {debug.anchorSizeSystem && (
          <div className="text-muted-foreground mt-0.5">
            Anchor size system: <span className="text-foreground">{debug.anchorSizeSystem}</span>
            {debug.sizeSystemFilterUsed && debug.sizeSystemFilterUsed !== debug.anchorSizeSystem && (
              <> (filter: {debug.sizeSystemFilterUsed})</>
            )}
          </div>
        )}
        {debug.targetRowsFilteredOut !== undefined && debug.targetRowsFilteredOut > 0 && (
          <div className="text-yellow-400 mt-0.5">
            ⚠ {debug.targetRowsFilteredOut} row(s) filtered out due to size type mismatch
          </div>
        )}
        {debug.targetRowsAfterSystemFilter !== undefined && (
          <div className="text-muted-foreground mt-0.5">
            Candidate rows after filter: {debug.targetRowsAfterSystemFilter}
          </div>
        )}
      </Section>

      {/* Top 3 candidate sizes */}
      {debug.top3Candidates && debug.top3Candidates.length > 0 && (
        <Section title="Top 3 candidate sizes">
          {debug.top3Candidates.map((s, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between">
                <span className="text-foreground">
                  {i === 0 ? "🏆 " : ""}{s.size}
                </span>
                <span className="text-muted-foreground">
                  avg dist: {s.score.toFixed(2)}″ ({s.matched} dims)
                  {s.totalOverlap !== undefined && s.totalOverlap > 0 && (
                    <span className="text-green-400 ml-1">overlap: {s.totalOverlap.toFixed(1)}″</span>
                  )}
                </span>
              </div>
              {s.deviations && s.deviations.length > 0 && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {s.deviations.map((d: DimensionDeviation, j: number) => (
                    <div key={j} className="flex justify-between text-muted-foreground">
                      <span>{d.dimension}</span>
                      <span>
                        [{d.userMin?.toFixed(1)}-{d.userMax?.toFixed(1)}] → [{d.targetMin.toFixed(1)}-{d.targetMax.toFixed(1)}]
                        {d.insideRange
                          ? <span className="text-green-400 ml-1">✓ overlap {d.overlap?.toFixed(1)}″</span>
                          : <span className="text-yellow-400 ml-1">gap: {d.deviation.toFixed(2)}″</span>
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

      {/* All size scores */}
      {debug.allSizeScores.length > 0 && (
        <Section title="All size scores (lower = better)">
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

function Val({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className || "text-foreground"}>{children}</div>;
}

export default DebugPanel;
