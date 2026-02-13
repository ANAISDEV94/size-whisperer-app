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
  weight?: string;
  height?: string;
}

export interface SizeRecommendation {
  size: string;
  brandName: string;
  sizeScale: "numeric" | "letter";
  bullets: string[];
  comparisons: BrandComparison[];
  needMoreInfo?: boolean;
  askFor?: string;
  needMoreInfoReason?: string;
  betweenSizes?: [string, string] | null;
  matchExplanation?: string;
  debug?: DebugTrace;
}

export interface DebugTrace {
  detectedCategoryRaw?: string;
  normalizedCategory?: string;
  categoryFallbackUsed?: boolean;
  anchorBrand: string;
  anchorSize: string;
  anchorSizeType?: string;
  anchorScaleTrack?: string;
  targetBrandKey: string;
  targetBrandDisplayName: string;
  targetSizeScale: string;
  availableSizes: string[];
  fitPreference: string;
  targetFitTendency: string | null;
  trackUsed?: string;
  targetTracksAvailable?: string[];
  conversionFallbackUsed?: boolean;
  keyDimensionsList: string[];
  usedFallback: boolean;
  usedEstimatedMeasurements: boolean;
  matchExplanation?: string;
  betweenSizes?: [string, string] | null;
  targetRowUsed: {
    size_label: string;
    measurements: Record<string, unknown> | null;
    fit_notes: string | null;
  } | null;
  sizeDetails?: Record<string, { dimension: string; userMid: number; rangeMin: number; rangeMax: number; contained: boolean }[]>;
  targetRowsConsidered?: number;
}

export interface BrandComparison {
  brandName: string;
  size: string;
  fitTag: string;
}

export const SUPPORTED_BRANDS = [
  "&/Or Collective",
  "7 For All Mankind",
  "Alaïa",
  "Alice + Olivia",
  "Alo Yoga",
  "Aritzia",
  "Balmain",
  "Bardot",
  "Bronx and Banco",
  "Carolina Herrera",
  "CSB",
  "Cult Gaia",
  "David Koma",
  "Dolce & Gabbana",
  "For Love and Lemons",
  "Gucci",
  "Helsa",
  "House of Harlow 1960",
  "Lovers + Friends",
  "Lululemon",
  "Michael Costello",
  "Mother",
  "NikeSKIMS",
  "Norma Kamali",
  "Prada",
  "Rabanne",
  "Reformation",
  "Retrofete",
  "Revolve Denim",
  "SKIMS",
  "Stella McCartney",
  "Superdown",
  "Tom Ford",
  "Torrid",
  "Valentino",
  "Versace",
  "Victoria Beckham",
  "Zimmermann",
] as const;

export const NUMERIC_SIZES = ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"];
export const LETTER_SIZES = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "2X", "3X", "4X"];
export const ALL_SIZES = [...NUMERIC_SIZES, ...LETTER_SIZES];
