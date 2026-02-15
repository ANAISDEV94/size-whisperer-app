import { useState, useRef, useCallback } from "react";

type VTOStatus = "idle" | "starting" | "processing" | "succeeded" | "failed" | "timeout";

interface VTOState {
  status: VTOStatus;
  outputImageUrl: string | null;
  error: string | null;
  predictionId: string | null;
}

const POLL_INTERVAL = 3000;
const MAX_POLLS = 40; // 120 seconds max

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/virtual-tryon`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${API_KEY}`,
  "apikey": API_KEY,
};

export function useVirtualTryOn() {
  const [state, setState] = useState<VTOState>({
    status: "idle",
    outputImageUrl: null,
    error: null,
    predictionId: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const cancel = useCallback(() => {
    cleanup();
    setState({ status: "idle", outputImageUrl: null, error: null, predictionId: null });
  }, [cleanup]);

  const startPrediction = useCallback(async (
    personImageBase64: string,
    garmentImageBase64: string,
    category?: string,
  ) => {
    cleanup();
    setState({ status: "starting", outputImageUrl: null, error: null, predictionId: null });

    console.log("[VTO] Starting prediction", {
      garmentImageBase64Length: garmentImageBase64.length,
      garmentImageApproxKB: Math.round(garmentImageBase64.length * 0.75 / 1024),
      personImageBase64Length: personImageBase64.length,
      personImageApproxKB: Math.round(personImageBase64.length * 0.75 / 1024),
      category,
    });

    try {
      const res = await fetch(BASE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          person_image_base64: personImageBase64,
          garment_image_base64: garmentImageBase64,
          category,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = body.error || body.detail || JSON.stringify(body);
        setState({ status: "failed", outputImageUrl: null, error: `[${res.status}] ${detail}`, predictionId: null });
        return;
      }

      if (!body.prediction_id) {
        setState({ status: "failed", outputImageUrl: null, error: body.error || "No prediction_id returned", predictionId: null });
        return;
      }

      const predictionId = body.prediction_id;
      setState(s => ({ ...s, status: "processing", predictionId }));

      // Start polling
      pollCountRef.current = 0;
      pollRef.current = setInterval(async () => {
        pollCountRef.current++;
        if (pollCountRef.current > MAX_POLLS) {
          cleanup();
          setState(s => ({ ...s, status: "timeout", error: "Generation took too long. Please try again." }));
          return;
        }

        try {
          const pollRes = await fetch(`${BASE_URL}?prediction_id=${predictionId}`, { method: "GET", headers });
          const pollData = await pollRes.json().catch(() => ({}));

          if (!pollRes.ok) {
            const detail = pollData.error || pollData.detail || JSON.stringify(pollData);
            cleanup();
            setState(s => ({ ...s, status: "failed", error: `[${pollRes.status}] ${detail}` }));
            return;
          }

          if (pollData.status === "succeeded") {
            cleanup();
            setState({ status: "succeeded", outputImageUrl: pollData.output_image_url, error: null, predictionId });
          } else if (pollData.status === "failed" || pollData.status === "canceled") {
            cleanup();
            setState({ status: "failed", outputImageUrl: null, error: pollData.error || "Something went wrong. Please try again.", predictionId });
          }
        } catch {
          // Network error during poll — keep trying
        }
      }, POLL_INTERVAL);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection lost. Check your internet and try again.";
      setState({ status: "failed", outputImageUrl: null, error: message, predictionId: null });
    }
  }, [cleanup]);

  return { ...state, startPrediction, cancel, reset: cancel };
}
