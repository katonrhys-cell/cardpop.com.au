/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_vaults");
  collection.indexes.push("CREATE INDEX idx_user_vaults_categoryId ON user_vaults (categoryId)");
  collection.indexes.push("CREATE INDEX idx_user_vaults_subcategoryId ON user_vaults (subcategoryId)");
  collection.indexes.push("CREATE INDEX idx_user_vaults_brandId ON user_vaults (brandId)");
  collection.indexes.push("CREATE INDEX idx_user_vaults_seriesId ON user_vaults (seriesId)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("user_vaults");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_user_vaults_categoryId"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_user_vaults_subcategoryId"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_user_vaults_brandId"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_user_vaults_seriesId"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
