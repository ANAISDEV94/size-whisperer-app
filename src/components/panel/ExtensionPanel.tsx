import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PanelState, UserProfile, SizeRecommendation } from "@/types/panel";
import { useAuth } from "@/hooks/useAuth";
import FloatingWidget from "./FloatingWidget";
import PanelHeader from "./PanelHeader";
import AuthScreen from "./screens/AuthScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AnalyzingScreen from "./screens/AnalyzingScreen";
import RecommendationScreen from "./screens/RecommendationScreen";
import ConfirmedScreen from "./screens/ConfirmedScreen";

// Mock recommendation for demo purposes
const MOCK_RECOMMENDATION: SizeRecommendation = {
  size: "Large",
  brandName: "CSB",
  bullets: [
    "You wear Medium in Alo Yoga",
    "This CSB top runs smaller in the bust",
    "Most shoppers size up in this item",
  ],
  comparisons: [
    { brandName: "Alo Yoga", size: "Medium", fitTag: "true to size" },
    { brandName: "CSB", size: "Large", fitTag: "runs small" },
    { brandName: "Lululemon", size: "Medium", fitTag: "snug fit" },
  ],
};

const ExtensionPanel = () => {
  const { user, isLoading, signUp, signIn, signInWithGoogle, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>("profile");
  const [, setProfile] = useState<UserProfile | null>(null);
  const [recommendation] = useState<SizeRecommendation>(MOCK_RECOMMENDATION);

  const handleOpen = useCallback(() => {
    if (!user) {
      // First-time or logged-out user: show auth
      setShowAuth(true);
    } else {
      // Returning user: go straight to panel
      setIsOpen(true);
    }
  }, [user]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setShowAuth(false);
  }, []);

  const handleAuthComplete = useCallback(() => {
    // Auth succeeded or user chose to continue without saving
    setShowAuth(false);
    setIsOpen(true);
    setPanelState("profile");
  }, []);

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
    // Don't auto-complete — user needs to verify email first
    return result;
  }, [signUp]);

  const handleProfileSave = useCallback((profile: UserProfile) => {
    setProfile(profile);
    setPanelState("analyzing");
    setTimeout(() => setPanelState("recommendation"), 2000);
  }, []);

  const handleKeep = useCallback(() => {
    setPanelState("confirmed");
  }, []);

  const handleSizeDown = useCallback(() => {
    setPanelState("confirmed");
  }, []);

  const handleSizeUp = useCallback(() => {
    setPanelState("confirmed");
  }, []);

  const handleAddToCart = useCallback(() => {
    console.log("Go to size selector — scroll to size selector");
  }, []);

  const renderScreen = () => {
    switch (panelState) {
      case "profile":
        return <ProfileScreen onSave={handleProfileSave} />;
      case "analyzing":
        return <AnalyzingScreen />;
      case "recommendation":
        return (
          <RecommendationScreen
            recommendation={recommendation}
            onSizeDown={handleSizeDown}
            onKeep={handleKeep}
            onSizeUp={handleSizeUp}
          />
        );
      case "confirmed":
        return (
          <ConfirmedScreen
            recommendation={recommendation}
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
      {/* Auth modal */}
      {showAuth && (
        <AuthScreen
          onGoogleSignIn={handleGoogleSignIn}
          onEmailSignIn={handleEmailSignIn}
          onEmailSignUp={handleEmailSignUp}
          onContinueWithout={handleAuthComplete}
          onClose={handleClose}
        />
      )}

      {/* Floating widget — visible when panel and auth are both closed */}
      <AnimatePresence>
        {!isOpen && !showAuth && (
          <FloatingWidget onClick={handleOpen} />
        )}
      </AnimatePresence>

      {/* Slide-in panel */}
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
