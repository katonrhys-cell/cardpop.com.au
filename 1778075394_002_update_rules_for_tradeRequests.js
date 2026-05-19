/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tradeRequests");
  // No rules to update
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("tradeRequests");
  collection.listRule = "sender = @request.auth.id || recipient = @request.auth.id";
  collection.viewRule = "sender = @request.auth.id || recipient = @request.auth.id";
  collection.createRule = "@request.auth.id != \"\"";
  collection.updateRule = "recipient = @request.auth.id";
  collection.deleteRule = "sender = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})