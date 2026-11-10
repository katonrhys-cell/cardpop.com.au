-- After 20261106061312: submissions succeed and every admin is belled once.
do $$
declare v_id uuid; v_n int;
begin
  insert into public.events (title, organiser_id) values ('Melbourne Card Show', '00000000-0000-0000-0000-0000000000b1') returning id into v_id;
  select count(*) into v_n from public.notifications where related_id = v_id and type = 'event_pending_review';
  if v_n <> 2 then raise exception 'expected 2 admin bells, got %', v_n; end if;

  -- Auto-discovered and admin-created (approved) events don't bell.
  insert into public.events (title, organiser_id, auto_discovered) values ('Scanner hit', '00000000-0000-0000-0000-0000000000b1', true);
  insert into public.events (title, organiser_id, status) values ('Admin made', '00000000-0000-0000-0000-0000000000a1', 'approved');
  select count(*) into v_n from public.notifications;
  if v_n <> 2 then raise exception 'expected no extra bells, got % total', v_n; end if;

  -- Every new type is usable.
  perform 'sole_trader_changed'::public.notification_type, 'report_escalation'::public.notification_type,
          'order_foreign_card'::public.notification_type, 'store_submitted'::public.notification_type,
          'partner_application'::public.notification_type;
  raise notice 'ok: submissions bell admins and new types exist';
end $$;
