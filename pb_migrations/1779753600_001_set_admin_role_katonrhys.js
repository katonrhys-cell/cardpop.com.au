/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let record;
  try {
    record = app.findFirstRecordByData("users", "email", "katonrhys@gmail.com");
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("User katonrhys@gmail.com not found, skipping");
      return;
    }
    throw e;
  }

  record.set("role", "admin");
  record.set("emailVerified", true);
  record.set("verified", true);
  record.set("accountLockedUntil", null);
  record.set("failedLoginAttempts", 0);

  app.save(record);
  console.log("Admin role granted to katonrhys@gmail.com");
}, (app) => {
  let record;
  try {
    record = app.findFirstRecordByData("users", "email", "katonrhys@gmail.com");
  } catch (e) {
    return;
  }
  record.set("role", "");
  app.save(record);
});
