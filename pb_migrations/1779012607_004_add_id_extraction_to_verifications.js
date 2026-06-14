/// <reference path="../pb_data/types.d.ts" />
// Migration: add AI name extraction columns to user_verifications
//
// New columns:
//   id_extracted_name TEXT         — full legal name extracted from the ID document by AI
//   name_match        BOOLEAN      — whether extracted name matches submitted full_legal_name
//   name_match_confidence TEXT     — confidence level of extraction: 'high', 'medium', or 'low'

migrate(async (app) => {
  await app.db().newQuery(`
    ALTER TABLE user_verifications
      ADD COLUMN IF NOT EXISTS id_extracted_name TEXT,
      ADD COLUMN IF NOT EXISTS name_match BOOLEAN,
      ADD COLUMN IF NOT EXISTS name_match_confidence TEXT;
  `).execute();
}, async (app) => {
  await app.db().newQuery(`
    ALTER TABLE user_verifications
      DROP COLUMN IF EXISTS id_extracted_name,
      DROP COLUMN IF EXISTS name_match,
      DROP COLUMN IF EXISTS name_match_confidence;
  `).execute();
});
