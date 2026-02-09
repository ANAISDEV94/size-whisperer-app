import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const AnalyzingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="mb-6"
      >
        <Loader2 className="w-10 h-10 text-primary" />
      </motion.div>
      <h2 className="font-serif-display text-lg font-medium text-foreground mb-2">
        Analyzing fit…
      </h2>
      <p className="text-xs text-muted-foreground text-center">
        Cross-referencing your sizing profile with this brand
      </p>
    </div>
  );
};

export default AnalyzingScreen;
