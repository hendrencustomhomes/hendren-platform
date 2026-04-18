CREATE OR REPLACE FUNCTION public.is_internal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internal_access ia
    WHERE ia.profile_id = auth.uid()
      AND ia.is_active = true
  );
$$;
