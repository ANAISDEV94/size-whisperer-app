import { motion } from "framer-motion";
import altaanaLogo from "@/assets/altaana-logo.png";

interface FloatingWidgetProps {
  onClick: () => void;
}

const FloatingWidget = ({ onClick }: FloatingWidgetProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onClick={onClick}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-l-full shadow-lg hover:shadow-xl transition-shadow animate-pulse-glow cursor-pointer"
      aria-label="Find my size"
    >
      <img src={altaanaLogo} alt="" className="h-4 w-auto brightness-0" />
      <span className="text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
        Find My Size
      </span>
    </motion.button>
  );
};

export default FloatingWidget;
