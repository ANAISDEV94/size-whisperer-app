import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PanelState, UserProfile, SizeRecommendation } from "@/types/panel";
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
  const [isOpen, setIsOpen] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>("auth");
  const [, setProfile] = useState<UserProfile | null>(null);
  const [recommendation] = useState<SizeRecommendation>(MOCK_RECOMMENDATION);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleAuth = useCallback(() => {
    // Placeholder — will connect to Lovable Cloud auth later
    setPanelState("profile");
  }, []);

  const handleProfileSave = useCallback((profile: UserProfile) => {
    setProfile(profile);
    setPanelState("analyzing");
    // Simulate API call
    setTimeout(() => setPanelState("recommendation"), 2000);
  }, []);

  const handleKeep = useCallback(() => {
    setPanelState("confirmed");
  }, []);

  const handleSizeDown = useCallback(() => {
    // In real implementation, adjust and confirm
    setPanelState("confirmed");
  }, []);

  const handleSizeUp = useCallback(() => {
    setPanelState("confirmed");
  }, []);

  const handleAddToCart = useCallback(() => {
    // Will scroll to size selector on host page via postMessage
    console.log("Add to cart — scroll to size selector");
  }, []);

  const renderScreen = () => {
    switch (panelState) {
      case "auth":
        return (
          <AuthScreen
            onGoogleSignIn={handleAuth}
            onEmailSignIn={handleAuth}
            onContinueWithout={handleAuth}
          />
        );
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

  return (
    <>
      <AnimatePresence>
        {!isOpen && <FloatingWidget onClick={handleOpen} />}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[340px] z-50 bg-background border-l border-border flex flex-col shadow-2xl"
          >
            <PanelHeader onClose={handleClose} />
            {renderScreen()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ExtensionPanel;
