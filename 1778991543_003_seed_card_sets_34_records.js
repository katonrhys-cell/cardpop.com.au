/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("card_sets");

  const record0 = new Record(collection);
    const record0_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ravensburger'");
    if (!record0_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ravensburger'\""); }
    record0.set("brand_id", record0_brand_idLookup.id);
    record0.set("name", "The First Chapter");
    record0.set("description", "Ravensburger Disney Lorcana The First Chapter");
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record1 = new Record(collection);
    const record1_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ravensburger'");
    if (!record1_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ravensburger'\""); }
    record1.set("brand_id", record1_brand_idLookup.id);
    record1.set("name", "Rise of the Floodborn");
    record1.set("description", "Ravensburger Disney Lorcana Rise of the Floodborn");
  try {
    app.save(record1);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record2 = new Record(collection);
    const record2_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ravensburger'");
    if (!record2_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ravensburger'\""); }
    record2.set("brand_id", record2_brand_idLookup.id);
    record2.set("name", "Into the Inklands");
    record2.set("description", "Ravensburger Disney Lorcana Into the Inklands");
  try {
    app.save(record2);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record3 = new Record(collection);
    const record3_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ravensburger'");
    if (!record3_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ravensburger'\""); }
    record3.set("brand_id", record3_brand_idLookup.id);
    record3.set("name", "Ursula's Return");
    record3.set("description", "Ravensburger Disney Lorcana Ursula's Return");
  try {
    app.save(record3);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record4 = new Record(collection);
    const record4_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ravensburger'");
    if (!record4_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ravensburger'\""); }
    record4.set("brand_id", record4_brand_idLookup.id);
    record4.set("name", "Shimmering Skies");
    record4.set("description", "Ravensburger Disney Lorcana Shimmering Skies");
  try {
    app.save(record4);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record5 = new Record(collection);
    const record5_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ravensburger'");
    if (!record5_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ravensburger'\""); }
    record5.set("brand_id", record5_brand_idLookup.id);
    record5.set("name", "Azurite Sea");
    record5.set("description", "Ravensburger Disney Lorcana Azurite Sea");
  try {
    app.save(record5);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record6 = new Record(collection);
    const record6_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record6_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record6.set("brand_id", record6_brand_idLookup.id);
    record6.set("name", "Prizm");
    record6.set("description", "Panini America Prizm NBA basketball cards");
  try {
    app.save(record6);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record7 = new Record(collection);
    const record7_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record7_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record7.set("brand_id", record7_brand_idLookup.id);
    record7.set("name", "Select");
    record7.set("description", "Panini America Select NBA basketball cards");
  try {
    app.save(record7);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record8 = new Record(collection);
    const record8_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record8_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record8.set("brand_id", record8_brand_idLookup.id);
    record8.set("name", "Donruss");
    record8.set("description", "Panini America Donruss NBA basketball cards");
  try {
    app.save(record8);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record9 = new Record(collection);
    const record9_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record9_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record9.set("brand_id", record9_brand_idLookup.id);
    record9.set("name", "Donruss Optic");
    record9.set("description", "Panini America Donruss Optic NBA basketball cards");
  try {
    app.save(record9);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record10 = new Record(collection);
    const record10_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record10_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record10.set("brand_id", record10_brand_idLookup.id);
    record10.set("name", "Mosaic");
    record10.set("description", "Panini America Mosaic NBA basketball cards");
  try {
    app.save(record10);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record11 = new Record(collection);
    const record11_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record11_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record11.set("brand_id", record11_brand_idLookup.id);
    record11.set("name", "Hoops");
    record11.set("description", "Panini America Hoops NBA basketball cards");
  try {
    app.save(record11);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record12 = new Record(collection);
    const record12_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record12_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record12.set("brand_id", record12_brand_idLookup.id);
    record12.set("name", "Revolution");
    record12.set("description", "Panini America Revolution NBA basketball cards");
  try {
    app.save(record12);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record13 = new Record(collection);
    const record13_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record13_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record13.set("brand_id", record13_brand_idLookup.id);
    record13.set("name", "Recon");
    record13.set("description", "Panini America Recon NBA basketball cards");
  try {
    app.save(record13);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record14 = new Record(collection);
    const record14_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record14_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record14.set("brand_id", record14_brand_idLookup.id);
    record14.set("name", "Flux");
    record14.set("description", "Panini America Flux NBA basketball cards");
  try {
    app.save(record14);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record15 = new Record(collection);
    const record15_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record15_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record15.set("brand_id", record15_brand_idLookup.id);
    record15.set("name", "National Treasures");
    record15.set("description", "Panini America National Treasures NBA basketball cards");
  try {
    app.save(record15);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record16 = new Record(collection);
    const record16_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record16_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record16.set("brand_id", record16_brand_idLookup.id);
    record16.set("name", "Flawless");
    record16.set("description", "Panini America Flawless NBA basketball cards");
  try {
    app.save(record16);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record17 = new Record(collection);
    const record17_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record17_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record17.set("brand_id", record17_brand_idLookup.id);
    record17.set("name", "Immaculate");
    record17.set("description", "Panini America Immaculate NBA basketball cards");
  try {
    app.save(record17);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record18 = new Record(collection);
    const record18_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record18_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record18.set("brand_id", record18_brand_idLookup.id);
    record18.set("name", "Noir");
    record18.set("description", "Panini America Noir NBA basketball cards");
  try {
    app.save(record18);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record19 = new Record(collection);
    const record19_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record19_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record19.set("brand_id", record19_brand_idLookup.id);
    record19.set("name", "Eminence");
    record19.set("description", "Panini America Eminence NBA basketball cards");
  try {
    app.save(record19);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record20 = new Record(collection);
    const record20_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record20_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record20.set("brand_id", record20_brand_idLookup.id);
    record20.set("name", "Court Kings");
    record20.set("description", "Panini America Court Kings NBA basketball cards");
  try {
    app.save(record20);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record21 = new Record(collection);
    const record21_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record21_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record21.set("brand_id", record21_brand_idLookup.id);
    record21.set("name", "Origins");
    record21.set("description", "Panini America Origins NBA basketball cards");
  try {
    app.save(record21);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record22 = new Record(collection);
    const record22_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record22_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record22.set("brand_id", record22_brand_idLookup.id);
    record22.set("name", "Obsidian");
    record22.set("description", "Panini America Obsidian NBA basketball cards");
  try {
    app.save(record22);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record23 = new Record(collection);
    const record23_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record23_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record23.set("brand_id", record23_brand_idLookup.id);
    record23.set("name", "Crown Royale");
    record23.set("description", "Panini America Crown Royale NBA basketball cards");
  try {
    app.save(record23);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record24 = new Record(collection);
    const record24_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record24_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record24.set("brand_id", record24_brand_idLookup.id);
    record24.set("name", "Spectra");
    record24.set("description", "Panini America Spectra NBA basketball cards");
  try {
    app.save(record24);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record25 = new Record(collection);
    const record25_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record25_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record25.set("brand_id", record25_brand_idLookup.id);
    record25.set("name", "Contenders");
    record25.set("description", "Panini America Contenders NBA basketball cards");
  try {
    app.save(record25);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record26 = new Record(collection);
    const record26_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record26_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record26.set("brand_id", record26_brand_idLookup.id);
    record26.set("name", "Topps Chrome Basketball");
    record26.set("description", "Topps Chrome Basketball cards");
  try {
    app.save(record26);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record27 = new Record(collection);
    const record27_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record27_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record27.set("brand_id", record27_brand_idLookup.id);
    record27.set("name", "Bowman Basketball");
    record27.set("description", "Topps Bowman Basketball cards");
  try {
    app.save(record27);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record28 = new Record(collection);
    const record28_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record28_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record28.set("brand_id", record28_brand_idLookup.id);
    record28.set("name", "Topps Finest");
    record28.set("description", "Topps Finest Basketball cards");
  try {
    app.save(record28);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record29 = new Record(collection);
    const record29_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record29_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record29.set("brand_id", record29_brand_idLookup.id);
    record29.set("name", "Topps Stadium Club");
    record29.set("description", "Topps Stadium Club Basketball cards");
  try {
    app.save(record29);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record30 = new Record(collection);
    const record30_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record30_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record30.set("brand_id", record30_brand_idLookup.id);
    record30.set("name", "SP Authentic");
    record30.set("description", "Upper Deck SP Authentic Basketball cards");
  try {
    app.save(record30);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record31 = new Record(collection);
    const record31_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record31_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record31.set("brand_id", record31_brand_idLookup.id);
    record31.set("name", "Ultimate Collection");
    record31.set("description", "Upper Deck Ultimate Collection Basketball cards");
  try {
    app.save(record31);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record32 = new Record(collection);
    const record32_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record32_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record32.set("brand_id", record32_brand_idLookup.id);
    record32.set("name", "UD Black");
    record32.set("description", "Upper Deck UD Black Basketball cards");
  try {
    app.save(record32);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record33 = new Record(collection);
    const record33_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record33_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record33.set("brand_id", record33_brand_idLookup.id);
    record33.set("name", "Exquisite Collection");
    record33.set("description", "Upper Deck Exquisite Collection Basketball cards");
  try {
    app.save(record33);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
