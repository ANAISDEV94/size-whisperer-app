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
  const [confirmedSize, setConfirmedSize] = useState<string | null>(null);
  const [confirmedBrand, setConfirmedBrand] = useState<string | null>(null);

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
    setConfirmedSize(recommendation.size);
    setConfirmedBrand(recommendation.brandName);
    setPanelState("confirmed");
  }, [recommendation]);

  const handleSizeDown = useCallback(() => {
    setConfirmedSize(recommendation.size);
    setConfirmedBrand(recommendation.brandName);
    setPanelState("confirmed");
  }, [recommendation]);

  const handleSizeUp = useCallback(() => {
    setConfirmedSize(recommendation.size);
    setConfirmedBrand(recommendation.brandName);
    setPanelState("confirmed");
  }, [recommendation]);

  const handleAddToCart = useCallback(() => {
    // Will scroll to size selector on host page via postMessage
    console.log("Add to cart — scroll to size selector");
  }, []);

  const renderScreen = () => {
    switch (panelState) {
      case "auth":
        return null;
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
      {/* Auth modal — shown as overlay, independent of panel */}
      {panelState === "auth" && (
        <AuthScreen
          onGoogleSignIn={handleAuth}
          onEmailSignIn={handleAuth}
          onContinueWithout={handleAuth}
          onClose={() => setPanelState("auth")}
        />
      )}

      <AnimatePresence>
        {!isOpen && panelState !== "auth" && (
          <FloatingWidget
            onClick={handleOpen}
            confirmedSize={confirmedSize}
            confirmedBrand={confirmedBrand}
          />
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
