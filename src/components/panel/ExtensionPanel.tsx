import { useState, useCallback, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PanelState, UserProfile, SizeRecommendation } from "@/types/panel";
import { useAuth } from "@/hooks/useAuth";
import { useRecommendation } from "@/hooks/useRecommendation";
import { useConfirmationMemory } from "@/hooks/useConfirmationMemory";
import FloatingWidget from "./FloatingWidget";
import PanelHeader from "./PanelHeader";
import AuthScreen from "./screens/AuthScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AnalyzingScreen from "./screens/AnalyzingScreen";
import RecommendationScreen from "./screens/RecommendationScreen";
import ConfirmedScreen from "./screens/ConfirmedScreen";

// ── Read target brand from URL params ───────────────────────────
function useTargetBrand() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      brandKey: params.get("brand") || "csb",
      category: params.get("category") || "tops",
      productUrl: params.get("url") || undefined,
    };
  }, []);
}

// Size offset helpers — respect the target brand's scale
const NUMERIC_ORDER = ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"];
const LETTER_ORDER = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "2X", "3X", "4X"];

function offsetSize(size: string, delta: number, scale: "numeric" | "letter"): string {
  const upper = size.toUpperCase().trim();
  const order = scale === "numeric" ? NUMERIC_ORDER : LETTER_ORDER;
  const idx = order.indexOf(upper);
  if (idx !== -1) {
    const next = idx + delta;
    return order[Math.max(0, Math.min(next, order.length - 1))];
  }
  return size;
}

const ExtensionPanel = () => {
  const { user, isLoading, signUp, signIn, signInWithGoogle, signOut } = useAuth();
  const { recommendation, recommendationId, isLoading: recLoading, error: recError, fetchRecommendation, logAdjustment } = useRecommendation();
  const target = useTargetBrand();
  const { cached, save: saveConfirmation } = useConfirmationMemory(target.brandKey, target.productUrl);

  const [isOpen, setIsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>(cached ? "confirmed" : "profile");
  const [, setProfile] = useState<UserProfile | null>(null);
  const [confirmedSize, setConfirmedSize] = useState<string | null>(cached?.size || null);

  // Check for guest session flag
  const isGuest = typeof window !== 'undefined' && localStorage.getItem('altaana_guest_session') === 'true';

  const handleOpen = useCallback(() => {
    if (!user && !isGuest) {
      setShowAuth(true);
    } else {
      setIsOpen(true);
    }
  }, [user, isGuest]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setShowAuth(false);
  }, []);

  const handleAuthComplete = useCallback(() => {
    setShowAuth(false);
    setIsOpen(true);
    setPanelState("profile");
  }, []);

  // "Continue without saving" — persist guest flag
  const handleContinueWithout = useCallback(() => {
    localStorage.setItem('altaana_guest_session', 'true');
    handleAuthComplete();
  }, [handleAuthComplete]);

  const handleGoogleSignIn = useCallback(async () => {
    const result = await signInWithGoogle();
    if (!result.error) {
      handleAuthComplete();
    }
  }, [signInWithGoogle, handleAuthComplete]);

  const handleEmailSignIn = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (!result.error) {
      handleAuthComplete();
    }
    return result;
  }, [signIn, handleAuthComplete]);

  const handleEmailSignUp = useCallback(async (email: string, password: string) => {
    const result = await signUp(email, password);
    return result;
  }, [signUp]);

  const handleProfileSave = useCallback(async (profile: UserProfile) => {
    setProfile(profile);
    setPanelState("analyzing");

    await fetchRecommendation(
      profile,
      target.brandKey,
      target.category,
      user?.id,
      target.productUrl,
    );

    setPanelState("recommendation");
  }, [fetchRecommendation, target, user]);

  const handleKeep = useCallback(() => {
    if (recommendation) {
      setConfirmedSize(recommendation.size);
      logAdjustment("keep", recommendation.size);
      saveConfirmation(recommendation.size, recommendation);
    }
    setPanelState("confirmed");
  }, [recommendation, logAdjustment, saveConfirmation]);

  const handleSizeDown = useCallback(() => {
    if (recommendation) {
      const newSize = offsetSize(recommendation.size, -1, recommendation.sizeScale);
      setConfirmedSize(newSize);
      logAdjustment("size_down", newSize);
      saveConfirmation(newSize, recommendation);
    }
    setPanelState("confirmed");
  }, [recommendation, logAdjustment, saveConfirmation]);

  const handleSizeUp = useCallback(() => {
    if (recommendation) {
      const newSize = offsetSize(recommendation.size, 1, recommendation.sizeScale);
      setConfirmedSize(newSize);
      logAdjustment("size_up", newSize);
      saveConfirmation(newSize, recommendation);
    }
    setPanelState("confirmed");
  }, [recommendation, logAdjustment, saveConfirmation]);

  const handleAddToCart = useCallback(() => {
    console.log("Go to size selector — scroll to size selector");
  }, []);

  // Build confirmed recommendation with adjusted size
  const confirmedRecommendation: SizeRecommendation | null =
    recommendation
      ? { ...recommendation, size: confirmedSize || recommendation.size }
      : cached
        ? { ...cached.recommendation, size: confirmedSize || cached.size }
        : null;

  const renderScreen = () => {
    switch (panelState) {
      case "profile":
        return <ProfileScreen onSave={handleProfileSave} user={user} />;
      case "analyzing":
        return <AnalyzingScreen />;
      case "recommendation":
        if (recError) {
          return (
            <div className="flex flex-col flex-1 px-5 py-6 items-center justify-center">
              <p className="text-sm text-destructive mb-4">Something went wrong generating your recommendation.</p>
              <button onClick={() => setPanelState("profile")} className="text-xs text-primary underline">
                Try again
              </button>
            </div>
          );
        }
        if (!recommendation) {
          return <AnalyzingScreen />;
        }
        return (
          <RecommendationScreen
            recommendation={recommendation}
            onSizeDown={handleSizeDown}
            onKeep={handleKeep}
            onSizeUp={handleSizeUp}
          />
        );
      case "confirmed":
        if (!confirmedRecommendation) return null;
        return (
          <ConfirmedScreen
            recommendation={confirmedRecommendation}
            onAddToCart={handleAddToCart}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) return null;

  return (
    <>
      {showAuth && (
        <AuthScreen
          onGoogleSignIn={handleGoogleSignIn}
          onEmailSignIn={handleEmailSignIn}
          onEmailSignUp={handleEmailSignUp}
          onContinueWithout={handleContinueWithout}
          onClose={handleClose}
        />
      )}

      <AnimatePresence>
        {!isOpen && !showAuth && (
          <FloatingWidget onClick={handleOpen} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed right-4 top-0 bottom-0 z-50 flex items-center">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="flex flex-col overflow-hidden"
              style={{
                width: 404,
                height: 733,
                maxHeight: "calc(100vh - 32px)",
                borderRadius: 20,
                background: "linear-gradient(180deg, #111010 0%, #0D0D0D 40%, #0A0909 100%)",
                border: "1px solid rgba(0, 206, 209, 0.18)",
                boxShadow: "0 0 60px rgba(0, 206, 209, 0.08), -8px 0 40px rgba(0, 0, 0, 0.5)",
              }}
            >
              <PanelHeader onClose={handleClose} />
              {renderScreen()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ExtensionPanel;
