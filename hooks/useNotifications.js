// In-app notifications for the signed-in user.
//
// The state lives in NotificationsProvider (contexts/NotificationsContext.jsx),
// mounted once in App.jsx, so the header bell and Account → Notifications
// share one query and one realtime channel. This hook is kept as the import
// path every consumer already uses.
export { useNotificationsContext as useNotifications } from '@/contexts/NotificationsContext.jsx';
