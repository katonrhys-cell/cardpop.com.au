/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const categoriesCollection = app.findCollectionByNameOrId("categories");
  const collection = app.findCollectionByNameOrId("subcategories");

  const existing = collection.fields.getByName("parentCategory");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("parentCategory"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "parentCategory",
    required: true,
    collectionId: categoriesCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("subcategories");
    collection.fields.removeByName("parentCategory");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
