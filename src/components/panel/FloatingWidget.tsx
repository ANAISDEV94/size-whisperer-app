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
      className="flex items-center cursor-pointer"
      style={{
        width: 180,
        height: 41,
        borderRadius: "61.5px 0 0 61.5px",
        background: "#070506",
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2)",
        padding: 0,
        border: "none",
      }}
      aria-label="Find my size"
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 41,
          height: 41,
          borderRadius: "50%",
          background: "#070506",
        }}
      >
        <img
          src={altaanaLogo}
          alt=""
          className="w-10 h-10 object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>

      <span
        className="whitespace-nowrap"
        style={{
          color: "#00CED1",
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          paddingRight: 28,
          paddingLeft: 4,
        }}
      >
        Find My Size
      </span>
    </motion.button>
  );
};

export default FloatingWidget;
