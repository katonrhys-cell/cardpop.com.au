# Grading contracts (Elite / Ultimate perk) — draft spec

> Status: **draft, pre-build**. Captured from the product interview on
> 2026-10-04. Correct anything wrong here before implementation starts.

## The concept in one paragraph

An **Elite or Ultimate** subscriber (the *dealer*) agrees with another
**ID-verified CardPop member** (the *owner*) to take the owner's raw cards,
submit them to a grading company at the dealer's cost, keep the graded cards,
and pay the owner a **per-card amount that depends on the grade each card
receives**. Every card also has a **floor price** the owner is paid whatever
the grade. CardPop's role is to produce the contract from CardPop's own
template, have both parties sign it electronically, store the signed document
securely with a tamper-evident audit trail, and track the deal through its
milestones. **No money moves through CardPop** in this version.

## Who can do what

| Actor | Can |
|---|---|
| Dealer (`subscription_tier` ∈ `elite`, `ultimate`) | Create contracts, unlimited. Fill in the card table and grade prices. Cancel before cards are received. Record cards received, submitted, grades + cert numbers, payment made. Raise a dispute. |
| Owner (any member with `profiles.is_verified = true`) | Review a contract sent to them, **sign or decline** (with an optional note). No counter-proposals. Cancel before cards are received. Confirm payment received. Raise a dispute. |
| Admin | Read any contract and its audit trail. Edit the template wording. See overdue and disputed contracts. |
| Anyone else | Nothing. Contracts are private to the two parties and admins. |

Gating mirrors the existing pattern: `config/plans.js` declares the tier
list (like `WHATNOT_SHOW_TIERS`) **and** an RLS policy / insert trigger
enforces the same tier in the database.

## The document

- The owner's uploaded contract becomes a **system template with merge
  fields**: party legal names and usernames, date, the card schedule, the
  grade/price table per card, the floor price, the grading company, and the
  deadlines. Only admins change the wording; each change is a new
  **template version**, and every contract records which version it used.
- Per contract the system renders one PDF containing the terms plus the
  schedule. The PDF's **SHA-256 hash** is stored at send time; both parties
  sign that exact hash.

## Per-card schedule

Each row: card name / set / number, condition notes, optional photo
(already in the vault or uploaded), grading company, and a price for each
grade on that company's scale:

| Company | Grade steps supported |
|---|---|
| PSA | 1–10 whole grades |
| BGS / Beckett | 1–10 in half-grade steps, plus Pristine 10 / Black Label |
| CGC | 1–10 in half-grade steps, plus Pristine 10 |
| Other (free-text company) | 1–10 whole grades |

Plus a **floor price** per card: paid for any grade below the lowest priced
grade, and for a card returned ungraded/altered/authentic-only. Ungradeable
cards are returned to the owner.

## Signing (built in-house)

Electronic signatures under the Electronic Transactions Act 1999 (Cth):

1. Signer must be logged in with a fresh session (re-authenticate / MFA
   step-up for users who have MFA, via the existing `requireAal2` pattern).
2. Signer ticks consent to electronic signing, types their full legal name
   and draws or types a signature.
3. Server records: user id, legal name, signature image, document hash,
   template version, UTC timestamp, IP, user agent. The dealer signs on
   send; the owner signs on acceptance.
4. After the second signature the server renders the **final signed PDF**
   (original + signature page + audit certificate), hashes it, and stores it
   in a **private** Storage bucket. Rows are append-only (no UPDATE/DELETE
   policy on `contract_signatures` or `contract_events`).
5. The final PDF is served only through short-lived signed URLs to the two
   parties and admins. Encrypted at rest by Supabase Storage; in transit by
   TLS.

## Lifecycle

```
draft → sent → signed → cards_received → submitted_for_grading
      → graded → paid → completed
      ↘ declined   ↘ cancelled (either party, only before cards_received)
                   ↘ disputed (either party, any time after signed; freezes status, alerts admins)
      sent expires if unsigned after N days (default 14)
```

- **graded** requires a grade **and a cert number** per card; PSA certs are
  checked live through the existing `psaApiClient`. Recording grades locks in
  the amount owed per card from the signed table.
- Contract carries a **grading deadline** and a **payment deadline**
  (dealer-set, within admin-set maximums). Overdue → both parties notified,
  admins flagged.
- Every transition writes a `contract_events` row and triggers an in-app
  notification plus a Resend email to the other party (and admins for
  disputes/overdue).

## Where it lives

- **Owner UI**: Account → Contracts (list, detail with timeline, sign/decline).
- **Dealer UI**: same page plus "New contract" wizard (pick owner by
  username/email among verified members → card table → prices → deadlines →
  preview PDF → sign & send).
- **Admin UI**: Admin → Contracts (all contracts, filters for overdue /
  disputed, template editor with version history).
- **Backend**: `/contracts` router (caller-scoped client for reads/writes so
  RLS stays the enforcement point; service role only for PDF rendering,
  hashing and the storage write). PDF rendering must run in the 300s function
  budget pattern if the 40s `api/index.js` budget proves too short.

## Open questions

1. Is the owner paid a single lump sum once all cards are graded, or per card
   as grades come in? (Spec assumes lump sum at `graded → paid`.)
2. Minimum / maximum number of cards per contract?
3. Default grading deadline and payment deadline (spec assumes 90 days and
   14 days after grades recorded)?
4. Should the owner's card on file or Stripe Connect account be touched at
   all in v1? (Spec assumes no.)
5. Does the contract need the owner's physical address for card return?
