
-- Add size_scale column to sizing_charts
ALTER TABLE public.sizing_charts
ADD COLUMN size_scale text NOT NULL DEFAULT 'other';
