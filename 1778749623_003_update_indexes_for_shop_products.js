/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("shop_products");
  collection.indexes.push("CREATE INDEX idx_shop_products_categoryId ON shop_products (categoryId)");
  collection.indexes.push("CREATE INDEX idx_shop_products_subcategoryId ON shop_products (subcategoryId)");
  collection.indexes.push("CREATE INDEX idx_shop_products_productTypeId ON shop_products (productTypeId)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("shop_products");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_shop_products_categoryId"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_shop_products_subcategoryId"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_shop_products_productTypeId"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})