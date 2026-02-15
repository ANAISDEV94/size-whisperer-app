import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type VTOStatus = "idle" | "starting" | "processing" | "succeeded" | "failed" | "timeout";

interface VTOState {
  status: VTOStatus;
  outputImageUrl: string | null;
  error: string | null;
  predictionId: string | null;
}

const POLL_INTERVAL = 3000;
const MAX_POLLS = 40; // 120 seconds max

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
    garmentImageUrl: string,
    category?: string,
  ) => {
    cleanup();
    setState({ status: "starting", outputImageUrl: null, error: null, predictionId: null });

    try {
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        method: "POST",
        body: { person_image_base64: personImageBase64, garment_image_url: garmentImageUrl, category },
      });

      if (error || !data?.prediction_id) {
        setState({ status: "failed", outputImageUrl: null, error: data?.error || error?.message || "Failed to start", predictionId: null });
        return;
      }

      const predictionId = data.prediction_id;
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
          // Use GET with query params via invoke
          const { data: pollData } = await supabase.functions.invoke(
            `virtual-tryon?prediction_id=${predictionId}`,
            { method: "GET" },
          );

          if (!pollData) return;

          if (pollData.status === "succeeded") {
            cleanup();
            setState({ status: "succeeded", outputImageUrl: pollData.output_image_url, error: null, predictionId });
          } else if (pollData.status === "failed" || pollData.status === "canceled") {
            cleanup();
            setState({ status: "failed", outputImageUrl: null, error: pollData.error || "Something went wrong. Please try again.", predictionId });
          }
          // else still processing, keep polling
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
