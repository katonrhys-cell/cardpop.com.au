/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const message = new MailerMessage({
    from: {
      address: $app.settings().meta.senderAddress,
      name: $app.settings().meta.senderName
    },
    to: [{ address: e.record.get("recipient") }],
    subject: "New Trade Request",
    html: "<h2>You have received a new trade request</h2><p>A user has sent you a trade request. Please log in to your account to review and respond.</p><p><strong>Trade Request ID:</strong> " + e.record.id + "</p>"
  });
  $app.newMailClient().send(message);
  e.next();
}, "tradeRequests");