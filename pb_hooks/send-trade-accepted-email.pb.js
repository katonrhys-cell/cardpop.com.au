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
  if (e.record.get("status") !== "Accepted") {
    e.next();
    return;
  }

  var senderId = e.record.get("senderId");
  var recipientId = e.record.get("recipientId");

  var sender = senderId ? $app.findRecordById("users", senderId) : null;
  var recipient = recipientId ? $app.findRecordById("users", recipientId) : null;

  if (!sender) {
    e.next();
    return;
  }

  var senderName = sender.get("name") || "Collector";
  var senderEmail = sender.get("email");
  var recipientName = recipient ? (recipient.get("name") || "the other collector") : "the other collector";

  var body =
    '<p>Your trade offer was accepted by <strong>' + recipientName + '</strong> — time to make the swap happen!</p>' +
    '<div style="background:#F0FFF4;border-left:4px solid #22C55E;border-radius:0 8px 8px 0;padding:16px 20px;margin:24px 0;">' +
    '<p style="margin:0;font-size:15px;font-weight:700;color:#15803D;">Trade Accepted ✓</p>' +
    '<p style="margin:4px 0 0;font-size:13px;color:#166534;">Head to your trade requests to coordinate the next steps with ' + recipientName + '.</p>' +
    '</div>' +
    '<p>Once you\'ve both confirmed, your vault will be updated to reflect the new additions to your collection.</p>';

  var html = cpEmail(
    'Your CardPop trade offer was accepted!',
    'Your Trade Was Accepted!',
    'Great news, ' + senderName + '!',
    body,
    'https://cardpop.online/trade-requests/' + e.record.id,
    'View Your Trade',
    ''
  );

  var message = new MailerMessage({
    from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
    to: [{ address: senderEmail }],
    subject: "Your CardPop trade offer was accepted!",
    html: html
  });

  $app.newMailClient().send(message);
  e.next();
}, "tradeRequests");
