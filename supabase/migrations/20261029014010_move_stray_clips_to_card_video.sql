-- A clip picked through a photo slot was stored in vault_items.card_images,
-- which the listing page renders through <img> — so the hero sat blank. The
-- server validator (src/utils/vaultItemInput.js) now routes such a file to
-- card_video on save; this repairs the rows written before that.
--
-- Idempotent: only rows with a video-extension entry in card_images match,
-- and once moved they no longer do.

do $$
begin
  -- card_video is nullable text (20261003035125_vault_card_video.sql).
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vault_items' and column_name = 'card_video'
  ) then
    return;
  end if;

  update public.vault_items vi
  set card_video = coalesce(
        vi.card_video,
        (select p from unnest(vi.card_images) with ordinality as u(p, ord)
          where p ~* '\.(mp4|webm|mov|m4v)$' order by ord limit 1)
      ),
      card_images = array(
        select p from unnest(vi.card_images) with ordinality as u(p, ord)
        where p !~* '\.(mp4|webm|mov|m4v)$' order by ord
      )
  where exists (
    select 1 from unnest(coalesce(vi.card_images, '{}'::text[])) p
    where p ~* '\.(mp4|webm|mov|m4v)$'
  );
end
$$;
