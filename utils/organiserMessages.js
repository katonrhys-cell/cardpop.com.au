// Messages to an event organiser, sent from their organiser page.
// Dependency-free: the form, the admin queue and the API route share these.
// docs/organiser-messages.md

/** What the message is about — picked in the form, shown to whoever reads it. */
export const ORGANISER_MESSAGE_TOPICS = [
  { value: 'feedback', label: 'Feedback on an event' },
  { value: 'question', label: 'A question' },
  { value: 'vendor', label: 'Trader or vendor enquiry' },
  { value: 'other', label: 'Something else' },
];

export const ORGANISER_MESSAGE_TOPIC_VALUES = ORGANISER_MESSAGE_TOPICS.map((t) => t.value);

export const organiserMessageTopicLabel = (value) => (
  ORGANISER_MESSAGE_TOPICS.find((t) => t.value === value)?.label || 'Message'
);

export const ORGANISER_MESSAGE_MIN = 10;
export const ORGANISER_MESSAGE_MAX = 2000;

// Per member, per rolling 24 hours — counted over every message they sent,
// whatever became of it, so a blocked sender can't keep retrying.
export const ORGANISER_MESSAGE_DAILY_LIMIT = 10;
export const ORGANISER_MESSAGE_DAILY_LIMIT_PER_ORGANISER = 3;

/** Why the form can't be sent yet, or '' when it can. */
export function organiserMessageProblem(body) {
  const text = String(body ?? '').trim();
  if (text.length < ORGANISER_MESSAGE_MIN) return `Write at least ${ORGANISER_MESSAGE_MIN} characters.`;
  if (text.length > ORGANISER_MESSAGE_MAX) return `Keep it under ${ORGANISER_MESSAGE_MAX} characters.`;
  return '';
}
