import { motion } from "framer-motion";
import { Check } from "lucide-react";
import altaanaLogo from "@/assets/altaana-logo.png";

interface FloatingWidgetProps {
  onClick: () => void;
  confirmedSize?: string | null;
  confirmedBrand?: string | null;
}

const FloatingWidget = ({ onClick, confirmedSize, confirmedBrand }: FloatingWidgetProps) => {
  const isConfirmed = !!confirmedSize;

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onClick={onClick}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center cursor-pointer"
      style={{
        width: isConfirmed ? "auto" : 180,
        height: 41,
        borderRadius: "61.5px 0 0 61.5px",
        background: "#070506",
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2)",
        padding: 0,
        border: "none",
      }}
      aria-label={isConfirmed ? `Size confirmed: ${confirmedSize}` : "Find my size"}
    >
      {/* Left circular logo container */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 41,
          height: 41,
          borderRadius: "50%",
          background: "#070506",
        }}
      >
        {isConfirmed ? (
          <Check className="w-4 h-4" style={{ color: "#00CED1" }} strokeWidth={2.5} />
        ) : (
          <img
            src={altaanaLogo}
            alt=""
            className="w-10 h-10 object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        )}
      </div>

      {/* Right CTA pill text */}
      <span
        className="whitespace-nowrap"
        style={{
          color: "#00CED1",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          paddingRight: isConfirmed ? 24 : 28,
          paddingLeft: 4,
        }}
      >
        {isConfirmed ? `${confirmedSize} — ${confirmedBrand}` : "Find My Size"}
      </span>
    </motion.button>
  );
};

export default FloatingWidget;
