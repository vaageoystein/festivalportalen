-- ============================================================
-- Fix RLS policy gaps found in security audit
-- ============================================================

-- 1. user_profiles: Admin must read/update all users in their festival
--    (Current policy only allows users to read/update their own row)

-- Add: Admins can read all profiles in their festival (for user management)
CREATE POLICY "Admins can read festival profiles"
  ON user_profiles FOR SELECT
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add: Admins can manage all profiles in their festival (role changes etc.)
CREATE POLICY "Admins can manage user profiles"
  ON user_profiles FOR ALL
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2. sponsors: Restrict sponsor-role to see only their own record
--    (Currently all festival members can read all sponsors)

DROP POLICY "Festival members can read sponsors" ON sponsors;

-- Non-sponsor roles can read all sponsors in their festival
CREATE POLICY "Non-sponsor members can read sponsors"
  ON sponsors FOR SELECT
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'board', 'crew', 'accountant')
    )
  );

-- Sponsor-role users can only read their own sponsor record (matched by contact_email)
CREATE POLICY "Sponsors can read own sponsor record"
  ON sponsors FOR SELECT
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles WHERE id = auth.uid() AND role = 'sponsor'
    )
    AND contact_email = (
      SELECT email FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Sponsor-role users can update their own sponsor record (self-service portal)
CREATE POLICY "Sponsors can update own sponsor record"
  ON sponsors FOR UPDATE
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles WHERE id = auth.uid() AND role = 'sponsor'
    )
    AND contact_email = (
      SELECT email FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    festival_id IN (
      SELECT festival_id FROM user_profiles WHERE id = auth.uid() AND role = 'sponsor'
    )
    AND contact_email = (
      SELECT email FROM user_profiles WHERE id = auth.uid()
    )
  );

-- 3. sponsor_deliverables: Restrict sponsor-role to see only their own

DROP POLICY "Festival members can read sponsor_deliverables" ON sponsor_deliverables;

-- Non-sponsor roles can read all deliverables
CREATE POLICY "Non-sponsor members can read deliverables"
  ON sponsor_deliverables FOR SELECT
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'board', 'crew', 'accountant')
    )
  );

-- Sponsor-role users can only read deliverables for their own sponsor
CREATE POLICY "Sponsors can read own deliverables"
  ON sponsor_deliverables FOR SELECT
  USING (
    sponsor_id IN (
      SELECT s.id FROM sponsors s
      JOIN user_profiles up ON up.festival_id = s.festival_id
      WHERE up.id = auth.uid() AND up.role = 'sponsor'
        AND s.contact_email = up.email
    )
  );

-- 4. festival_integrations: Restrict SELECT to admin only (contains API keys)

DROP POLICY "Festival members can read festival_integrations" ON festival_integrations;

CREATE POLICY "Admins can read festival_integrations"
  ON festival_integrations FOR SELECT
  USING (
    festival_id IN (
      SELECT festival_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
