/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  // Enable MFA
  collection.mfa.enabled = true;
  collection.mfa.duration = 300;
  collection.mfa.rule = "";

  // Enable OTP as MFA second factor option (email codes)
  collection.otp.enabled = true;
  collection.otp.duration = 300;
  collection.otp.length = 8;
  // MFA uses OTP (email code) as second factor
  // Flow: password -> catch mfaId -> requestOTP -> authWithOTP(otpId, code, {mfaId})

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("users");

    collection.mfa.enabled = false;
    collection.otp.enabled = false;

    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})