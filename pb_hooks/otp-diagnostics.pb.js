/// <reference path="../pb_data/types.d.ts" />
// OTP Diagnostics and Monitoring Hook
// Logs OTP-related events for debugging and monitoring

onRecordCreate((e) => {
  try {
    // Log all user creation attempts
    const email = e.record.get("email");
    console.log("User creation initiated for: " + email);
    e.next();
  } catch (error) {
    console.error("User creation hook error: " + error.message);
    e.next();
  }
}, "users");

onRecordAfterCreateSuccess((e) => {
  try {
    const email = e.record.get("email");
    const userId = e.record.id;
    console.log("User successfully created - ID: " + userId + ", Email: " + email);
    
    // Send welcome email
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName
      },
      to: [{ address: email }],
      subject: "Welcome to Our Platform",
      html: "<h2>Welcome!</h2><p>Your account has been created successfully.</p><p>You can now use OTP authentication to log in without a password.</p>"
    });
    
    try {
      $app.newMailClient().send(message);
      console.log("Welcome email sent to: " + email);
    } catch (emailError) {
      console.error("Failed to send welcome email to " + email + ": " + emailError.message);
    }
    
    e.next();
  } catch (error) {
    console.error("User creation success hook error: " + error.message);
    e.next();
  }
}, "users");

onRecordUpdate((e) => {
  try {
    const email = e.record.get("email");
    const userId = e.record.id;
    console.log("User update initiated - ID: " + userId + ", Email: " + email);
    e.next();
  } catch (error) {
    console.error("User update hook error: " + error.message);
    e.next();
  }
}, "users");

onRecordAfterUpdateSuccess((e) => {
  try {
    const email = e.record.get("email");
    const userId = e.record.id;
    console.log("User successfully updated - ID: " + userId + ", Email: " + email);
    e.next();
  } catch (error) {
    console.error("User update success hook error: " + error.message);
    e.next();
  }
}, "users");