/// <reference path="../pb_data/types.d.ts" />
onRecordAfterUpdateSuccess((e) => {
  if (e.record.get("status") === "Accepted") {
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: e.record.get("sender") }],
      subject: "Trade Request Accepted",
      html: "<h2>Your trade request has been accepted!</h2><p>Great news! Your trade request has been accepted by the recipient.</p><p><strong>Trade Request ID:</strong> " + e.record.id + "</p><p>Please log in to your account to complete the trade.</p>"
    });
    $app.newMailClient().send(message);
  }
  e.next();
}, "tradeRequests");