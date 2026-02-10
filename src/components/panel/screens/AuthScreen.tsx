import { X, Mail } from "lucide-react";
import altaanaLogo from "@/assets/altaana-modal-logo.png";

interface AuthScreenProps {
  onGoogleSignIn: () => void;
  onEmailSignIn: () => void;
  onContinueWithout: () => void;
  onClose?: () => void;
}

const AuthScreen = ({ onGoogleSignIn, onEmailSignIn, onContinueWithout, onClose }: AuthScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Right-side panel with 16px gap from edge */}
      <div
        className="relative z-10 flex flex-col my-auto mr-4"
        style={{
          width: 404,
          height: 733,
          flexShrink: 0,
          borderRadius: 20,
          background: "linear-gradient(180deg, #111010 0%, #0D0D0D 40%, #0A0909 100%)",
          border: "1px solid rgba(0, 206, 209, 0.18)",
          boxShadow: "0 0 60px rgba(0, 206, 209, 0.08), -8px 0 40px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header — logo + close */}
        <div className="flex items-start justify-between px-7 pt-7 pb-0">
          <img
            src={altaanaLogo}
            alt="ALTAANA Essential"
            className="w-auto"
            style={{ height: 48 }}
          />
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

        {/* Divider after header */}
        <div
          className="mx-7 mt-5"
          style={{ height: 1, background: "rgba(255, 255, 255, 0.08)" }}
        />

        {/* Content */}
        <div className="flex flex-col px-7 pt-10 pb-8">
          {/* Heading — left aligned, serif */}
          <h2
            className="font-serif-display leading-tight"
            style={{ fontSize: 30, fontWeight: 400, color: "#f0f0f0", letterSpacing: "-0.01em" }}
          >
            Save your size for future shopping
          </h2>

          {/* Subtext */}
          <p
            className="leading-relaxed mt-4"
            style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.42)", maxWidth: 340 }}
          >
            Sign in once and we'll remember your fit across brands and visits.
          </p>

          {/* Primary CTA — Google */}
          <button
            onClick={onGoogleSignIn}
            className="flex items-center justify-center gap-3 rounded-full cursor-pointer transition-opacity hover:opacity-90 mt-10 mx-auto"
            style={{
              height: 48.5,
              width: 334,
              background: "#00CED1",
              border: "none",
              fontSize: 16,
              fontWeight: 400,
              color: "#070506",
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Secondary CTA — Email */}
          <button
            onClick={onEmailSignIn}
            className="flex items-center justify-center gap-3 rounded-full cursor-pointer mt-3.5 transition-opacity hover:opacity-80 mx-auto"
            style={{
              height: 48.5,
              width: 334,
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              fontSize: 16,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.8)",
            }}
          >
            <Mail className="w-5 h-5" style={{ color: "rgba(255, 255, 255, 0.55)" }} />
            Continue with email
          </button>

          {/* Tertiary — Continue without */}
          <button
            onClick={onContinueWithout}
            className="mt-7 cursor-pointer transition-opacity hover:opacity-80 self-center"
            style={{
              background: "none",
              border: "none",
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.4)",
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Continue without saving
          </button>

          {/* Tertiary — Continue without */}
          <button
            onClick={onContinueWithout}
            className="mt-7 cursor-pointer transition-opacity hover:opacity-80 self-center"
            style={{
              background: "none",
              border: "none",
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.4)",
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Continue without saving
          </button>

          {/* Divider */}
          <div
            className="mt-8"
            style={{ height: 1, background: "rgba(255, 255, 255, 0.08)" }}
          />

          {/* Footer copy */}
          <p
            className="text-center mt-7 leading-relaxed self-center"
            style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.3)", maxWidth: 320 }}
          >
            We only use this to save your sizing profile.
            <br />
            ALTAANA never posts or shares your information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
