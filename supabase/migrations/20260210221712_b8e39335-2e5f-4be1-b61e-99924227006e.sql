
-- Add size_scale column to track what sizing system each brand uses
ALTER TABLE public.brand_catalog 
ADD COLUMN size_scale text NOT NULL DEFAULT 'letter';

-- Set known numeric-scale brands
UPDATE public.brand_catalog SET size_scale = 'numeric' WHERE brand_key IN (
  'bardot', 'alice_and_olivia', 'cult_gaia', 'david_koma', 'bronx_and_banco',
  'carolina_herrera', 'dolce_and_gabbana', 'gucci', 'prada', 'balmain',
  'rabanne', 'stella_mccartney', 'tom_ford', 'valentino', 'versace',
  'victoria_beckham', 'zimmermann', 'retrofete', 'mother',
  'seven_for_all_mankind', 'revolve_denim', 'for_love_and_lemons'
);

-- Set known letter-scale brands
UPDATE public.brand_catalog SET size_scale = 'letter' WHERE brand_key IN (
  'csb', 'alo_yoga', 'lululemon', 'skims', 'nikeskims', 'torrid',
  'superdown', 'helsa', 'house_of_harlow_1960', 'lovers_and_friends',
  'michael_costello', 'norma_kamali', 'reformation', 'aritzia',
  'and_or_collective', 'alaia'
);
