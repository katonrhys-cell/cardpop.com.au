// OTP Email Sender Hook
// Sends email notifications for OTP authentication events

// Hook: Send email after successful OTP authentication
onRecordAuthRequest((e) => {
  // Only process OTP auth method
  if (e.authMethod !== "otp") {
    e.next();
    return;
  }

  try {
    const userEmail = e.record.email();
    const userName = e.record.get("name") || "User";

    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: userEmail }],
      subject: "Successful OTP Login",
      html: `
        <h2>Hello ${userName},</h2>
        <p>You have successfully logged in using OTP authentication.</p>
        <p>If this wasn't you, please secure your account immediately.</p>
        <p>Login details:</p>
        <ul>
          <li>Time: ${new Date().toLocaleString()}</li>
          <li>Method: OTP (One-Time Password)</li>
        </ul>
        <p>Thank you for using our platform!</p>
      `
    });

    $app.newMailClient().send(message);
  } catch (error) {
    console.error("Failed to send OTP auth email:", error);
  }

  e.next();
}, "users");

// Hook: Send welcome email for new user signups
onRecordAfterCreateSuccess((e) => {
  try {
    const userEmail = e.record.get("email");
    const userName = e.record.get("name") || "New User";

    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: userEmail }],
      subject: "Welcome to Our Platform!",
      html: `
        <h2>Welcome ${userName}!</h2>
        <p>Thank you for signing up. Your account has been created successfully.</p>
        <p>You can now log in using OTP (One-Time Password) authentication for secure access.</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Team</p>
      `
    });

    $app.newMailClient().send(message);
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }

  e.next();
}, "users");