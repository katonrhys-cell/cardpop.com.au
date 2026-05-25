/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("cardListings");
  collection.indexes.push("CREATE INDEX idx_cardListings_categoryId ON cardListings (categoryId)");
  collection.indexes.push("CREATE INDEX idx_cardListings_subcategoryId ON cardListings (subcategoryId)");
  collection.indexes.push("CREATE INDEX idx_cardListings_productTypeId ON cardListings (productTypeId)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("cardListings");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_cardListings_categoryId"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_cardListings_subcategoryId"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_cardListings_productTypeId"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})