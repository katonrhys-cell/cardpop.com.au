/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("cardListings");
  collection.listRule = "marketplaceStatus != \"Private\"";
  collection.viewRule = "marketplaceStatus != \"Private\" || owner = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("cardListings");
  collection.listRule = "owner = @request.auth.id";
  collection.viewRule = "owner = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})