/// <reference path="../pb_data/types.d.ts" />
onRecordAfterUpdateSuccess((e) => {
  if (e.record.get("status") === "Declined") {
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: e.record.get("sender") }],
      subject: "Trade Request Declined",
      html: "<h2>Your trade request has been declined</h2><p>Unfortunately, your trade request has been declined by the recipient.</p><p><strong>Trade Request ID:</strong> " + e.record.id + "</p><p>Feel free to send another trade request or browse other cards.</p>"
    });
    $app.newMailClient().send(message);
  }
  e.next();
}, "tradeRequests");