# Admin review alerts

When a member submits something that an admin has to check, every admin gets
**an in-app bell** (the notification bell, linked to the right admin page)
**and an email**. The email goes to each admin account's login address plus
the alerts inbox set in Admin → Settings (`notification_email`, falling back
to `contact_email`, then `notifications@cardpop.com.au`). Email needs
`RESEND_API_KEY`.

| Queue | Bell | Email | Admin page | Code |
|---|---|---|---|---|
| Community event submitted | ✓ (DB trigger) | ✓ | `/admin/events` | `notify_admins_on_event_submission()`, `POST /events/notify-submission` |
| Card shop directory submission | ✓ | ✓ | `/admin/store-directory` | `POST /stores/submit` |
| Partner program application | ✓ | ✓ | `/admin/partners` | `submitPartnerApplication()` |
| Refund request | ✓ | ✓ | `/admin/orders` | `POST /refunds/request` |
| Shop product review | ✓ (DB trigger) | ✓ | `/admin/product-reviews` | `POST /shop-reviews` |
| Content reported by 3 members | ✓ | ✓ | `/admin/reports` | `maybeEscalate()` in `routes/reports.js` |
| Identity check needs review | ✓ | ✓ | the user's admin page | `identityService.js` |
| Sole trader mode switched | ✓ | ✓ | the user's admin page | `POST /stores/sole-trader-change` |
| Offer / enquiry made | ✓ | ✓ | `/admin/offers` | `routes/offers.js` |

New queues should call `alertAdminsToReview()` in
`src/services/adminReviewAlerts.js`. It's best-effort and never throws, so a
notification problem can't fail the member's submission.

## The enum rule

`notifications.type` is the Postgres enum `notification_type`. **Every type
the code writes must be added to the enum in a migration** (`alter type
public.notification_type add value if not exists '…'`).

An unknown value is a hard error. It's why every community event submission
failed from 2026-07-31 until `20261106061312_admin_review_notification_types.sql`:
the submission trigger wrote `event_pending_review`, which wasn't in the
enum, and the error rolled back the user's insert.

`tests/backend/notificationTypes.test.js` now fails CI if the API or a
database function writes a type that no migration adds.
`tests/db/run-admin-review-notifications-migration.sh` reproduces the
original failure and checks the fix.

## If alerts stop arriving

1. Check that your profile has `is_admin = true`. Only admins are belled and
   emailed.
2. Check Account → Notifications. A type switched off for in-app is skipped
   by `create_notification()`.
3. Check that `RESEND_API_KEY` is set in Vercel and that the domain is
   verified in Resend (see `docs/email.md`).
4. Check Admin → Settings → notification email.
