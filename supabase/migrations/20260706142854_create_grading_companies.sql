-- Public directory of third-party grading companies (PSA, BGS, CGC, ACE) shown
-- on GradingCompaniesPage.jsx. Slugs match the keys used by GradingScalePage.jsx's
-- COMPANY_DATA so "/grading/guide/:slug" links resolve to real content.

CREATE TABLE IF NOT EXISTS grading_companies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  name         text NOT NULL,
  abbreviation text,
  description  text,
  country      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grading_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grading_companies_are_public"
  ON grading_companies
  FOR SELECT
  USING (true);

CREATE POLICY "admin_manage_grading_companies"
  ON grading_companies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

INSERT INTO grading_companies (slug, name, abbreviation, description, country)
VALUES
  ('psa', 'PSA', 'Professional Sports Authenticator',
    'The world''s most recognised card grading company, using a definitive 1-10 scale and commanding the highest resale premiums on the global secondary market.',
    'United States'),
  ('bgs', 'BGS', 'Beckett Grading Services',
    'Famous for its detailed subgrade system (centering, corners, edges, surface) and the highly coveted Pristine 10 Black Label.',
    'United States'),
  ('cgc', 'CGC', 'Certified Guaranty Company',
    'A dominant force in TCG grading for Pokemon and Magic: The Gathering, known for strict standards and crystal-clear slabs.',
    'United States'),
  ('ace', 'ACE', 'ACE Grading',
    'Australia''s home-grown grading service, offering AUD pricing, no international shipping, and faster turnarounds for local collectors.',
    'Australia')
ON CONFLICT (slug) DO NOTHING;
