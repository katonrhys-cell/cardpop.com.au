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

onRecordAfterUpdateSuccess((e) => {
  if (e.record.get("status") !== "Declined") {
    e.next();
    return;
  }

  var senderId = e.record.get("senderId");

  var sender = senderId ? $app.findRecordById("users", senderId) : null;
  if (!sender) {
    e.next();
    return;
  }

  var senderName = sender.get("name") || "Collector";
  var senderEmail = sender.get("email");

  var body =
    '<p>Your trade offer wasn\'t accepted this time — but don\'t be discouraged. Trades are all part of the hobby, and there are plenty of collectors on CardPop looking to make deals.</p>' +
    '<p>Here are a few things you can try next:</p>' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%">' +
    '<tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:14px;color:#374151;"><span style="color:#E63946;margin-right:8px;">&#8594;</span> Browse the marketplace for cards available to buy now</td></tr>' +
    '<tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:14px;color:#374151;"><span style="color:#E63946;margin-right:8px;">&#8594;</span> Search for other collectors who have the same card</td></tr>' +
    '<tr><td style="padding:8px 0;font-size:14px;color:#374151;"><span style="color:#E63946;margin-right:8px;">&#8594;</span> Add the card to your watchlist to track its availability</td></tr>' +
    '</table>' +
    '<p style="margin-top:20px;">The right trade is out there — keep hunting.</p>';

  var html = cpEmail(
    'An update on your CardPop trade request.',
    'Trade Request Update',
    'Hi ' + senderName + ',',
    body,
    'https://cardpop.online/markets',
    'Browse the Marketplace',
    ''
  );

  var message = new MailerMessage({
    from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
    to: [{ address: senderEmail }],
    subject: "Update on your CardPop trade request",
    html: html
  });

  $app.newMailClient().send(message);
  e.next();
}, "tradeRequests");
