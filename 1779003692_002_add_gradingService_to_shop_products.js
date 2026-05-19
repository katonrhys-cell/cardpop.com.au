/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("shop_products");

  const existing = collection.fields.getByName("gradingService");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("gradingService"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "gradingService",
    required: false,
    values: ["PSA", "BGS", "Beckett", "CGC", "Raw", "None"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("shop_products");
    collection.fields.removeByName("gradingService");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
