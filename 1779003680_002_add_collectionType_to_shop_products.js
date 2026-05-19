/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("shop_products");

  const existing = collection.fields.getByName("collectionType");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("collectionType"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "collectionType",
    required: false,
    values: ["Pokemon", "Magic: The Gathering", "Yu-Gi-Oh", "NBA", "NFL", "MLB", "Cricket", "NRL", "Formula 1", "Wrestling", "Golf", "Soccer", "AFL", "Tennis", "UFC", "Digimon", "Riftbound", "TMNT", "Final Fantasy", "Disney Lorcana", "One Piece", "NBL", "NHL", "Baseball", "Other"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("shop_products");
    collection.fields.removeByName("collectionType");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
