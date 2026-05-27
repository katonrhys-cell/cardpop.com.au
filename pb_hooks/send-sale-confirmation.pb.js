/// <reference path="../pb_data/types.d.ts" />

function cpEmail(preheader, titleBand, greeting, bodyHtml, ctaUrl, ctaText, footerNote) {
  var cta = ctaUrl
    ? '<div style="text-align:center;margin:32px 0 0"><a href="' + ctaUrl + '" style="background:#E63946;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;letter-spacing:-0.3px">' + ctaText + '</a></div>'
    : '';
  var titleRow = titleBand
    ? '<tr><td style="background:#1C1C1E;padding:20px 40px;"><p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;line-height:1.3;">' + titleBand + '</p></td></tr>'
    : '';
  var greetingRow = greeting
    ? '<p style="margin:0 0 20px;font-size:17px;font-weight:600;color:#111827;">' + greeting + '</p>'
    : '';
  var footerNoteRow = footerNote
    ? '<p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">' + footerNote + '</p>'
    : '';

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CardPop</title></head>' +
    '<body style="margin:0;padding:0;background:#F0F0F5;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
    '<div style="display:none;max-height:0;overflow:hidden;color:transparent;">' + preheader + '</div>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F0F5;padding:40px 16px;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">' +
    '<tr><td style="background:#E63946;border-radius:12px 12px 0 0;padding:28px 40px 24px;text-align:center;">' +
    '<p style="margin:0;font-size:30px;font-weight:900;color:#FFFFFF;letter-spacing:-1px;">CardPop</p>' +
    '<p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:2.5px;text-transform:uppercase;">Australia\'s Card Marketplace</p>' +
    '</td></tr>' +
    titleRow +
    '<tr><td style="background:#FFFFFF;padding:40px;">' +
    greetingRow +
    '<div style="font-size:15px;line-height:1.7;color:#374151;">' + bodyHtml + '</div>' +
    cta +
    '<div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E7EB;">' +
    '<p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">Questions? Reach us at <a href="mailto:support@cardpop.online" style="color:#E63946;text-decoration:none;">support@cardpop.online</a></p>' +
    footerNoteRow +
    '</div>' +
    '</td></tr>' +
    '<tr><td style="background:#1C1C1E;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">' +
    '<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#FFFFFF;">CardPop</p>' +
    '<p style="margin:0 0 12px;font-size:12px;color:#9CA3AF;">Australia\'s Premium Trading Card Marketplace</p>' +
    '<p style="margin:0;font-size:12px;"><a href="https://cardpop.online" style="color:#E63946;text-decoration:none;">cardpop.online</a> &nbsp;&middot;&nbsp; <a href="https://cardpop.online/account" style="color:#9CA3AF;text-decoration:none;">My Account</a> &nbsp;&middot;&nbsp; <a href="mailto:support@cardpop.online" style="color:#9CA3AF;text-decoration:none;">Support</a></p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr></table>' +
    '</body></html>';
}

onRecordAfterCreateSuccess((e) => {
  if (e.record.get("type") !== "Sale") {
    e.next();
    return;
  }

  var userIds = e.record.get("userIds");
  var cardIds = e.record.get("cardIds");
  var transactionValue = e.record.get("transactionValue");
  var commissionAmount = e.record.get("commissionAmount") || 0;
  var status = e.record.get("status");

  if (!userIds || userIds.length < 2) {
    e.next();
    return;
  }

  var buyerId = userIds[0];
  var sellerId = userIds[1];

  var buyer = $app.findRecordById("users", buyerId);
  var seller = $app.findRecordById("users", sellerId);

  if (!buyer || !seller) {
    e.next();
    return;
  }

  var buyerEmail = buyer.get("email");
  var sellerEmail = seller.get("email");
  var buyerName = buyer.get("name") || "Collector";
  var sellerName = seller.get("name") || "Collector";

  var cardCount = (cardIds && Array.isArray(cardIds)) ? cardIds.length : 0;
  var cardLabel = cardCount + ' card' + (cardCount !== 1 ? 's' : '');
  var netProceeds = (parseFloat(transactionValue) - parseFloat(commissionAmount)).toFixed(2);

  // Buyer email
  var buyerBody =
    '<p>Your purchase has been confirmed. Here\'s a summary of what you\'ve secured:</p>' +
    '<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;">' +
    '<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Order Summary</p>' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%">' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;"><strong>Cards purchased:</strong> ' + cardLabel + '</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;"><strong>Total paid:</strong> $' + transactionValue + ' AUD</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;"><strong>Status:</strong> ' + status + '</td></tr>' +
    '</table>' +
    '</div>' +
    '<p>Check your transaction details to coordinate delivery with the seller. Enjoy your new addition to the collection!</p>';

  var buyerHtml = cpEmail(
    'Your CardPop purchase is confirmed — check the details inside.',
    'Purchase Confirmed!',
    'You did it, ' + buyerName + '!',
    buyerBody,
    'https://cardpop.online/transactions/' + e.record.id,
    'View Transaction',
    'This receipt was sent to confirm your purchase on CardPop. Keep it for your records.'
  );

  var buyerMessage = new MailerMessage({
    from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
    to: [{ address: buyerEmail }],
    subject: "Your CardPop purchase is confirmed!",
    html: buyerHtml
  });

  $app.newMailClient().send(buyerMessage);

  // Seller email
  var sellerBody =
    '<p>Congratulations — your listing sold on CardPop! Here\'s a breakdown of your sale:</p>' +
    '<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;">' +
    '<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Sale Summary</p>' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%">' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;"><strong>Cards sold:</strong> ' + cardLabel + '</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;"><strong>Sale value:</strong> $' + transactionValue + ' AUD</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;"><strong>Platform fee:</strong> $' + commissionAmount + ' AUD</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:15px;font-weight:700;color:#111827;border-bottom:1px solid #F3F4F6;"><strong>Net proceeds:</strong> $' + netProceeds + ' AUD</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;"><strong>Status:</strong> ' + status + '</td></tr>' +
    '</table>' +
    '</div>' +
    '<p>Head to your transaction details to arrange delivery with the buyer and finalise the sale.</p>';

  var sellerHtml = cpEmail(
    'You made a sale on CardPop — great work!',
    'You Made a Sale!',
    'Well done, ' + sellerName + '!',
    sellerBody,
    'https://cardpop.online/transactions/' + e.record.id,
    'View Transaction',
    'This receipt was sent to confirm your sale on CardPop. Keep it for your records.'
  );

  var sellerMessage = new MailerMessage({
    from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
    to: [{ address: sellerEmail }],
    subject: "You made a sale on CardPop!",
    html: sellerHtml
  });

  $app.newMailClient().send(sellerMessage);
  e.next();
}, "transactions");
