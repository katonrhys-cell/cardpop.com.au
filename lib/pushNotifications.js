import apiServerClient from '@/lib/apiServerClient.js';

// Browser-side web push plumbing. The service worker (public/sw.js) shows the
// notifications; these helpers manage the subscription lifecycle against the
// /push API. Everything degrades cleanly: no SW registration (dev builds
// register none), no PushManager, or unconfigured VAPID keys all surface as
// "unavailable" rather than throwing into the UI.

export const pushSupported = () =>
  typeof navigator !== 'undefined'
  && 'serviceWorker' in navigator
  && typeof window !== 'undefined'
  && 'PushManager' in window
  && 'Notification' in window;

const getRegistration = async () => {
  if (!pushSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

/**
 * 'unsupported' — browser or build can't do push (no SW / no PushManager)
 * 'unconfigured' — server has no VAPID keys
 * 'denied' — user blocked notifications in the browser
 * 'enabled' — this browser has an active subscription
 * 'available' — supported and allowed, not yet subscribed
 */
export async function getPushStatus() {
  const registration = await getRegistration();
  if (!registration) return 'unsupported';
  try {
    const res = await apiServerClient.fetch('/push/public-key');
    const { publicKey } = res.ok ? await res.json() : {};
    if (!publicKey) return 'unconfigured';
  } catch {
    return 'unconfigured';
  }
  if (Notification.permission === 'denied') return 'denied';
  const sub = await registration.pushManager.getSubscription();
  return sub ? 'enabled' : 'available';
}

export async function enablePush() {
  const registration = await getRegistration();
  if (!registration) throw new Error('Push notifications are not supported in this browser');

  const res = await apiServerClient.fetch('/push/public-key');
  const { publicKey } = res.ok ? await res.json() : {};
  if (!publicKey) throw new Error('Push notifications are not configured yet');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const saveRes = await apiServerClient.fetch('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!saveRes.ok) {
    await subscription.unsubscribe().catch(() => {});
    throw new Error('Could not save the push subscription');
  }
}

export async function disablePush() {
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => {});
  await apiServerClient.fetch('/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}
