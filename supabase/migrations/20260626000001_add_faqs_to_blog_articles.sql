-- Add a structured FAQ field to blog articles.
-- Editors manage per-article FAQs that render as an on-page FAQ section and
-- are emitted as schema.org FAQPage JSON-LD (both in the SPA and the bot
-- prerenderer) for rich-result eligibility.
--
-- Shape: jsonb array of objects, e.g.
--   [{ "question": "How much does PSA grading cost?", "answer": "..." }, ...]

ALTER TABLE blog_articles
  ADD COLUMN IF NOT EXISTS faqs jsonb;

COMMENT ON COLUMN blog_articles.faqs IS
  'Array of {question, answer} objects rendered as an on-page FAQ and emitted as schema.org FAQPage JSON-LD.';
