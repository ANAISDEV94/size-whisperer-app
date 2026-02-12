import { useState, useCallback, useMemo } from "react";
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

// Size offset helpers
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

// Detect embedded mode from URL params
const isEmbedded = (() => {
  const params = new URLSearchParams(window.location.search);
  return params.get("embedded") === "1" || params.get("source") === "extension";
})();

if (isEmbedded) {
  console.log("[Altaana][panel] Embedded mode ON - launcher suppressed");
}

const ExtensionPanel = () => {
  const { user, isLoading, signUp, signIn, signInWithGoogle, signOut } = useAuth();
  const { recommendation, recommendationId, isLoading: recLoading, error: recError, fetchRecommendation, logAdjustment } = useRecommendation();
  const target = useTargetBrand();
  const { cached, save: saveConfirmation } = useConfirmationMemory(target.brandKey, target.productUrl);

  const [isOpen, setIsOpen] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>(cached ? "confirmed" : "profile");
  const [, setProfile] = useState<UserProfile | null>(null);
  const [confirmedSize, setConfirmedSize] = useState<string | null>(cached?.size || null);

  const isGuest = typeof window !== 'undefined' && localStorage.getItem('altaana_guest_session') === 'true';

  const notifyParentResize = useCallback((mode: "panel" | "widget") => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "ALTAANA_PANEL_RESIZE", mode }, "*");
    }
  }, []);

  const handleOpen = useCallback(() => {
    // Always open the single shell; set initial screen based on auth state
    if (!user && !isGuest) {
      setPanelState("auth");
    } else {
      setPanelState(cached ? "confirmed" : "profile");
    }
    setIsOpen(true);
    notifyParentResize("panel");
  }, [user, isGuest, cached, notifyParentResize]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    notifyParentResize("widget");
  }, [notifyParentResize]);

  const handleAuthComplete = useCallback(() => {
    setPanelState("profile");
  }, []);

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

  const [lastProfile, setLastProfile] = useState<UserProfile | null>(null);

  const handleProfileSave = useCallback(async (profile: UserProfile) => {
    setProfile(profile);
    setLastProfile(profile);
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

  const handleRecalculate = useCallback(async (weight: string, height: string) => {
    if (!lastProfile) return;
    await fetchRecommendation(
      lastProfile,
      target.brandKey,
      target.category,
      user?.id,
      target.productUrl,
      weight,
      height,
    );
  }, [lastProfile, fetchRecommendation, target, user]);

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

  const confirmedRecommendation: SizeRecommendation | null =
    recommendation
      ? { ...recommendation, size: confirmedSize || recommendation.size }
      : cached
        ? { ...cached.recommendation, size: confirmedSize || cached.size }
        : null;

  const renderScreen = () => {
    switch (panelState) {
      case "auth":
        return (
          <AuthScreen
            key="auth"
            onGoogleSignIn={handleGoogleSignIn}
            onEmailSignIn={handleEmailSignIn}
            onEmailSignUp={handleEmailSignUp}
            onContinueWithout={handleContinueWithout}
          />
        );
      case "profile":
        return <ProfileScreen key="profile" onSave={handleProfileSave} user={user} />;
      case "analyzing":
        return <AnalyzingScreen key="analyzing" />;
      case "recommendation":
        if (recError) {
          return (
            <div key="rec-error" className="flex flex-col flex-1 px-5 py-6 items-center justify-center">
              <p className="text-sm text-destructive mb-4">Something went wrong generating your recommendation.</p>
              <button onClick={() => setPanelState("profile")} className="text-xs text-primary underline">
                Try again
              </button>
            </div>
          );
        }
        if (!recommendation) {
          return <AnalyzingScreen key="analyzing-fallback" />;
        }
        return (
          <RecommendationScreen
            key="recommendation"
            recommendation={recommendation}
            onSizeDown={handleSizeDown}
            onKeep={handleKeep}
            onSizeUp={handleSizeUp}
            onRecalculate={handleRecalculate}
            isRecalculating={recLoading}
          />
        );
      case "confirmed":
        if (!confirmedRecommendation) return null;
        return (
          <ConfirmedScreen
            key="confirmed"
            recommendation={confirmedRecommendation}
            onAddToCart={handleAddToCart}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) return null;

  // In embedded mode: render panel content directly, no launcher
  if (isEmbedded) {
    return (
      <div
        className="flex flex-col overflow-hidden w-full h-full"
        style={{
          background: "linear-gradient(180deg, #111010 0%, #0D0D0D 40%, #0A0909 100%)",
        }}
      >
        <PanelHeader onClose={() => {}} />
        {renderScreen()}
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
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
                boxShadow: "none",
              }}
            >
              <PanelHeader onClose={handleClose} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={panelState}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col flex-1 overflow-hidden"
                >
                  {renderScreen()}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ExtensionPanel;
