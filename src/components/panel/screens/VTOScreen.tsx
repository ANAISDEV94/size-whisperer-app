import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RotateCcw, Download, ArrowLeft, ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useVirtualTryOn } from "@/hooks/useVirtualTryOn";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "altaana_vto_photo";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface VTOScreenProps {
  garmentImageUrl: string | null;
  garmentImageBase64: string | null;
  garmentImageSourceUrl?: string | null;
  extractionMethod?: string;
  fetchStatus?: string;
  category?: string;
  onBack: () => void;
}

// 1x1 red PNG for self-test
const SELF_TEST_PERSON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const SELF_TEST_GARMENT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sizeKB(base64: string | null): string {
  if (!base64) return "—";
  return Math.round(base64.length * 0.75 / 1024) + " KB";
}

const VTOScreen = ({
  garmentImageUrl,
  garmentImageBase64,
  garmentImageSourceUrl,
  extractionMethod = "unknown",
  fetchStatus = "unknown",
  category = "unknown",
  onBack,
}: VTOScreenProps) => {
  const [personPhoto, setPersonPhoto] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [manualGarmentBase64, setManualGarmentBase64] = useState<string | null>(null);
  const [garmentPreviewError, setGarmentPreviewError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [testExtractionResult, setTestExtractionResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const garmentFileRef = useRef<HTMLInputElement>(null);
  const { status, outputImageUrl, error, startPrediction, cancel, reset } = useVirtualTryOn();

  const effectiveGarmentBase64 = manualGarmentBase64 || garmentImageBase64 || null;
  const effectiveGarmentUrl = garmentImageSourceUrl || garmentImageUrl || null;
  const garmentPreviewSrc = effectiveGarmentBase64 || effectiveGarmentUrl || null;
  const canGenerate = !!personPhoto && (!!effectiveGarmentBase64 || !!effectiveGarmentUrl) && status === "idle";

  useEffect(() => {
    if (personPhoto) {
      try { localStorage.setItem(STORAGE_KEY, personPhoto); } catch { /* quota */ }
    }
  }, [personPhoto]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Image too large", description: "Please upload a photo under 5MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    const base64 = await readFileAsBase64(file);
    setPersonPhoto(base64);
  };

  const handleGarmentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Image too large", description: "Please upload a garment image under 5MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    const base64 = await readFileAsBase64(file);
    setManualGarmentBase64(base64);
    setGarmentPreviewError(false);
  };

  const handleGenerate = () => {
    if (!personPhoto) {
      toast({ title: "Photo required", description: "Please upload a front-facing photo of yourself.", variant: "destructive" });
      return;
    }
    if (!personPhoto.startsWith("data:image/")) {
      toast({ title: "Invalid photo", description: "Person photo format is invalid. Please re-upload.", variant: "destructive" });
      return;
    }
    if (!effectiveGarmentBase64 && !effectiveGarmentUrl) {
      toast({ title: "Garment image required", description: "Please upload a garment image manually.", variant: "destructive" });
      return;
    }
    if (effectiveGarmentBase64 && !effectiveGarmentBase64.startsWith("data:image/")) {
      toast({ title: "Invalid garment image", description: "Garment image format is invalid. Please re-upload.", variant: "destructive" });
      return;
    }
    startPrediction(personPhoto, effectiveGarmentBase64, category ?? "unknown", effectiveGarmentUrl || undefined, extractionMethod ?? "unknown");
  };

  const handleSelfTest = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/virtual-tryon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          person_image_base64: SELF_TEST_PERSON,
          garment_image_base64: SELF_TEST_GARMENT,
          category: "upper_body",
          extractionMethod: "self_test",
          garmentType: "test",
          debug: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.prediction_id) {
        toast({ title: "Self-test passed ✓", description: `Prediction started: ${data.prediction_id}` });
      } else {
        toast({ title: "Self-test failed", description: data?.error ?? JSON.stringify(data), variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Self-test error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleTestExtraction = () => {
    // Send a postMessage to parent window requesting re-extraction
    window.parent.postMessage({ type: "ALTAANA_RERUN_EXTRACTION" }, "*");
    setTestExtractionResult("Requested re-extraction from content script…");
    toast({ title: "Extraction test", description: "Re-running garment extraction on the page." });
  };

  const handleTryAgain = () => { reset(); };

  const handleDownload = () => {
    if (!outputImageUrl) return;
    const a = document.createElement("a");
    a.href = outputImageUrl;
    a.download = "altaana-tryon.png";
    a.target = "_blank";
    a.click();
  };

  const handleRemovePhoto = () => {
    setPersonPhoto(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
  };

  // ── RESULT PHASE ──
  if (status === "succeeded" && outputImageUrl) {
    return (
      <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto items-center">
        <h2 className="font-serif-display text-lg text-foreground mb-4">Your virtual try-on</h2>
        <div className="w-full rounded-xl overflow-hidden mb-6 border border-border">
          <img src={outputImageUrl} alt="Virtual try-on result" className="w-full h-auto" />
        </div>
        <Button onClick={handleTryAgain} variant="outline" className="rounded-full text-sm mb-3" style={{ height: 48.5, width: 334 }}>
          <RotateCcw className="w-4 h-4 mr-2" /> Try Again
        </Button>
        <Button onClick={handleDownload} variant="outline" className="rounded-full text-sm mb-6" style={{ height: 48.5, width: 334 }}>
          <Download className="w-4 h-4 mr-2" /> Download Image
        </Button>
        <button onClick={onBack} className="text-xs text-muted-foreground underline">Back to sizing</button>
      </div>
    );
  }

  // ── LOADING PHASE ──
  if (status === "starting" || status === "processing") {
    return (
      <div className="flex flex-col flex-1 px-5 py-6 items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="font-serif-display text-sm text-foreground mb-1">Fitting you in…</p>
        <p className="text-[10px] text-muted-foreground mb-6">This may take up to a minute</p>
        <button onClick={cancel} className="text-xs text-muted-foreground underline">Cancel</button>
      </div>
    );
  }

  // ── UPLOAD PHASE (idle, failed, timeout) ──
  return (
    <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto">
      <h2 className="font-serif-display text-lg text-foreground mb-1 text-center">Try it on</h2>
      <p className="text-xs text-muted-foreground text-center mb-6">See how this item looks on you</p>

      {/* Error banner with collapsible details */}
      {(status === "failed" || status === "timeout") && error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 mb-4">
          <p className="text-xs text-destructive whitespace-pre-wrap">{error}</p>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2 hover:text-foreground"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDetails ? "Hide details" : "Show details"}
          </button>
          {showDetails && (
            <div className="mt-2 text-[10px] text-muted-foreground space-y-1 border-t border-destructive/10 pt-2">
              <p>Extraction method: {extractionMethod ?? "unknown"}</p>
              <p>Fetch status: {fetchStatus ?? "unknown"}</p>
              {personPhoto && <p>Person photo: {sizeKB(personPhoto)}</p>}
              {effectiveGarmentBase64 && <p>Garment image: {sizeKB(effectiveGarmentBase64)}</p>}
              {!effectiveGarmentBase64 && <p>Garment image: not captured (try manual upload)</p>}
              {effectiveGarmentUrl && <p>Source URL: {effectiveGarmentUrl}</p>}
            </div>
          )}
        </div>
      )}

      {/* Person photo */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Your photo</p>
        {personPhoto ? (
          <div className="relative w-full rounded-xl overflow-hidden border border-border bg-secondary">
            <img src={personPhoto} alt="Your uploaded photo" className="w-full h-40 object-cover" />
            <button
              onClick={handleRemovePhoto}
              className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-xs text-muted-foreground hover:text-foreground"
            >✕</button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2 bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload a front-facing photo</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        {personPhoto && (
          <button onClick={() => fileRef.current?.click()} className="text-[10px] text-primary mt-1 underline">Change photo</button>
        )}
      </div>

      {/* Garment image */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Garment image</p>
        {garmentPreviewSrc && !garmentPreviewError ? (
          <div className="w-full rounded-xl overflow-hidden border border-border bg-secondary">
            <img src={garmentPreviewSrc} alt="Product garment" className="w-full h-40 object-contain bg-white" onError={() => setGarmentPreviewError(true)} />
          </div>
        ) : garmentPreviewSrc && garmentPreviewError ? (
          <div className="w-full rounded-xl overflow-hidden border border-border bg-secondary">
            <div className="w-full h-40 flex items-center justify-center bg-secondary">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs">Image detected — preview unavailable</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-20 rounded-xl border border-dashed border-border flex items-center justify-center bg-secondary/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ImageIcon className="w-4 h-4" />
              <span className="text-xs">
                {extractionMethod === "none"
                  ? "Couldn't read garment image from this site"
                  : "No garment image detected"}
              </span>
            </div>
          </div>
        )}
        <input ref={garmentFileRef} type="file" accept="image/*" className="hidden" onChange={handleGarmentFileSelect} />
        <button onClick={() => garmentFileRef.current?.click()} className="text-[10px] text-primary mt-1 underline">
          {effectiveGarmentBase64 ? "Upload different garment" : "Select garment image manually"}
        </button>
        {!effectiveGarmentBase64 && !effectiveGarmentUrl && garmentImageUrl && (
          <p className="text-[9px] text-muted-foreground mt-1">Auto-capture failed. Please upload the garment image manually.</p>
        )}
      </div>

      {/* Generate CTA */}
      <Button onClick={handleGenerate} disabled={!canGenerate} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm mb-4 mx-auto" style={{ height: 48.5, width: 334 }}>
        Generate Try-On
      </Button>

      {!effectiveGarmentBase64 && !effectiveGarmentUrl && (
        <p className="text-[9px] text-center text-muted-foreground mb-2">A garment image is required to generate the try-on.</p>
      )}

      <button onClick={onBack} className="text-xs text-muted-foreground underline text-center">
        <ArrowLeft className="w-3 h-3 inline mr-1" />Back to sizing
      </button>

      <p className="text-[9px] text-muted-foreground text-center mt-4 leading-relaxed border-t border-border pt-4">
        Your photo is processed securely and never stored on our servers.
      </p>

      {/* Dev-mode tools */}
      {import.meta.env.DEV && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2 justify-center">
            <button onClick={handleSelfTest} className="text-[9px] text-muted-foreground underline">🧪 Self-test backend</button>
            <button onClick={handleTestExtraction} className="text-[9px] text-muted-foreground underline">🔍 Test extraction</button>
          </div>
          {testExtractionResult && (
            <p className="text-[9px] text-muted-foreground text-center">{testExtractionResult}</p>
          )}

          {/* Collapsed debug panel */}
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground mx-auto">
              {debugOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Debug info
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 p-2 rounded border border-border bg-secondary/50 text-[9px] text-muted-foreground space-y-1 font-mono">
                <p>extractionMethod: {extractionMethod ?? "unknown"}</p>
                <p>fetchStatus: {fetchStatus ?? "unknown"}</p>
                <p>sourceUrl: {effectiveGarmentUrl ?? "none"}</p>
                <p>garmentBase64: {effectiveGarmentBase64 ? sizeKB(effectiveGarmentBase64) : "none"}</p>
                <p>personPhoto: {personPhoto ? sizeKB(personPhoto) : "none"}</p>
                <p>category: {category ?? "unknown"}</p>
                <p>manualUpload: {manualGarmentBase64 ? "yes" : "no"}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
};

export default VTOScreen;
