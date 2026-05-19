/// <reference path="../pb_data/types.d.ts" />
onRecordAfterUpdateSuccess((e) => {
  const status = e.record.get("status");
  const original = e.record.original();
  const originalStatus = original.get("status");
  
  // Only process when status changes to "Completed"
  if (status !== "Completed" || originalStatus === "Completed") {
    e.next();
    return;
  }
  
  const userIds = e.record.get("userIds");
  const transactionValue = e.record.get("transactionValue");
  const commissionAmount = e.record.get("commissionAmount");
  const type = e.record.get("type");
  
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
  
  // Update seller's balance (deduct commission)
  const sellerCurrentBalance = seller.get("currentBalance") || 0;
  const sellerTotalCommissions = seller.get("totalCommissionsPaid") || 0;
  
  seller.set("currentBalance", sellerCurrentBalance + (transactionValue - commissionAmount));
  seller.set("totalCommissionsPaid", sellerTotalCommissions + commissionAmount);
  
  // Update buyer's balance (deduct transaction value)
  const buyerCurrentBalance = buyer.get("currentBalance") || 0;
  buyer.set("currentBalance", buyerCurrentBalance - transactionValue);
  
  // Save both records
  $app.save(seller);
  $app.save(buyer);
  
  e.next();
}, "transactions");