
-- Add available_sizes column to brand_catalog
ALTER TABLE public.brand_catalog ADD COLUMN available_sizes text[] NOT NULL DEFAULT '{}';

-- Populate brand-specific sizes
-- Letter-scale brands (standard US)
UPDATE public.brand_catalog SET available_sizes = ARRAY['XXS','XS','S','M','L','XL','2X','3X'] WHERE brand_key IN ('csb','alo_yoga','aritzia','helsa','house_of_harlow_1960','lovers_and_friends','lululemon','michael_costello','nikeskims','norma_kamali','reformation','skims','superdown','torrid');

-- Numeric-scale brands (standard US)
UPDATE public.brand_catalog SET available_sizes = ARRAY['00','0','2','4','6','8','10','12','14'] WHERE brand_key IN ('bardot','alice_and_olivia','for_love_and_lemons','mother','revolve_denim','cult_gaia','bronx_and_banco','david_koma','carolina_herrera','seven_for_all_mankind');

-- European numeric brands (IT/FR sizing)
UPDATE public.brand_catalog SET available_sizes = ARRAY['34','36','38','40','42','44','46','48'] WHERE brand_key IN ('gucci','prada','dolce_and_gabbana','valentino','versace','balmain','rabanne','stella_mccartney','tom_ford','victoria_beckham','alaia');

-- Retrofete (US numeric + some letter)
UPDATE public.brand_catalog SET available_sizes = ARRAY['XS','S','M','L','XL'] WHERE brand_key = 'retrofete';

-- Zimmermann (own scale 0-5)
UPDATE public.brand_catalog SET available_sizes = ARRAY['0','1','2','3','4','5'] WHERE brand_key = 'zimmermann';

-- &/Or Collective
UPDATE public.brand_catalog SET available_sizes = ARRAY['XS','S','M','L','XL'] WHERE brand_key = 'and_or_collective';

-- Torrid (numeric plus sizing)
UPDATE public.brand_catalog SET available_sizes = ARRAY['10','12','14','16','18','20','22','24','26','28','30'] WHERE brand_key = 'torrid';
