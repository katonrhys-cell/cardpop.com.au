/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("shop_products");

  const existing = collection.fields.getByName("visibility");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("visibility"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "visibility",
    required: false,
    values: ["public", "private", "marketplace-only"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("shop_products");
    collection.fields.removeByName("visibility");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
