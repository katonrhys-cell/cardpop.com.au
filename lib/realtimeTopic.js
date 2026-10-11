// Unique realtime channel topics.
//
// `supabase.channel(topic)` returns the EXISTING channel when one with that
// topic is still registered — and a channel stays registered until its leave
// round-trip completes, which is after React has already run the next effect.
// So an effect that tears down `channel('product-123')` and immediately opens
// `channel('product-123')` again gets back the channel that is still leaving:
// its new bindings are attached to a dying channel and never fire, and a
// second mount of the same hook (two components, one topic) hits
// "cannot add `postgres_changes` callbacks after `subscribe()`" instead.
//
// Every per-component subscription should therefore use a topic that is unique
// to that mount. Shared, app-wide state (notifications, watchlist ids, the
// profile) belongs in a single provider instead of a second subscription.

let counter = 0;

/** `${base}-${n}` with a process-unique `n`, so remounts never collide. */
export function uniqueTopic(base) {
  counter += 1;
  return `${base}-${counter}`;
}
