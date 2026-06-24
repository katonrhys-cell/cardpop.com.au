-- Add grading verification fields to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS grading_number TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS grading_company TEXT CHECK (grading_company IN ('psa', 'beckett'));
ALTER TABLE listings ADD COLUMN IF NOT EXISTS grading_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS grading_verified_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for filtering by grading verification status
CREATE INDEX IF NOT EXISTS idx_listings_grading_number ON listings(grading_number);
CREATE INDEX IF NOT EXISTS idx_listings_grading_company ON listings(grading_company);
CREATE INDEX IF NOT EXISTS idx_listings_grading_verified ON listings(grading_verified);
