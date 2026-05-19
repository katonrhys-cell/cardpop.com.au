/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("loginAttempts");
  collection.indexes.push("CREATE UNIQUE INDEX idx_loginAttempts_email_ipAddress ON loginAttempts (email, ipAddress)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("loginAttempts");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_loginAttempts_email_ipAddress"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})