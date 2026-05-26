/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("blog_articles");

  const existing = collection.fields.getByName("excerpt");
  if (existing) return;

  collection.fields.add(new TextField({
    name: "excerpt",
    required: false,
    max: 300
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("blog_articles");
    collection.fields.removeByName("excerpt");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) return;
    throw e;
  }
});
