/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("brands");
  collection.indexes.push("CREATE INDEX idx_brands_parentSubcategory ON brands (parentSubcategory)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("brands");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_brands_parentSubcategory"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
