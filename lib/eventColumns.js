// Everything the card, the detail modal and the JSON-LD read from an event —
// the public view minus its SEO-only columns.
export const EVENT_CARD_COLUMNS = [
  'id', 'slug', 'event_type', 'status', 'title', 'description', 'short_description', 'image_url',
  'venue_name', 'address', 'suburb', 'state', 'postcode',
  'start_date', 'end_date', 'start_time', 'end_time',
  'entry_fee_aud', 'presale_fee_aud', 'ticket_prices', 'is_free', 'website_url', 'ticket_url',
  'is_cardpop_verified', 'is_featured', 'registration_required', 'capacity',
  'tags', 'featured_card_games', 'organizer_name',
  'instagram_url', 'facebook_url', 'youtube_url', 'event_videos', 'facebook_video_url',
  'youtube_channel_url', 'tiktok_url', 'x_url', 'discord_url', 'vendor_application_url',
  'tickets_sold_out', 'waitlist_url',
  'accessibility_info', 'age_restrictions', 'created_at', 'updated_at',
].join(',');
