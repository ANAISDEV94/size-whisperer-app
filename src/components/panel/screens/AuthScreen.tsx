import { X, Mail } from "lucide-react";
import altaanaLogo from "@/assets/altaana-logo.png";

interface AuthScreenProps {
  onGoogleSignIn: () => void;
  onEmailSignIn: () => void;
  onContinueWithout: () => void;
  onClose?: () => void;
}

const AuthScreen = ({ onGoogleSignIn, onEmailSignIn, onContinueWithout, onClose }: AuthScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 flex flex-col w-[340px]"
        style={{
          background: "linear-gradient(180deg, #0a0809 0%, #070506 100%)",
          border: "1px solid rgba(0, 206, 209, 0.25)",
          borderRadius: 16,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
          padding: "0",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <img
            src={altaanaLogo}
            alt="ALTAANA Essential"
            className="h-5 w-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 28,
              height: 28,
              background: "rgba(255, 255, 255, 0.08)",
            }}
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-6 pt-8 pb-6">
          <h2
            className="font-serif-display text-center leading-tight mb-2"
            style={{ fontSize: 22, fontWeight: 500, color: "#f5f5f5" }}
          >
            Save your size for future shopping
          </h2>
          <p
            className="text-center leading-relaxed mb-8"
            style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.45)", maxWidth: 260 }}
          >
            Sign in once and we'll remember your fit across brands and visits.
          </p>

          {/* Primary CTA — Google */}
          <button
            onClick={onGoogleSignIn}
            className="w-full flex items-center justify-center gap-2.5 rounded-full cursor-pointer transition-opacity hover:opacity-90"
            style={{
              height: 46,
              background: "#00CED1",
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              color: "#070506",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path fill="#070506" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#070506" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#070506" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#070506" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Secondary CTA — Email */}
          <button
            onClick={onEmailSignIn}
            className="w-full flex items-center justify-center gap-2.5 rounded-full cursor-pointer mt-3 transition-opacity hover:opacity-80"
            style={{
              height: 46,
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.85)",
            }}
          >
            <Mail className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.6)" }} />
            Continue with email
          </button>

          {/* Tertiary — Continue without */}
          <button
            onClick={onContinueWithout}
            className="mt-5 cursor-pointer transition-opacity hover:opacity-80"
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.35)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Continue without saving
          </button>

          {/* Footer copy */}
          <p
            className="text-center mt-7 leading-relaxed"
            style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.25)", maxWidth: 240 }}
          >
            We only use this to save your sizing profile. ALTAANA never posts or shares your information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
