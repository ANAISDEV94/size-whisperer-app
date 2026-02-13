import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FlaskConical, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface ScenarioResult {
  name: string;
  status: "pass" | "fail" | "warn";
  size: string | null;
  confidence: number;
  matchedDims: number;
  track: string;
  needMoreInfo: boolean;
  message: string;
  durationMs: number;
}

interface Scenario {
  name: string;
  input: {
    anchor_brands: { brandKey: string; displayName: string; size: string }[];
    fit_preference: string;
    target_brand_key: string;
    target_category: string;
  };
  validate: (data: Record<string, unknown>) => { status: "pass" | "fail" | "warn"; message: string };
}

const SCENARIOS: Scenario[] = [
  {
    name: "A: Alo M → Alo tops = M (same brand)",
    input: {
      anchor_brands: [{ brandKey: "alo_yoga", displayName: "Alo Yoga", size: "M" }],
      fit_preference: "true_to_size",
      target_brand_key: "alo_yoga",
      target_category: "tops",
    },
    validate: (d) => {
      const size = d.size as string;
      if (size === "M") return { status: "pass", message: "Same-brand shortcut returned M" };
      return { status: "fail", message: `Expected M, got ${size}` };
    },
  },
  {
    name: "B: Reformation S → Alo dresses ≠ extreme",
    input: {
      anchor_brands: [{ brandKey: "reformation", displayName: "Reformation", size: "S" }],
      fit_preference: "true_to_size",
      target_brand_key: "alo_yoga",
      target_category: "dresses",
    },
    validate: (d) => {
      if (d.needMoreInfo) return { status: "warn", message: "Need more info triggered" };
      const size = (d.size as string || "").toUpperCase();
      const extreme = ["XXS", "XXXS", "00", "4X", "20"];
      if (extreme.includes(size)) return { status: "fail", message: `Got extreme size: ${size}` };
      if (["XS", "S", "M"].includes(size)) return { status: "pass", message: `Got ${size}` };
      return { status: "warn", message: `Unexpected size: ${size}` };
    },
  },
  {
    name: "C: Zimmermann 2 → Alo tops ≠ 20",
    input: {
      anchor_brands: [{ brandKey: "zimmermann", displayName: "Zimmermann", size: "2" }],
      fit_preference: "true_to_size",
      target_brand_key: "alo_yoga",
      target_category: "tops",
    },
    validate: (d) => {
      if (d.needMoreInfo) return { status: "warn", message: "Need more info (acceptable for brand-specific)" };
      const size = (d.size as string || "").toUpperCase();
      if (size === "20") return { status: "fail", message: "Got 20 — brand-specific guard failed!" };
      const debug = d.debug as Record<string, unknown> | undefined;
      const track = (debug?.anchorScaleTrack as string) || "unknown";
      if (track === "brand_specific") return { status: "pass", message: `Got ${size}, track=${track}` };
      return { status: "warn", message: `Got ${size}, track=${track} (expected brand_specific)` };
    },
  },
  {
    name: "D: Unknown brand → Need more info",
    input: {
      anchor_brands: [{ brandKey: "nonexistent_brand_xyz", displayName: "FakeBrand", size: "M" }],
      fit_preference: "true_to_size",
      target_brand_key: "nonexistent_target_xyz",
      target_category: "tops",
    },
    validate: (d) => {
      if (d.needMoreInfo) return { status: "pass", message: "Correctly triggered need more info" };
      const size = d.size as string;
      return { status: "fail", message: `Expected need more info (no sizing data), got size=${size}` };
    },
  },
  {
    name: "E: SKIMS M → Reformation tops (containment)",
    input: {
      anchor_brands: [{ brandKey: "skims", displayName: "SKIMS", size: "M" }],
      fit_preference: "true_to_size",
      target_brand_key: "reformation",
      target_category: "tops",
    },
    validate: (d) => {
      if (d.needMoreInfo) return { status: "warn", message: "Need more info triggered" };
      const size = (d.size as string || "").toUpperCase();
      const extreme = ["XXS", "XXXS", "00", "4X", "20"];
      if (extreme.includes(size)) return { status: "fail", message: `Got extreme size: ${size}` };
      return { status: "pass", message: `Got ${size} via range containment` };
    },
  },
  {
    name: "F: Alo M → Reformation tops: no measurements → no body numbers in bullets",
    input: {
      anchor_brands: [{ brandKey: "alo_yoga", displayName: "Alo Yoga", size: "M" }],
      fit_preference: "true_to_size",
      target_brand_key: "reformation",
      target_category: "tops",
    },
    validate: (d) => {
      if (d.needMoreInfo) return { status: "warn", message: "Need more info triggered (acceptable)" };
      const bullets = d.bullets as string[] || [];
      const hasNumbers = bullets.some((b: string) => /\d+(\.\d+)?\s*("|″|inch|inches|cm)\b/i.test(b) || /\b(bust|waist|hips|underbust)\b.*\d/i.test(b));
      if (hasNumbers) return { status: "fail", message: `Bullets reference body measurements without user input: ${bullets.join(" | ")}` };
      return { status: "pass", message: `Bullets clean: ${bullets.join(" | ")}` };
    },
  },
  {
    name: "G: Zimmermann 1 → CSB tops: extreme jump guardrail",
    input: {
      anchor_brands: [{ brandKey: "zimmermann", displayName: "Zimmermann", size: "1" }],
      fit_preference: "true_to_size",
      target_brand_key: "csb",
      target_category: "tops",
    },
    validate: (d) => {
      if (d.needMoreInfo) return { status: "pass", message: "Correctly triggered need more info for potential extreme jump" };
      const size = (d.size as string || "").toUpperCase();
      // Zimmermann 1 ≈ XS/S range. If we get XL or larger, it's a failure.
      const extreme = ["XL", "2X", "3X", "4X", "XXL", "12", "14", "16", "18", "20"];
      if (extreme.includes(size)) return { status: "fail", message: `Extreme jump: Zimmermann 1 → ${size}` };
      return { status: "pass", message: `Got ${size} (reasonable mapping)` };
    },
  },
];

const SmokeTestRunner = () => {
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [running, setRunning] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const newResults: ScenarioResult[] = [];

    for (const scenario of SCENARIOS) {
      const start = performance.now();
      try {
        const { data, error } = await supabase.functions.invoke("recommend-size", {
          body: { ...scenario.input, debug_mode: true },
        });

        const duration = Math.round(performance.now() - start);

        if (error) {
          newResults.push({
            name: scenario.name,
            status: "fail",
            size: null,
            confidence: 0,
            matchedDims: 0,
            track: "error",
            needMoreInfo: false,
            message: `Error: ${error.message}`,
            durationMs: duration,
          });
          continue;
        }

        const validation = scenario.validate(data);
        const debug = data.debug as Record<string, unknown> | undefined;
        const conf = (data.confidence as Record<string, unknown>) || {};

        newResults.push({
          name: scenario.name,
          status: validation.status,
          size: (data.size as string) || null,
          confidence: (conf.score as number) ?? 0,
          matchedDims: (conf.measurementCoverage as number) ?? (debug?.measurementCoverage as number) ?? 0,
          track: (debug?.trackUsed as string) || (debug?.anchorScaleTrack as string) || "—",
          needMoreInfo: !!data.needMoreInfo,
          message: validation.message,
          durationMs: duration,
        });
      } catch (e) {
        newResults.push({
          name: scenario.name,
          status: "fail",
          size: null,
          confidence: 0,
          matchedDims: 0,
          track: "error",
          needMoreInfo: false,
          message: `Exception: ${(e as Error).message}`,
          durationMs: Math.round(performance.now() - start),
        });
      }

      // Update results progressively
      setResults([...newResults]);
    }

    setRunning(false);
    // Also log to console for easy access
    console.group("🧪 ALTAANA Smoke Test Results");
    for (const r of newResults) {
      const icon = r.status === "pass" ? "✅" : r.status === "warn" ? "⚠️" : "❌";
      console.log(
        `${icon} ${r.name}\n` +
        `   Size: ${r.size ?? "N/A"} | Confidence: ${r.confidence}% | Dims: ${r.matchedDims} | Track: ${r.track} | ${r.durationMs}ms\n` +
        `   ${r.message}`
      );
    }
    console.groupEnd();
  }, []);

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] max-w-md">
      <Button
        onClick={runAll}
        disabled={running}
        variant="outline"
        size="sm"
        className="mb-2 bg-background/95 backdrop-blur border-border shadow-lg"
      >
        {running ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5 mr-1.5" />}
        {running ? "Running…" : "Run Smoke Tests"}
      </Button>

      {results.length > 0 && (
        <div className="bg-background/95 backdrop-blur border border-border rounded-lg shadow-xl p-3 text-[11px] font-mono space-y-2 max-h-[400px] overflow-y-auto">
          <div className="flex gap-3 text-xs font-sans font-medium pb-1 border-b border-border">
            {passCount > 0 && <span className="text-green-500">{passCount} passed</span>}
            {warnCount > 0 && <span className="text-yellow-500">{warnCount} warnings</span>}
            {failCount > 0 && <span className="text-red-500">{failCount} failed</span>}
          </div>

          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              {r.status === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />}
              {r.status === "fail" && <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />}
              {r.status === "warn" && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <div className="text-foreground font-medium truncate">{r.name}</div>
                <div className="text-muted-foreground">
                  {r.size ? `Size: ${r.size}` : "No size"} · {r.confidence}% · {r.matchedDims} dims · {r.track} · {r.durationMs}ms
                </div>
                <div className={r.status === "fail" ? "text-red-400" : r.status === "warn" ? "text-yellow-400" : "text-green-400"}>
                  {r.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmokeTestRunner;
