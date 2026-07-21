// True when a Stripe error means "this object does not exist on this account" —
// a stale id: the object was deleted, or (the case that motivated this) the id
// was persisted while the platform ran on a previous Stripe account. Callers
// use this to self-heal by recreating the object instead of surfacing a 500.
export function isStripeObjectMissing(err) {
  return err?.code === 'resource_missing' || err?.statusCode === 404;
}
