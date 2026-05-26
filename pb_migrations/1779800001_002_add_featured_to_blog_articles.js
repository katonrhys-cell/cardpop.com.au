/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("blog_articles");

  const existing = collection.fields.getByName("featured");
  if (existing) return;

  collection.fields.add(new BoolField({
    name: "featured",
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("blog_articles");
    collection.fields.removeByName("featured");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) return;
    throw e;
  }
});
