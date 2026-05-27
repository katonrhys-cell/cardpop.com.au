/// <reference path="../pb_data/types.d.ts" />
// Trade request notifications are handled by send-trade-notification.pb.js
// This file is intentionally a no-op to avoid duplicate emails.
onRecordAfterCreateSuccess((e) => {
  e.next();
}, "tradeRequests");
