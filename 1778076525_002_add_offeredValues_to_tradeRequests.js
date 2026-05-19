/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tradeRequests");

  const existing = collection.fields.getByName("offeredValues");
  if (existing) {
    if (existing.type === "json") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("offeredValues"); // exists with wrong type, remove first
  }

  collection.fields.add(new JSONField({
    name: "offeredValues"
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("tradeRequests");
    collection.fields.removeByName("offeredValues");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})