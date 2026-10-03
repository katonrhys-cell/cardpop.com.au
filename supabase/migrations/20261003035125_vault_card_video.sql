-- One optional short video per vault card.
--
-- `card_video` holds a storage path inside the `vault-images` bucket
-- (`<ownerId>/<timestamp>-video.<ext>`), exactly like `card_image`. The poster
-- frame lives at a derived name (`<path minus ext>.poster.jpg`, see
-- utils/cardVideo.js) so no second column is needed. The 10-second cap is
-- enforced in the add/edit form — storage can't inspect duration — while the
-- bucket's size limit below bounds what a longer clip could cost.
alter table public.vault_items
  add column if not exists card_video text;

comment on column public.vault_items.card_video is
  'Storage path (vault-images bucket) of the card''s optional <=10s video; poster at <path minus ext>.poster.jpg.';

-- Let the bucket hold the common phone/browser video containers alongside the
-- images it already accepted. The 20 MB per-object cap is unchanged — a 10s
-- 1080p clip is comfortably under it.
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
where id = 'vault-images';
