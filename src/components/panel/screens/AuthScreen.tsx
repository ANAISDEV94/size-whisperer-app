import { useState } from "react";
import { X, Mail, ArrowLeft, Eye, EyeOff } from "lucide-react";
import altaanaLogo from "@/assets/altaana-modal-logo.png";

type AuthView = "main" | "email-signin" | "email-signup";

interface AuthScreenProps {
  onGoogleSignIn: () => void;
  onEmailSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onEmailSignUp: (email: string, password: string) => Promise<{ error: string | null }>;
  onContinueWithout: () => void;
  onClose?: () => void;
}

const AuthScreen = ({
  onGoogleSignIn,
  onEmailSignIn,
  onEmailSignUp,
  onContinueWithout,
  onClose,
}: AuthScreenProps) => {
  const [view, setView] = useState<AuthView>("main");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccessMessage(null);
    setShowPassword(false);
  };

  const handleBack = () => {
    resetForm();
    setView("main");
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await onEmailSignIn(email, password);
    setIsSubmitting(false);
    if (result.error) setError(result.error);
  };

  const handleEmailSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await onEmailSignUp(email, password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Check your email to verify your account, then sign in.");
    }
  };

  const inputStyle = {
    height: 48.5,
    width: 334,
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 9999,
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.85)",
    paddingLeft: 20,
    paddingRight: 20,
    outline: "none",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative z-10 flex flex-col my-auto mr-4 overflow-y-auto"
        style={{
          width: 404,
          height: 733,
          maxHeight: "calc(100vh - 32px)",
          flexShrink: 0,
          borderRadius: 20,
          background: "linear-gradient(180deg, #111010 0%, #0D0D0D 40%, #0A0909 100%)",
          border: "1px solid rgba(0, 206, 209, 0.18)",
          boxShadow: "0 0 60px rgba(0, 206, 209, 0.08), -8px 0 40px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-7 pb-0 flex-shrink-0">
          {view !== "main" ? (
            <button
              onClick={handleBack}
              className="flex items-center justify-center rounded-full transition-colors hover:opacity-80"
              style={{
                width: 36,
                height: 36,
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
            </button>
          ) : (
            <img
              src={altaanaLogo}
              alt="ALTAANA Essential"
              className="w-auto"
              style={{ height: 48 }}
            />
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

        <div
          className="mx-7 mt-5 flex-shrink-0"
          style={{ height: 1, background: "rgba(255, 255, 255, 0.08)" }}
        />

        {/* Main view */}
        {view === "main" && (
          <div className="flex flex-col px-7 pt-10 pb-8">
            <h2
              className="font-serif-display leading-tight"
              style={{ fontSize: 30, fontWeight: 400, color: "#f0f0f0", letterSpacing: "-0.01em" }}
            >
              Save your size for future shopping
            </h2>

            <p
              className="leading-relaxed mt-4"
              style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.42)", maxWidth: 340 }}
            >
              Sign in once and we'll remember your fit across brands and visits.
            </p>

            {/* Google */}
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

            {/* Email sign-in */}
            <button
              onClick={() => { resetForm(); setView("email-signin"); }}
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

            {/* Continue without */}
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

            <div
              className="mt-8"
              style={{ height: 1, background: "rgba(255, 255, 255, 0.08)" }}
            />

            <p
              className="text-center mt-7 leading-relaxed self-center"
              style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.3)", maxWidth: 320 }}
            >
              We only use this to save your sizing profile.
              <br />
              ALTAANA never posts or shares your information.
            </p>
          </div>
        )}

        {/* Email Sign In view */}
        {view === "email-signin" && (
          <div className="flex flex-col px-7 pt-10 pb-8">
            <h2
              className="font-serif-display leading-tight"
              style={{ fontSize: 28, fontWeight: 400, color: "#f0f0f0", letterSpacing: "-0.01em" }}
            >
              Sign in with email
            </h2>

            <p
              className="leading-relaxed mt-3"
              style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.42)" }}
            >
              Welcome back — enter your credentials below.
            </p>

            <div className="flex flex-col gap-3 mt-8 items-center">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
              />
              <div className="relative" style={{ width: 334 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 48 }}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.35)" }} />
                  ) : (
                    <Eye className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.35)" }} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-4 text-center" style={{ fontSize: 13, color: "#ef4444" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleEmailSignIn}
              disabled={isSubmitting}
              className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-90 mt-8 mx-auto disabled:opacity-50"
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
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>

            <div className="mt-8 self-center">
              <span style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.4)" }}>
                Don't have an account?{" "}
              </span>
              <button
                onClick={() => { resetForm(); setView("email-signup"); }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 14,
                  color: "#00CED1",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                Create one
              </button>
            </div>
          </div>
        )}

        {/* Email Sign Up view */}
        {view === "email-signup" && (
          <div className="flex flex-col px-7 pt-10 pb-8">
            <h2
              className="font-serif-display leading-tight"
              style={{ fontSize: 28, fontWeight: 400, color: "#f0f0f0", letterSpacing: "-0.01em" }}
            >
              Create your account
            </h2>

            <p
              className="leading-relaxed mt-3"
              style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.42)" }}
            >
              We'll save your sizing profile so you never have to guess again.
            </p>

            {successMessage ? (
              <div className="mt-8 flex flex-col items-center gap-6">
                <div
                  className="rounded-2xl px-6 py-5 text-center"
                  style={{
                    background: "rgba(0, 206, 209, 0.08)",
                    border: "1px solid rgba(0, 206, 209, 0.2)",
                    maxWidth: 334,
                  }}
                >
                  <p style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.6 }}>
                    {successMessage}
                  </p>
                </div>
                <button
                  onClick={() => { resetForm(); setView("email-signin"); }}
                  className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-90 mx-auto"
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
                  Go to sign in
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 mt-8 items-center">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    autoComplete="email"
                  />
                  <div className="relative" style={{ width: 334 }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: 48 }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      style={{ background: "none", border: "none" }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.35)" }} />
                      ) : (
                        <Eye className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.35)" }} />
                      )}
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={inputStyle}
                    autoComplete="new-password"
                    onKeyDown={(e) => e.key === "Enter" && handleEmailSignUp()}
                  />
                </div>

                {error && (
                  <p className="mt-4 text-center" style={{ fontSize: 13, color: "#ef4444" }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={handleEmailSignUp}
                  disabled={isSubmitting}
                  className="flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-90 mt-8 mx-auto disabled:opacity-50"
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
                  {isSubmitting ? "Creating account…" : "Create account"}
                </button>

                <div className="mt-8 self-center">
                  <span style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.4)" }}>
                    Already have an account?{" "}
                  </span>
                  <button
                    onClick={() => { resetForm(); setView("email-signin"); }}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 14,
                      color: "#00CED1",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 4,
                    }}
                  >
                    Sign in
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;
