/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("shop_products");
  collection.listRule = "marketplaceStatus != \"Private\" || owner = @request.auth.id || seller = @request.auth.id";
  collection.viewRule = "marketplaceStatus != \"Private\" || owner = @request.auth.id || seller = @request.auth.id";
  collection.createRule = "@request.auth.id != \"\"";
  collection.updateRule = "owner = @request.auth.id || seller = @request.auth.id";
  collection.deleteRule = "owner = @request.auth.id || seller = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("shop_products");
  collection.listRule = "";
  collection.viewRule = "";
  collection.createRule = "@request.auth.id != \"\"";
  collection.updateRule = "@request.auth.id != \"\"";
  collection.deleteRule = "@request.auth.id != \"\"";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
