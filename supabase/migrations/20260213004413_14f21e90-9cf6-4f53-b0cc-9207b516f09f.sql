
-- Create recommendation_runs audit table
CREATE TABLE public.recommendation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  target_brand TEXT NOT NULL,
  category TEXT NOT NULL,
  product_url TEXT,
  anchor_brand TEXT NOT NULL,
  anchor_size TEXT NOT NULL,
  output_status TEXT NOT NULL DEFAULT 'OK',
  recommended_size TEXT,
  confidence INTEGER NOT NULL DEFAULT 0,
  coverage INTEGER NOT NULL DEFAULT 0,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  ask_for TEXT
);

-- Enable RLS
ALTER TABLE public.recommendation_runs ENABLE ROW LEVEL SECURITY;

-- No public read — only service role writes
CREATE POLICY "No public access to recommendation_runs"
  ON public.recommendation_runs
  FOR SELECT
  USING (false);
