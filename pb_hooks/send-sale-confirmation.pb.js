/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const type = e.record.get("type");
  
  // Only send email for sales
  if (type !== "Sale") {
    e.next();
    return;
  }
  
  const userIds = e.record.get("userIds");
  const cardIds = e.record.get("cardIds");
  const transactionValue = e.record.get("transactionValue");
  const commissionAmount = e.record.get("commissionAmount");
  const status = e.record.get("status");
  
  if (!userIds || userIds.length < 2) {
    e.next();
    return;
  }
  
  const buyerId = userIds[0];
  const sellerId = userIds[1];
  
  // Get buyer and seller records
  const buyer = $app.findRecordById("users", buyerId);
  const seller = $app.findRecordById("users", sellerId);
  
  if (!buyer || !seller) {
    e.next();
    return;
  }
  
  const buyerEmail = buyer.get("email");
  const sellerEmail = seller.get("email");
  const buyerName = buyer.get("name") || "Buyer";
  const sellerName = seller.get("name") || "Seller";
  
  // Build card summary
  let cardSummary = "No cards";
  if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
    cardSummary = cardIds.length + " card(s)";
  }
  
  // Send email to buyer
  const buyerEmailBody = "<h2>Sale Confirmation</h2>" +
    "<p>Hello " + buyerName + ",</p>" +
    "<p>Your purchase has been confirmed!</p>" +
    "<p><strong>Cards Purchased:</strong> " + cardSummary + "</p>" +
    "<p><strong>Transaction Value:</strong> $" + transactionValue + "</p>" +
    "<p><strong>Status:</strong> " + status + "</p>" +
    "<p><a href='https://yourapp.com/transactions/" + e.record.id + "'>View Transaction</a></p>";
  
  const buyerMessage = new MailerMessage({
    from: {
      address: $app.settings().meta.senderAddress,
      name: $app.settings().meta.senderName
    },
    to: [{ address: buyerEmail }],
    subject: "Sale Confirmation - Transaction #" + e.record.id,
    html: buyerEmailBody
  });
  
  $app.newMailClient().send(buyerMessage);
  
  // Send email to seller
  const sellerEmailBody = "<h2>Sale Confirmation</h2>" +
    "<p>Hello " + sellerName + ",</p>" +
    "<p>Your sale has been confirmed!</p>" +
    "<p><strong>Cards Sold:</strong> " + cardSummary + "</p>" +
    "<p><strong>Sale Value:</strong> $" + transactionValue + "</p>" +
    "<p><strong>Commission Deducted:</strong> $" + commissionAmount + "</p>" +
    "<p><strong>Net Proceeds:</strong> $" + (transactionValue - commissionAmount) + "</p>" +
    "<p><strong>Status:</strong> " + status + "</p>" +
    "<p><a href='https://yourapp.com/transactions/" + e.record.id + "'>View Transaction</a></p>";
  
  const sellerMessage = new MailerMessage({
    from: {
      address: $app.settings().meta.senderAddress,
      name: $app.settings().meta.senderName
    },
    to: [{ address: sellerEmail }],
    subject: "Sale Confirmation - Transaction #" + e.record.id,
    html: sellerEmailBody
  });
  
  $app.newMailClient().send(sellerMessage);
  e.next();
}, "transactions");