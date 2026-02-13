-- ============================================================
-- Fix infinite recursion in user_profiles RLS policies
-- The policies added in 20260213120000 reference user_profiles
-- from within user_profiles policies, causing recursion.
-- Solution: SECURITY DEFINER helper functions that bypass RLS.
-- ============================================================

-- Helper functions in public schema (bypass RLS to look up current user)
CREATE OR REPLACE FUNCTION public.current_user_festival_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT festival_id FROM user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$;

-- Drop the recursive policies on user_profiles
DROP POLICY IF EXISTS "Admins can read festival profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage user profiles" ON user_profiles;

-- Recreate using helper functions (no recursion)
CREATE POLICY "Admins can read festival profiles"
  ON user_profiles FOR SELECT
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'admin'
  );

CREATE POLICY "Admins can manage user profiles"
  ON user_profiles FOR ALL
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'admin'
  );

-- Also update other tables' policies to use the helper functions
-- (these didn't cause recursion but are cleaner)

-- sponsors
DROP POLICY IF EXISTS "Non-sponsor members can read sponsors" ON sponsors;
DROP POLICY IF EXISTS "Sponsors can read own sponsor record" ON sponsors;
DROP POLICY IF EXISTS "Sponsors can update own sponsor record" ON sponsors;
DROP POLICY IF EXISTS "Admins can manage sponsors" ON sponsors;

CREATE POLICY "Non-sponsor members can read sponsors"
  ON sponsors FOR SELECT
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() IN ('admin', 'board', 'crew', 'accountant')
  );

CREATE POLICY "Sponsors can read own sponsor record"
  ON sponsors FOR SELECT
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'sponsor'
    AND contact_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Sponsors can update own sponsor record"
  ON sponsors FOR UPDATE
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'sponsor'
    AND contact_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'sponsor'
    AND contact_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage sponsors"
  ON sponsors FOR ALL
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'admin'
  );

-- sponsor_deliverables
DROP POLICY IF EXISTS "Non-sponsor members can read deliverables" ON sponsor_deliverables;
DROP POLICY IF EXISTS "Sponsors can read own deliverables" ON sponsor_deliverables;
DROP POLICY IF EXISTS "Admins can manage sponsor_deliverables" ON sponsor_deliverables;

CREATE POLICY "Non-sponsor members can read deliverables"
  ON sponsor_deliverables FOR SELECT
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() IN ('admin', 'board', 'crew', 'accountant')
  );

CREATE POLICY "Sponsors can read own deliverables"
  ON sponsor_deliverables FOR SELECT
  USING (
    sponsor_id IN (
      SELECT s.id FROM sponsors s
      WHERE s.festival_id = public.current_user_festival_id()
        AND s.contact_email = (SELECT email FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage sponsor_deliverables"
  ON sponsor_deliverables FOR ALL
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'admin'
  );

-- festival_integrations
DROP POLICY IF EXISTS "Admins can read festival_integrations" ON festival_integrations;
DROP POLICY IF EXISTS "Admins can manage festival_integrations" ON festival_integrations;

CREATE POLICY "Admins can read festival_integrations"
  ON festival_integrations FOR SELECT
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'admin'
  );

CREATE POLICY "Admins can manage festival_integrations"
  ON festival_integrations FOR ALL
  USING (
    festival_id = public.current_user_festival_id()
    AND public.current_user_role() = 'admin'
  );
