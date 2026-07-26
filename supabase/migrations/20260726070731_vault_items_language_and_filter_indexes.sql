-- Marketplace filter support: card language + indexes on the filterable
-- vault_items columns.
--
-- The eBay-style filter bar filters on grading_company, grade, condition and
-- (new) language, plus the existing boolean attribute flags. Language was the
-- one attribute with no column at all — TCG buyers routinely filter Japanese
-- vs English printings. Rarity/edition/finish deliberately stay inside the
-- existing `variant` text taxonomy (lib/cardVariants.js) and are filtered by
-- pattern match, so sellers keep a single variant picker and nothing is
-- double-entered.

alter table public.vault_items
  add column if not exists language text;

create index if not exists vault_items_grading_company_idx on public.vault_items (grading_company);
create index if not exists vault_items_grade_idx           on public.vault_items (grade);
create index if not exists vault_items_condition_idx       on public.vault_items (condition);
create index if not exists vault_items_language_idx        on public.vault_items (language);
