/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const verificationCode = e.record.get("verificationCode");
  if (verificationCode) {
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: e.record.get("email") }],
      subject: "Email Verification Code",
      html: "<h2>Verify Your Email</h2><p>Thank you for signing up! Please use the following code to verify your email address:</p><p><strong style='font-size: 24px; letter-spacing: 2px;'>" + verificationCode + "</strong></p><p>This code will expire in 24 hours.</p><p>If you did not create this account, please ignore this email.</p>"
    });
    $app.newMailClient().send(message);
  }
  e.next();
}, "users");