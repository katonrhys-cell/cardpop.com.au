-- Welcome email on every registration, not just the ones the signup page
-- happens to report.
--
-- Until now the only thing that issued a welcome offer was a fire-and-forget
-- fetch in pages/SignupPage.jsx, which meant an account got its welcome email
-- only if the browser stayed open long enough to make the call AND the call
-- succeeded. Two whole classes of signup were missed:
--
--   - OAuth (Google/GitHub/Facebook). Those users never touch SignupPage at
--     all — Supabase redirects them straight back into a session — so not one
--     of them has ever received a welcome email.
--   - anyone whose tab closed, lost connection, or hit a transient 5xx between
--     account creation and the issue call.
--
-- public.profiles is the one place every signup lands: handle_new_user()
-- inserts exactly one row per auth user, on both the password and the OAuth
-- path. So the table is the complete hook point, the same reasoning as the
-- notifications push-dispatch trigger.
--
-- No shared secret, for the same reason as push dispatch: the endpoint takes a
-- user id and nothing else, the offer row is unique per user, the email is
-- claimed with email_sent_at, and the recipient address is read from the auth
-- record — never from the request — so a replayed or spoofed call is a no-op.
-- The endpoint also refuses any account older than WELCOME_ISSUE_WINDOW_HOURS.
--
-- Defensive on purpose: supabase_functions.http_request ships with hosted
-- Supabase (it powers dashboard Database Webhooks), but if it's ever missing
-- this migration must degrade to "no webhook" — never a failed db push, which
-- blocks every later migration (see CLAUDE.md).

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'supabase_functions' and p.proname = 'http_request'
  ) then
    execute 'drop trigger if exists profiles_welcome_offer on public.profiles';
    execute $trg$
      create trigger profiles_welcome_offer
        after insert on public.profiles
        for each row
        execute function supabase_functions.http_request(
          'https://cardpop.com.au/hcgi/api/welcome-offer/issue',
          'POST',
          '{"Content-Type":"application/json"}',
          '{}',
          '5000'
        )
    $trg$;
  else
    raise notice 'supabase_functions.http_request not available — welcome offer webhook not installed (welcome emails stay signup-page-only)';
  end if;
end $$;
