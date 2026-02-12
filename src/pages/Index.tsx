import { useEffect } from "react";
import ExtensionPanel from "@/components/panel/ExtensionPanel";

const isEmbedded = window.location !== window.parent.location;

// Add embedded class to html + body for transparent background
if (isEmbedded) {
  document.documentElement.classList.add("embedded");
  document.body.classList.add("embedded");
}

const Index = () => {
  // When embedded in extension iframe, render only the panel with transparent bg
  if (isEmbedded) {
    return <ExtensionPanel />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simulated product page background for demo */}
      <div className="max-w-4xl mx-auto px-8 py-16">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Product Detail Page (Demo)</p>
        <h1 className="font-serif-display text-3xl text-foreground mb-2">Sample Product</h1>
        <p className="text-sm text-muted-foreground mb-8">
          This simulates a product page. Click the "Find My Size" widget on the right to open the ALTAANA panel.
        </p>
        <div className="w-full h-96 rounded-xl bg-secondary flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Product image placeholder</span>
        </div>
      </div>

      <ExtensionPanel />
    </div>
  );
};

export default Index;
