import { useEffect } from 'react';
import { recordEventView } from '@/lib/eventViews.js';

/** Count a view of `eventId` once the page/modal is showing it (`enabled`). */
export function useRecordEventView(eventId, enabled = true) {
  useEffect(() => {
    if (enabled && eventId) recordEventView(eventId);
  }, [eventId, enabled]);
}

export default useRecordEventView;
