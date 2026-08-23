-- Trade notification types. Kept separate from the migration that creates the
-- trade notification triggers: a value added to an enum must not be used in
-- the same transaction that adds it, and db push wraps each file in one.

alter type notification_type add value if not exists 'trade_proposed';
alter type notification_type add value if not exists 'trade_accepted';
alter type notification_type add value if not exists 'trade_declined';
