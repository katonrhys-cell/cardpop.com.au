/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const recipientId = e.record.get("recipientId");
  const senderId = e.record.get("senderId");
  const message = e.record.get("message");
  const status = e.record.get("status");
  const offeredValues = e.record.get("offeredValues");
  const requestedValues = e.record.get("requestedValues");
  
  // Get recipient user record to get email
  const recipient = $app.findRecordById("users", recipientId);
  if (!recipient) {
    e.next();
    return;
  }
  
  const recipientEmail = recipient.get("email");
  
  // Get sender user record for name
  const sender = $app.findRecordById("users", senderId);
  const senderName = sender ? sender.get("name") || "A user" : "A user";
  
  // Build cards offered/requested summary
  let offeredSummary = "No cards offered";
  let requestedSummary = "No cards requested";
  
  if (offeredValues && Array.isArray(offeredValues) && offeredValues.length > 0) {
    offeredSummary = offeredValues.length + " card(s) offered";
  }
  
  if (requestedValues && Array.isArray(requestedValues) && requestedValues.length > 0) {
    requestedSummary = requestedValues.length + " card(s) requested";
  }
  
  const emailBody = "<h2>New Trade Request from " + senderName + "</h2>" +
    "<p><strong>Status:</strong> " + status + "</p>" +
    "<p><strong>Cards Offered:</strong> " + offeredSummary + "</p>" +
    "<p><strong>Cards Requested:</strong> " + requestedSummary + "</p>" +
    (message ? "<p><strong>Message:</strong> " + message + "</p>" : "") +
    "<p><a href='https://yourapp.com/trade-requests/" + e.record.id + "'>Review Trade Request</a></p>";
  
  const mailMessage = new MailerMessage({
    from: {
      address: $app.settings().meta.senderAddress,
      name: $app.settings().meta.senderName
    },
    to: [{ address: recipientEmail }],
    subject: "New Trade Request from " + senderName,
    html: emailBody
  });
  
  $app.newMailClient().send(mailMessage);
  e.next();
}, "tradeRequests");