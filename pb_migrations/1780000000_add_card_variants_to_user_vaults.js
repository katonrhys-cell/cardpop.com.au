/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_vaults");

  const field = new SelectField({
    name: 'cardVariants',
    required: false,
    maxSelect: 10,
    values: [
      'Base', 'Holo', 'Reverse Holo', 'Refractor', 'Chrome', 'Prizm',
      'Parallel', 'Rainbow', 'Gold', 'Silver', 'Foil',
      'Rookie Card (RC)', 'Auto', 'Patch', 'Relic / Jersey', 'Numbered', 'Short Print (SP)',
      'Full Art', 'Alt Art', 'Extended Art', 'Showcase', 'Borderless',
      '1st Edition', 'Shadowless', 'Promo', 'Error / Misprint',
    ],
  });

  collection.fields.add(field);
  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("user_vaults");
    const field = collection.fields.getByName("cardVariants");
    if (field) {
      collection.fields.remove(field);
      return app.save(collection);
    }
  } catch (e) {
    console.log('[cardVariants rollback] skipped:', e.message);
  }
});
