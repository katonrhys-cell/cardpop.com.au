// CardPop Email Hooks — OTP login confirmation & welcome email

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
    '<tr><td style="background:#FFFFFF;padding:40px;border-radius:0 0 0 0;">' +
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

// Hook: Send security alert after OTP login
onRecordAuthRequest((e) => {
  if (e.authMethod !== "otp") {
    e.next();
    return;
  }

  try {
    var userEmail = e.record.email();
    var userName = e.record.get("name") || "Collector";
    var loginTime = new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "long", timeStyle: "short" });

    var body =
      '<p>A new sign-in to your CardPop account was completed using a one-time code. If this was you, no further action is needed.</p>' +
      '<div style="background:#F9FAFB;border-left:4px solid #E63946;border-radius:0 8px 8px 0;padding:16px 20px;margin:24px 0">' +
      '<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Sign-in Details</p>' +
      '<p style="margin:0 0 4px;font-size:14px;color:#111827;"><strong>Time:</strong> ' + loginTime + ' (AEDT)</p>' +
      '<p style="margin:0;font-size:14px;color:#111827;"><strong>Method:</strong> One-Time Password (OTP)</p>' +
      '</div>' +
      '<p>If you didn\'t sign in, please secure your account immediately by changing your password.</p>';

    var html = cpEmail(
      'New sign-in to your CardPop account.',
      'New Sign-In Detected',
      'Hi ' + userName + ',',
      body,
      'https://cardpop.online/account/security',
      'Review Account Security',
      'This is an automated security alert. If you initiated this sign-in, you can safely ignore this email.'
    );

    var message = new MailerMessage({
      from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
      to: [{ address: userEmail }],
      subject: "New sign-in to your CardPop account",
      html: html
    });

    $app.newMailClient().send(message);
  } catch (error) {
    console.error("Failed to send OTP auth email:", error);
  }

  e.next();
}, "users");

// Hook: Send welcome email to new members
onRecordAfterCreateSuccess((e) => {
  try {
    var userEmail = e.record.get("email");
    var userName = e.record.get("name") || "Collector";

    var body =
      '<p>You\'ve just joined Australia\'s most dedicated trading card community — a place where collectors connect, buy, sell, and trade the cards they love.</p>' +
      '<p style="margin:20px 0 12px;font-size:14px;font-weight:700;color:#111827;">Here\'s what\'s waiting for you on CardPop:</p>' +
      '<table cellpadding="0" cellspacing="0" border="0" width="100%">' +
      '<tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;"><span style="color:#E63946;font-weight:700;margin-right:8px;">&#9632;</span><strong style="color:#111827;">Marketplace</strong> <span style="color:#6B7280">— Browse and list cards for sale</span></td></tr>' +
      '<tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;"><span style="color:#E63946;font-weight:700;margin-right:8px;">&#9632;</span><strong style="color:#111827;">Trade Hub</strong> <span style="color:#6B7280">— Swap directly with other collectors</span></td></tr>' +
      '<tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;"><span style="color:#E63946;font-weight:700;margin-right:8px;">&#9632;</span><strong style="color:#111827;">My Vault</strong> <span style="color:#6B7280">— Build and manage your personal collection</span></td></tr>' +
      '<tr><td style="padding:8px 0;"><span style="color:#E63946;font-weight:700;margin-right:8px;">&#9632;</span><strong style="color:#111827;">Analytics</strong> <span style="color:#6B7280">— Track card values and market trends</span></td></tr>' +
      '</table>' +
      '<p style="margin-top:24px;">We\'re glad to have you here. Welcome to the hobby, done right.</p>';

    var html = cpEmail(
      'Your CardPop account is ready. Welcome to the community!',
      'Welcome to CardPop!',
      'G\'day ' + userName + '!',
      body,
      'https://cardpop.online/markets',
      'Explore the Marketplace',
      ''
    );

    var message = new MailerMessage({
      from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
      to: [{ address: userEmail }],
      subject: "Welcome to CardPop, " + userName + "!",
      html: html
    });

    $app.newMailClient().send(message);
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }

  e.next();
}, "users");
