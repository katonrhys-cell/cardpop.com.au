/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_vaults");
  const field = collection.fields.getByName("listing_type");
  field.values = ["Private", "For Sale", "For Trade", "For Sale & Trade"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("user_vaults");
  const field = collection.fields.getByName("listing_type");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["Private", "Marketplace Only", "Both"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})
