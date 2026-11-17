-- Widen the grading_company enum to every professional grader a card can come from
-- (eBay's "Professional grader" list plus TAG, which the Grading Hub already covers),
-- so a vault card, a wanted card and a price alert can name any of them.
--
-- The list lives in data/gradeOptions.js; tests/frontend/gradeOptions.test.js fails if
-- this migration and that file disagree. Additive only: existing values and rows are
-- untouched, and `add value if not exists` makes a re-run harmless. Values are not used
-- in this file, so it is safe inside the migration transaction.
alter type public.grading_company add value if not exists 'tag';
alter type public.grading_company add value if not exists 'bccg';
alter type public.grading_company add value if not exists 'bvg';
alter type public.grading_company add value if not exists 'csg';
alter type public.grading_company add value if not exists 'ksa';
alter type public.grading_company add value if not exists 'gma';
alter type public.grading_company add value if not exists 'hga';
alter type public.grading_company add value if not exists 'isa';
alter type public.grading_company add value if not exists 'gsg';
alter type public.grading_company add value if not exists 'pgs';
alter type public.grading_company add value if not exists 'mnt';
alter type public.grading_company add value if not exists 'rare';
alter type public.grading_company add value if not exists 'rcg';
alter type public.grading_company add value if not exists 'cga';
alter type public.grading_company add value if not exists 'tcg';
alter type public.grading_company add value if not exists 'ags';
alter type public.grading_company add value if not exists 'dsg';
alter type public.grading_company add value if not exists 'majesty';
alter type public.grading_company add value if not exists 'graad';
alter type public.grading_company add value if not exists 'arena';
alter type public.grading_company add value if not exists 'aigrading';
