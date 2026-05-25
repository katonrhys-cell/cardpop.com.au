/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  collection.listRule = "emailVerified = true && is_public = true || id = @request.auth.id";
  collection.viewRule = "emailVerified = true && is_public = true || id = @request.auth.id";
  collection.updateRule = "id = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("users");
  collection.listRule = "id = @request.auth.id || emailVerified = true";
  collection.viewRule = "emailVerified = true";
  collection.updateRule = "id = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
