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
  var recipientId = e.record.get("recipientId");
  var senderId = e.record.get("senderId");
  var tradeMessage = e.record.get("message");
  var offeredValues = e.record.get("offeredValues");
  var requestedValues = e.record.get("requestedValues");

  var recipient = $app.findRecordById("users", recipientId);
  if (!recipient) {
    e.next();
    return;
  }

  var sender = $app.findRecordById("users", senderId);
  var senderName = sender ? (sender.get("name") || "A collector") : "A collector";
  var recipientName = recipient.get("name") || "Collector";
  var recipientEmail = recipient.get("email");

  var offeredCount = (offeredValues && Array.isArray(offeredValues)) ? offeredValues.length : 0;
  var requestedCount = (requestedValues && Array.isArray(requestedValues)) ? requestedValues.length : 0;

  var body =
    '<p><strong>' + senderName + '</strong> has sent you a trade offer on CardPop. Review the details below and decide whether to accept or pass.</p>' +
    '<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;">' +
    '<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Trade Summary</p>' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%">' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;"><strong>From:</strong> ' + senderName + '</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;"><strong>Cards they\'re offering:</strong> ' + offeredCount + ' card' + (offeredCount !== 1 ? 's' : '') + '</td></tr>' +
    '<tr><td style="padding:6px 0;font-size:14px;color:#374151;' + (tradeMessage ? 'border-bottom:1px solid #F3F4F6;' : '') + '"><strong>Cards they\'re requesting:</strong> ' + requestedCount + ' card' + (requestedCount !== 1 ? 's' : '') + '</td></tr>' +
    (tradeMessage ? '<tr><td style="padding:6px 0;font-size:14px;color:#374151;"><strong>Message:</strong> ' + tradeMessage + '</td></tr>' : '') +
    '</table>' +
    '</div>' +
    '<p>Head to your trade requests to review the full offer and respond.</p>';

  var html = cpEmail(
    senderName + ' wants to trade with you on CardPop.',
    'You\'ve Received a Trade Offer',
    'Hi ' + recipientName + ',',
    body,
    'https://cardpop.online/trade-requests/' + e.record.id,
    'Review Trade Offer',
    'You\'re receiving this because someone sent you a trade request on CardPop. If you didn\'t expect this, you can ignore it.'
  );

  var mailMessage = new MailerMessage({
    from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
    to: [{ address: recipientEmail }],
    subject: senderName + " wants to trade with you on CardPop",
    html: html
  });

  $app.newMailClient().send(mailMessage);
  e.next();
}, "tradeRequests");
