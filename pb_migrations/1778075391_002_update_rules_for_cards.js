/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("cards");
  collection.listRule = "listingStatus != \"Not Listed\"";
  collection.viewRule = "listingStatus != \"Not Listed\" || owner = @request.auth.id";
  collection.createRule = "@request.auth.id != \"\" && @request.auth.emailVerified = true";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("cards");
  collection.listRule = "";
  collection.viewRule = "";
  collection.createRule = "@request.auth.id != \"\"";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})