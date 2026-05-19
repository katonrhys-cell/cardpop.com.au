/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("shop_products");

  const existing = collection.fields.getByName("priceSource");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("priceSource"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "priceSource",
    required: false,
    values: ["Market Value", "Personal Valuation", "Recent Sale"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("shop_products");
    collection.fields.removeByName("priceSource");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
