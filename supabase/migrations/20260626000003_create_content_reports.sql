-- User-facing content reports (scam / counterfeit / abuse).
--
-- Writes go exclusively through the backend /reports endpoint (service-role key),
-- which derives the reporter from the auth token, validates the reason/target,
-- rate-limits per user and de-dupes open reports. There is deliberately NO
-- client INSERT policy, so the validated endpoint is the only way to file a
-- report. Reports contain accusations, so they are NOT publicly readable.

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing', 'user', 'review', 'message', 'event')),
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN (
    'counterfeit', 'scam', 'prohibited_item', 'misrepresentation',
    'inappropriate', 'spam', 'other'
  )),
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  resolution_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- One OPEN report per reporter per target (matches the app-layer de-dupe).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_report_per_reporter_target
  ON content_reports (reporter_id, target_type, target_id)
  WHERE status = 'open';

-- Moderation-queue access patterns.
CREATE INDEX IF NOT EXISTS idx_content_reports_status        ON content_reports (status);
CREATE INDEX IF NOT EXISTS idx_content_reports_target        ON content_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at    ON content_reports (created_at DESC);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Backend (service role) does all the privileged work: insert, list, triage.
CREATE POLICY "Service role manages reports" ON content_reports
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- A reporter may read the status of their own reports (e.g. a future
-- "my reports" view). No client INSERT/UPDATE/DELETE — those go via the backend.
CREATE POLICY "Reporters can read their own reports" ON content_reports
  FOR SELECT USING (auth.uid() = reporter_id);
