/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("transactions");
  // No rules to update
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("transactions");
  collection.listRule = "@request.auth.id != \"\"";
  collection.viewRule = "@request.auth.id != \"\"";
  collection.createRule = "@request.auth.id != \"\"";
  collection.updateRule = "@request.auth.id != \"\"";
  collection.deleteRule = null;
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})