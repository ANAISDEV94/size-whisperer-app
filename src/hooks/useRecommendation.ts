import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SizeRecommendation, UserProfile } from "@/types/panel";

interface UseRecommendationReturn {
  recommendation: SizeRecommendation | null;
  recommendationId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchRecommendation: (profile: UserProfile, targetBrandKey: string, targetCategory: string, userId?: string, productUrl?: string) => Promise<void>;
  logAdjustment: (action: "size_down" | "keep" | "size_up", finalSize: string) => Promise<void>;
}

export function useRecommendation(): UseRecommendationReturn {
  const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendation = useCallback(async (
    profile: UserProfile,
    targetBrandKey: string,
    targetCategory: string,
    userId?: string,
    productUrl?: string,
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("recommend-size", {
        body: {
          anchor_brands: profile.anchorBrands.map(a => ({
            brandKey: a.brandKey,
            displayName: a.displayName,
            size: a.size,
          })),
          fit_preference: profile.fitPreference,
          target_brand_key: targetBrandKey,
          target_category: targetCategory,
          user_id: userId,
          product_url: productUrl,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setRecommendation({
        size: data.size,
        brandName: data.brandName,
        bullets: data.bullets,
        comparisons: data.comparisons,
      });
      setRecommendationId(data.recommendation_id || null);
    } catch (e) {
      console.error("Recommendation fetch failed:", e);
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logAdjustment = useCallback(async (action: "size_down" | "keep" | "size_up", finalSize: string) => {
    if (!recommendationId) return;
    try {
      await supabase.from("user_adjustments").insert({
        recommendation_id: recommendationId,
        action,
        final_size: finalSize,
      });
    } catch (e) {
      console.error("Failed to log adjustment:", e);
    }
  }, [recommendationId]);

  return { recommendation, recommendationId, isLoading, error, fetchRecommendation, logAdjustment };
}
