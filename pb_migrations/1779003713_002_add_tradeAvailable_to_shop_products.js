/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("shop_products");

  const existing = collection.fields.getByName("tradeAvailable");
  if (existing) {
    if (existing.type === "bool") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("tradeAvailable"); // exists with wrong type, remove first
  }

  collection.fields.add(new BoolField({
    name: "tradeAvailable",
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("shop_products");
    collection.fields.removeByName("tradeAvailable");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
