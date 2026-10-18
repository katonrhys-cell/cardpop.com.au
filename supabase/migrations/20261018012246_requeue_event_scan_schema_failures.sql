-- Every extraction since the scanner's JSON schema grew past 16 nullable fields
-- was rejected by the Anthropic API ("too many parameters with union types")
-- before the page was read, and was recorded as `failed`. The schema is fixed;
-- put those pages back in the queue so the next scan actually reads them.
update public.event_scan_candidates
set status = 'pending', reason = null
where status = 'failed'
  and reason like '%too many parameters with union types%';
