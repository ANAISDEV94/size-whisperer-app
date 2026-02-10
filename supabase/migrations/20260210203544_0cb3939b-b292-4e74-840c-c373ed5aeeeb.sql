
-- =============================================
-- MILESTONE 4: Brand Data + Sizing Schema
-- =============================================

-- 1a. brand_catalog table
CREATE TABLE public.brand_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  domains TEXT[] DEFAULT '{}',
  fit_tendency TEXT,
  garment_categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read brand_catalog"
  ON public.brand_catalog FOR SELECT
  USING (true);

CREATE TRIGGER update_brand_catalog_updated_at
  BEFORE UPDATE ON public.brand_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 1b. sizing_charts table
CREATE TABLE public.sizing_charts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_key TEXT NOT NULL REFERENCES public.brand_catalog(brand_key) ON DELETE CASCADE,
  category TEXT NOT NULL,
  size_label TEXT NOT NULL,
  measurements JSONB,
  raw_measurements JSONB,
  fit_notes TEXT,
  airtable_record_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sizing_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sizing_charts"
  ON public.sizing_charts FOR SELECT
  USING (true);

CREATE INDEX idx_sizing_charts_brand_key ON public.sizing_charts(brand_key);
CREATE INDEX idx_sizing_charts_brand_category ON public.sizing_charts(brand_key, category);

-- 1c. Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN anchor_brands JSONB,
  ADD COLUMN fit_preference TEXT;

-- 1d. recommendations table
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_key TEXT NOT NULL,
  product_url TEXT,
  recommended_size TEXT NOT NULL,
  explanation_bullets JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON public.recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations"
  ON public.recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_recommendations_user_id ON public.recommendations(user_id);

-- 1e. user_adjustments table
CREATE TABLE public.user_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  final_size TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adjustments"
  ON public.user_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE r.id = recommendation_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own adjustments"
  ON public.user_adjustments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE r.id = recommendation_id AND r.user_id = auth.uid()
    )
  );
