import { Button } from "@/components/ui/button";
import altaanaLogo from "@/assets/altaana-logo.png";

interface AuthScreenProps {
  onGoogleSignIn: () => void;
  onEmailSignIn: () => void;
  onContinueWithout: () => void;
}

const AuthScreen = ({ onGoogleSignIn, onEmailSignIn, onContinueWithout }: AuthScreenProps) => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 text-center">
      <img src={altaanaLogo} alt="ALTAANA Essential" className="h-10 w-auto brightness-0 invert mb-8" />
      
      <h2 className="font-serif-display text-xl font-medium text-foreground mb-2">
        Save your size for future shopping
      </h2>
      <p className="text-sm text-muted-foreground mb-8">
        Sign in to remember your fit across brands
      </p>

      <div className="w-full space-y-3 max-w-[260px]">
        <Button
          onClick={onGoogleSignIn}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-11 text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <Button
          onClick={onEmailSignIn}
          variant="outline"
          className="w-full border-border text-foreground hover:bg-secondary rounded-full h-11 text-sm font-medium"
        >
          Continue with email
        </Button>
      </div>

      <button
        onClick={onContinueWithout}
        className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Continue without saving
      </button>

      <p className="mt-8 text-[10px] text-muted-foreground leading-relaxed max-w-[220px]">
        Your data stays private. We never share your information with brands.
      </p>
    </div>
  );
};

export default AuthScreen;
