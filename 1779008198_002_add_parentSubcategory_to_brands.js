/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const pbc_1310490083Collection = app.findCollectionByNameOrId("pbc_1310490083");
  const collection = app.findCollectionByNameOrId("brands");

  const existing = collection.fields.getByName("parentSubcategory");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("parentSubcategory"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "parentSubcategory",
    required: true,
    collectionId: pbc_1310490083Collection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("brands");
    collection.fields.removeByName("parentSubcategory");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
