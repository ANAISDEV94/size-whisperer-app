import altaanaLogo from "@/assets/altaana-logo.png";

interface PanelHeaderProps {
  onClose: () => void;
}

const PanelHeader = ({ onClose }: PanelHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2">
        <img src={altaanaLogo} alt="ALTAANA Essential" className="h-6 w-auto brightness-0 invert" />
      </div>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
        aria-label="Close panel"
      >
        ✕
      </button>
    </div>
  );
};

export default PanelHeader;
