/// <reference path="../pb_data/types.d.ts" />
// Migration: document the "whatnot" key in social_links
//
// The social_links column is a JSON field that accepts any keys.
// No schema change is required to support the "whatnot" key — this
// migration exists only to document the addition as part of the
// project's migration history.
//
// Expected social_links shape after this change:
//   {
//     twitter:   "https://twitter.com/...",    // optional
//     instagram: "https://instagram.com/...",  // optional
//     whatnot:   "https://www.whatnot.com/user/..." // optional, new
//   }
migrate((app) => {
  // No schema change needed — social_links is already a JSON field
  // that accepts arbitrary keys. This migration is a no-op marker.
  console.log("Migration 003: whatnot key documented in social_links (no schema change required).");
}, (app) => {
  // No revert needed.
  console.log("Migration 003 reverted (no-op).");
})
