-- Create grading_verifications table for PSA/Beckett cert verification caching
CREATE TABLE IF NOT EXISTS grading_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grading_number TEXT NOT NULL,
  company TEXT NOT NULL CHECK (company IN ('psa', 'beckett')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  details JSONB,
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint to prevent duplicate verifications
  CONSTRAINT unique_grading_verification UNIQUE(grading_number, company)
);

-- Create indexes for common queries
CREATE INDEX idx_grading_verifications_number ON grading_verifications(grading_number);
CREATE INDEX idx_grading_verifications_company ON grading_verifications(company);
CREATE INDEX idx_grading_verifications_number_company ON grading_verifications(grading_number, company);
CREATE INDEX idx_grading_verifications_expires_at ON grading_verifications(expires_at);
CREATE INDEX idx_grading_verifications_verified ON grading_verifications(verified);

-- Enable RLS
ALTER TABLE grading_verifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read verification results (they're public data)
CREATE POLICY "Allow public read access" ON grading_verifications
  FOR SELECT USING (true);

-- Allow backend service role to insert/update (via service role key)
CREATE POLICY "Allow service role to manage" ON grading_verifications
  FOR ALL USING (auth.role() = 'service_role');
