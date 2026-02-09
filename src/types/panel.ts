export type PanelState = 
  | 'idle'
  | 'auth'
  | 'profile'
  | 'analyzing'
  | 'recommendation'
  | 'confirmed';

export type FitPreference = 'fitted' | 'true_to_size' | 'relaxed';

export interface AnchorBrand {
  brandKey: string;
  displayName: string;
  size: string;
}

export interface UserProfile {
  anchorBrands: AnchorBrand[];
  fitPreference: FitPreference;
}

export interface SizeRecommendation {
  size: string;
  brandName: string;
  bullets: string[];
  comparisons: BrandComparison[];
}

export interface BrandComparison {
  brandName: string;
  size: string;
  fitTag: string; // e.g., "true to size", "runs small", "snug fit"
}

export const SUPPORTED_BRANDS = [
  "Lovers + Friends",
  "Michael Costello",
  "Retrofete",
  "Revolve Denim",
  "Helsa",
  "Norma Kamali",
  "Bronx and Banco",
  "House of Harlow 1960",
  "Bardot",
  "Superdown",
  "For Love and Lemons",
  "Alice + Olivia",
  "Reformation",
  "SKIMS",
  "NikeSKIMS",
  "7 For All Mankind",
  "Mother",
  "Zimmermann",
  "Versace",
  "Victoria Beckham",
  "Rabanne",
  "Stella McCartney",
  "Dolce & Gabbana",
  "&/Or Collective",
  "Balmain",
  "Carolina Herrera",
  "Alaïa",
  "Aritzia",
  "David Koma",
  "Gucci",
  "Tom Ford",
  "Valentino",
  "Cult Gaia",
  "Prada",
  "Torrid",
  "Alo Yoga",
  "CSB",
  "Lululemon",
] as const;

export const NUMERIC_SIZES = ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"];
export const LETTER_SIZES = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "2X", "3X", "4X"];
export const ALL_SIZES = [...NUMERIC_SIZES, ...LETTER_SIZES];
