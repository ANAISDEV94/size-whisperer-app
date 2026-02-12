import { X, Bug } from "lucide-react";
import altaanaLogo from "@/assets/altaana-modal-logo.png";

interface PanelHeaderProps {
  onClose: () => void;
  debugMode?: boolean;
  onToggleDebug?: () => void;
}

const PanelHeader = ({ onClose, debugMode, onToggleDebug }: PanelHeaderProps) => {
  return (
    <div>
      {/* Header — logo + close, matching AuthScreen exactly */}
      <div className="flex items-start justify-between px-7 pt-7 pb-0">
        <img
          src={altaanaLogo}
          alt="ALTAANA Essential"
          className="w-auto"
          style={{ height: 48 }}
        />
        <div className="flex items-center gap-2">
          {onToggleDebug && (
            <button
              onClick={onToggleDebug}
              className="flex items-center justify-center rounded-full transition-colors hover:opacity-80"
              style={{
                width: 36,
                height: 36,
                background: debugMode ? "rgba(0, 206, 209, 0.15)" : "rgba(255, 255, 255, 0.06)",
                border: debugMode ? "1px solid rgba(0, 206, 209, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                flexShrink: 0,
              }}
              aria-label="Toggle debug mode"
              title="Toggle debug mode"
            >
              <Bug className="w-4 h-4" style={{ color: debugMode ? "hsl(180 70% 50%)" : "rgba(255, 255, 255, 0.5)" }} />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-colors hover:opacity-80"
            style={{
              width: 36,
              height: 36,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            <X className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          </button>
        </div>
      </div>

      {/* Divider after header */}
      <div
        className="mx-7 mt-5"
        style={{ height: 1, background: "rgba(255, 255, 255, 0.08)" }}
      />
    </div>
  );
};

export default PanelHeader;
