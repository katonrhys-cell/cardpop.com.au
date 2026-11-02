## What changed

<!-- What this PR does and why. Note anything swept in beyond the stated scope. -->

## Testing

<!-- What you ran and what it said — `npm run lint`, `npm test`, manual checks in the app. -->

## Checklist

- [ ] Schema changes are new `supabase/migrations/` files made with `supabase migration new` — nothing applied through the dashboard or SQL editor
- [ ] New env vars are added to `/opt/cardpop/app/.env` on the VPS (then redeployed) and listed in `CLAUDE.md`
- [ ] No secrets, keys, or real user data in the diff
