/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("blog_articles");

  const existing = collection.fields.getByName("category");
  if (existing) return;

  collection.fields.add(new SelectField({
    name: "category",
    required: false,
    maxSelect: 1,
    values: [
      "australia-focus",
      "beginner-guides",
      "card-spotlight",
      "grading-guides",
      "investing-value",
      "news-releases"
    ]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("blog_articles");
    collection.fields.removeByName("category");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) return;
    throw e;
  }
});
