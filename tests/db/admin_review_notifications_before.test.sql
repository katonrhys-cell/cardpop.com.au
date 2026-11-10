-- Reproduces the bug: with the 2026-07-31 trigger and no enum value, a
-- user's event submission is rejected outright.
do $$
begin
  begin
    insert into public.events (title, organiser_id) values ('Broken submit', '00000000-0000-0000-0000-0000000000b1');
    raise exception 'expected the submission to fail before the fix';
  exception when invalid_text_representation then
    raise notice 'ok: submission failed with 22P02 before the fix';
  end;
end $$;
