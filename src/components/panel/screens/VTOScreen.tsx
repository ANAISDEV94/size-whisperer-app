import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RotateCcw, Download, ArrowLeft, ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useVirtualTryOn } from "@/hooks/useVirtualTryOn";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "altaana_vto_photo";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface VTOScreenProps {
  garmentImageUrl: string | null;
  garmentImageBase64: string | null;
  extractionMethod?: string;
  category?: string;
  onBack: () => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VTOScreen = ({ garmentImageUrl, garmentImageBase64, extractionMethod, category, onBack }: VTOScreenProps) => {
  const [personPhoto, setPersonPhoto] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [manualGarmentBase64, setManualGarmentBase64] = useState<string | null>(null);
  const [garmentPreviewError, setGarmentPreviewError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const garmentFileRef = useRef<HTMLInputElement>(null);
  const { status, outputImageUrl, error, startPrediction, cancel, reset } = useVirtualTryOn();

  // The base64 to send to backend: manual upload > auto-captured > null
  const effectiveGarmentBase64 = manualGarmentBase64 || garmentImageBase64 || null;
  // For preview: base64 if available, fall back to URL
  const garmentPreviewSrc = effectiveGarmentBase64 || garmentImageUrl || null;
  const canGenerate = !!personPhoto && !!effectiveGarmentBase64 && status === "idle";

  // Persist photo in localStorage
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
    if (!personPhoto || !effectiveGarmentBase64) return;
    startPrediction(personPhoto, effectiveGarmentBase64, category);
  };

  const handleTryAgain = () => {
    reset();
  };

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
        <Button
          onClick={handleTryAgain}
          variant="outline"
          className="rounded-full text-sm mb-3"
          style={{ height: 48.5, width: 334 }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="rounded-full text-sm mb-6"
          style={{ height: 48.5, width: 334 }}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Image
        </Button>
        <button onClick={onBack} className="text-xs text-muted-foreground underline">
          Back to sizing
        </button>
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
        <button onClick={cancel} className="text-xs text-muted-foreground underline">
          Cancel
        </button>
      </div>
    );
  }

  // ── UPLOAD PHASE (idle, failed, timeout) ──
  return (
    <div className="flex flex-col flex-1 px-5 py-6 overflow-y-auto">
      <h2 className="font-serif-display text-lg text-foreground mb-1 text-center">Try it on</h2>
      <p className="text-xs text-muted-foreground text-center mb-6">
        See how this item looks on you
      </p>

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
              <p>Extraction method: {extractionMethod || "unknown"}</p>
              {personPhoto && <p>Person photo: ~{Math.round(personPhoto.length * 0.75 / 1024)} KB</p>}
              {effectiveGarmentBase64 && <p>Garment image: ~{Math.round(effectiveGarmentBase64.length * 0.75 / 1024)} KB</p>}
              {!effectiveGarmentBase64 && <p>Garment image: not captured (try manual upload)</p>}
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
            >
              ✕
            </button>
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
          <button onClick={() => fileRef.current?.click()} className="text-[10px] text-primary mt-1 underline">
            Change photo
          </button>
        )}
      </div>

      {/* Garment image */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Garment image</p>
        {garmentPreviewSrc && !garmentPreviewError ? (
          <div className="w-full rounded-xl overflow-hidden border border-border bg-secondary">
            <img
              src={garmentPreviewSrc}
              alt="Product garment"
              className="w-full h-40 object-contain bg-white"
              onError={() => setGarmentPreviewError(true)}
            />
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
                {extractionMethod === "failed"
                  ? "Couldn't read garment image from this site"
                  : "No garment image detected"}
              </span>
            </div>
          </div>
        )}
        {/* Manual garment upload — always available as fallback */}
        <input ref={garmentFileRef} type="file" accept="image/*" className="hidden" onChange={handleGarmentFileSelect} />
        <button
          onClick={() => garmentFileRef.current?.click()}
          className="text-[10px] text-primary mt-1 underline"
        >
          {effectiveGarmentBase64 ? "Upload different garment" : "Select garment image manually"}
        </button>
        {!effectiveGarmentBase64 && garmentImageUrl && (
          <p className="text-[9px] text-muted-foreground mt-1">
            Auto-capture failed. Please upload the garment image manually.
          </p>
        )}
      </div>

      {/* Generate CTA */}
      <Button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm mb-4 mx-auto"
        style={{ height: 48.5, width: 334 }}
      >
        Generate Try-On
      </Button>

      {!effectiveGarmentBase64 && (
        <p className="text-[9px] text-center text-muted-foreground mb-2">
          A garment image is required to generate the try-on.
        </p>
      )}

      <button onClick={onBack} className="text-xs text-muted-foreground underline text-center">
        <ArrowLeft className="w-3 h-3 inline mr-1" />
        Back to sizing
      </button>

      <p className="text-[9px] text-muted-foreground text-center mt-4 leading-relaxed border-t border-border pt-4">
        Your photo is processed securely and never stored on our servers.
      </p>
    </div>
  );
};

export default VTOScreen;
