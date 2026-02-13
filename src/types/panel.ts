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
  confidence?: ConfidenceInfo;
  needMoreInfo?: boolean;
  askFor?: string;
  needMoreInfoReason?: string;
  debug?: DebugTrace;
}

export interface ConfidenceInfo {
  score: number;
  reasons: string[];
  matchMethod: "measurement" | "fallback_index" | "fallback_legacy";
}

export interface DimensionDeviation {
  dimension: string;
  userMin: number;
  userMax: number;
  userMidpoint: number;
  targetMin: number;
  targetMax: number;
  deviation: number;
  overlap: number;
  insideRange: boolean;
}

export interface DebugTrace {
  detectedCategoryRaw?: string;
  normalizedCategory?: string;
  airtableCategoryMatchesCount?: number;
  detectedCategory?: string; // legacy compat
  detectionSource: string;
  anchorBrand: string;
  anchorSize: string;
  anchorMeasurements: Record<string, number>;
  anchorMeasurementsRaw: Record<string, { min: number | null; max: number | null; midpoint: number | null }>;
  missingDimensions: string[];
  measurementCoverage: number;
  keyDimensionsList: string[];
  targetBrandKey: string;
  targetBrandDisplayName: string;
  targetSizeScale: string;
  availableSizes: string[];
  fitPreference: string;
  targetFitTendency: string | null;
  anchorSizeSystem?: string;
  anchorSizeType?: string;
  anchorRowChosen?: { sizeLabel: string; measurements: Record<string, unknown> | null } | null;
  targetSizeTypeSearched?: string;
  conversionFallbackUsed?: boolean;
  categoryFallbackUsed?: boolean;
  sizeSystemFilterUsed?: string;
  targetRowsBeforeSystemFilter?: number;
  targetRowsAfterSystemFilter?: number;
  targetRowsFilteredOut?: number;
  isDenimScale: boolean;
  usedFallback: boolean;
  usedEstimatedMeasurements: boolean;
  targetRowUsed: {
    size_label: string;
    measurements: Record<string, unknown> | null;
    fit_notes: string | null;
  } | null;
  top3Candidates: { size: string; score: number; matched: number; totalOverlap?: number; deviations?: DimensionDeviation[] }[];
  allSizeScores: { size: string; score: number; matched: number; totalOverlap?: number; deviations?: DimensionDeviation[] }[];
  comparisonLogic: string[];
}

export interface BrandComparison {
  brandName: string;
  size: string;
  fitTag: string; // e.g., "true to size", "runs small", "snug fit"
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
