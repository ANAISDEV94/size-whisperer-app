
-- Create table for logging low-confidence recommendation events
CREATE TABLE public.low_confidence_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  target_brand TEXT NOT NULL,
  category TEXT NOT NULL,
  anchor_brand TEXT NOT NULL,
  anchor_size TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  coverage INTEGER NOT NULL,
  reason TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.low_confidence_logs ENABLE ROW LEVEL SECURITY;

-- Service role inserts via edge function; no user-facing access needed
-- Allow service role full access (implicit), deny anon/authenticated
CREATE POLICY "No public access to low_confidence_logs"
  ON public.low_confidence_logs
  FOR SELECT
  USING (false);
