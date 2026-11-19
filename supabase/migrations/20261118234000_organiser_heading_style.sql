-- An organiser page's heading can be set in type that matches the organiser's
-- logo: which font (from the fixed list in utils/organiserHeadingStyle.js)
-- each part of the name uses, its case, letter-spacing and outline colour.
-- Filled by "Match heading to logo" in the page editor (admins) and read
-- through cleanHeadingStyle(), which ignores anything that isn't a known font
-- or doesn't spell the organiser's own name — the column can restyle the
-- heading, never reword it. null = the site's normal heading.
alter table public.event_organisers
  add column if not exists heading_style jsonb
    check (heading_style is null or jsonb_typeof(heading_style) = 'object');

comment on column public.event_organisers.heading_style is
  'Heading set to match the logo: {segments:[{text,font,italic,case,tracking,accent}], source_fonts:[]}. Normalised by cleanHeadingStyle() (utils/organiserHeadingStyle.js).';
