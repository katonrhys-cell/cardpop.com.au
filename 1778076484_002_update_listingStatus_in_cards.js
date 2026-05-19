/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("cards");
  const field = collection.fields.getByName("listingStatus");
  field.values = ["Not Listed", "For Trade", "For Sale", "For Both"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("cards");
  const field = collection.fields.getByName("listingStatus");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["Not Listed", "For Trade", "For Sale"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})