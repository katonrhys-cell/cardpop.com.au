/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const otpCode = e.record.get("otpCode");
  if (otpCode && e.record.get("mfaEnabled")) {
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: e.record.get("email") }],
      subject: "Your MFA Code",
      html: "<h2>Multi-Factor Authentication Code</h2><p>Your MFA code is:</p><p><strong style='font-size: 28px; letter-spacing: 3px;'>" + otpCode + "</strong></p><p>This code will expire in 5 minutes.</p><p>If you did not request this code, please ignore this email and contact support immediately.</p>"
    });
    $app.newMailClient().send(message);
  }
  e.next();
}, "users");