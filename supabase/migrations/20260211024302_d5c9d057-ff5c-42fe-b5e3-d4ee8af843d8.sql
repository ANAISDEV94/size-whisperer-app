
-- 1. Add missing DELETE policy on user_adjustments
CREATE POLICY "Users can delete own adjustments"
  ON public.user_adjustments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE r.id = user_adjustments.recommendation_id AND r.user_id = auth.uid()
    )
  );

-- 2. Drop the email column from profiles (it's already in auth.users)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
