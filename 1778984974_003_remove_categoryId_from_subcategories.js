/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("subcategories");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_subcategories_categoryId"));
  collection.fields.removeByName("categoryId");
  return app.save(collection);
}, (app) => {
  try {

  const collection = app.findCollectionByNameOrId("subcategories");
  collection.fields.add(new TextField({
    name: "categoryId",
    required: true,
    min: 0,
    max: 0
  }));
  collection.indexes.push("CREATE INDEX idx_subcategories_categoryId ON subcategories (categoryId)");
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
