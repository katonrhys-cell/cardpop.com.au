/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_vaults");
  collection.listRule = "user_id = @request.auth.id || @request.auth.role = \"admin\"";
  collection.viewRule = "user_id = @request.auth.id || @request.auth.role = \"admin\" || is_public = true";
  collection.createRule = "user_id = @request.auth.id";
  collection.updateRule = "user_id = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("user_vaults");
  collection.listRule = "user_id = @request.auth.id";
  collection.viewRule = "user_id = @request.auth.id";
  collection.createRule = "@request.auth.id != \"\"";
  collection.updateRule = "user_id = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
