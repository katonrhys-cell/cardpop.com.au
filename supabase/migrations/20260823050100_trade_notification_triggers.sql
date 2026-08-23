-- Trade notifications: mirror the offer notification triggers
-- (20260705024521_expression_of_interest_offers.sql) so a proposed, accepted
-- or declined trade reaches the other party's notification bell. Without
-- these, a trade proposal was only discoverable by visiting /trades.

create or replace function public.notify_on_trade_created()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_offered_card text;
  v_wanted_card  text;
begin
  select vi.card_name into v_offered_card
  from listings l left join vault_items vi on vi.id = l.vault_item_id
  where l.id = new.initiator_listing_id;

  select vi.card_name into v_wanted_card
  from listings l left join vault_items vi on vi.id = l.vault_item_id
  where l.id = new.responder_listing_id;

  perform create_notification(
    new.responder_id, 'trade_proposed',
    'New trade proposal',
    coalesce(v_offered_card, 'A card')
      || case when coalesce(new.cash_topup_aud, 0) > 0
              then ' + $' || new.cash_topup_aud::text || ' cash'
              else '' end
      || ' offered for your ' || coalesce(v_wanted_card, 'listing'),
    '/trades', new.id
  );
  return new;
end;
$function$;

create or replace function public.notify_on_trade_updated()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_wanted_card text;
  v_actor uuid;
begin
  if old.status = new.status then return new; end if;

  select vi.card_name into v_wanted_card
  from listings l left join vault_items vi on vi.id = l.vault_item_id
  where l.id = new.responder_listing_id;

  -- Who changed it? The responder accepts or declines; the initiator can
  -- cancel their own proposal — notify the OTHER party. auth.uid() is null
  -- for service-role updates; treat those as responder-driven.
  v_actor := auth.uid();

  if new.status = 'accepted' then
    perform create_notification(
      new.initiator_id, 'trade_accepted',
      'Trade accepted! 🎉',
      'Your trade proposal for ' || coalesce(v_wanted_card, 'a listing')
        || ' was accepted — arrange the exchange in Messages',
      '/trades', new.id
    );
  elsif new.status = 'cancelled' then
    if v_actor = new.initiator_id then
      perform create_notification(
        new.responder_id, 'trade_declined',
        'Trade proposal withdrawn',
        'A trade proposed on your ' || coalesce(v_wanted_card, 'listing') || ' was withdrawn',
        '/trades', new.id
      );
    else
      perform create_notification(
        new.initiator_id, 'trade_declined',
        'Trade declined',
        'Your trade proposal for ' || coalesce(v_wanted_card, 'a listing') || ' was not accepted',
        '/trades', new.id
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists on_trade_created on public.trades;
create trigger on_trade_created
  after insert on public.trades
  for each row execute function public.notify_on_trade_created();

drop trigger if exists on_trade_updated on public.trades;
create trigger on_trade_updated
  after update on public.trades
  for each row execute function public.notify_on_trade_updated();
