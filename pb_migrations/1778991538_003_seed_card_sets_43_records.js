/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("card_sets");

  const record0 = new Record(collection);
    const record0_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Score Entertainment'");
    if (!record0_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Score Entertainment'\""); }
    record0.set("brand_id", record0_brand_idLookup.id);
    record0.set("name", "Dragon Ball Z CCG");
    record0.set("description", "Score Entertainment Dragon Ball Z CCG");
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
    const record1_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Score Entertainment'");
    if (!record1_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Score Entertainment'\""); }
    record1.set("brand_id", record1_brand_idLookup.id);
    record1.set("name", "Saiyan Saga");
    record1.set("description", "Score Entertainment Saiyan Saga Dragon Ball cards");
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
    const record2_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Score Entertainment'");
    if (!record2_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Score Entertainment'\""); }
    record2.set("brand_id", record2_brand_idLookup.id);
    record2.set("name", "Frieza Saga");
    record2.set("description", "Score Entertainment Frieza Saga Dragon Ball cards");
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
    const record3_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Score Entertainment'");
    if (!record3_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Score Entertainment'\""); }
    record3.set("brand_id", record3_brand_idLookup.id);
    record3.set("name", "Cell Saga");
    record3.set("description", "Score Entertainment Cell Saga Dragon Ball cards");
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
    const record4_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Score Entertainment'");
    if (!record4_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Score Entertainment'\""); }
    record4.set("brand_id", record4_brand_idLookup.id);
    record4.set("name", "Buu Saga");
    record4.set("description", "Score Entertainment Buu Saga Dragon Ball cards");
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
    const record5_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Score Entertainment'");
    if (!record5_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Score Entertainment'\""); }
    record5.set("brand_id", record5_brand_idLookup.id);
    record5.set("name", "GT Series");
    record5.set("description", "Score Entertainment GT Series Dragon Ball cards");
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
    const record6_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini'");
    if (!record6_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini'\""); }
    record6.set("brand_id", record6_brand_idLookup.id);
    record6.set("name", "Dragon Ball Stickers");
    record6.set("description", "Panini Dragon Ball Stickers");
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
    const record7_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini'");
    if (!record7_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini'\""); }
    record7.set("brand_id", record7_brand_idLookup.id);
    record7.set("name", "Dragon Ball Adrenalyn XL");
    record7.set("description", "Panini Dragon Ball Adrenalyn XL cards");
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
    const record8_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record8_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record8.set("brand_id", record8_brand_idLookup.id);
    record8.set("name", "Alpha");
    record8.set("description", "Magic: The Gathering Alpha set");
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
    const record9_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record9_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record9.set("brand_id", record9_brand_idLookup.id);
    record9.set("name", "Beta");
    record9.set("description", "Magic: The Gathering Beta set");
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
    const record10_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record10_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record10.set("brand_id", record10_brand_idLookup.id);
    record10.set("name", "Unlimited");
    record10.set("description", "Magic: The Gathering Unlimited set");
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
    const record11_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record11_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record11.set("brand_id", record11_brand_idLookup.id);
    record11.set("name", "Revised");
    record11.set("description", "Magic: The Gathering Revised set");
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
    const record12_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record12_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record12.set("brand_id", record12_brand_idLookup.id);
    record12.set("name", "Fourth Edition");
    record12.set("description", "Magic: The Gathering Fourth Edition set");
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
    const record13_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record13_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record13.set("brand_id", record13_brand_idLookup.id);
    record13.set("name", "Fifth Edition");
    record13.set("description", "Magic: The Gathering Fifth Edition set");
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
    const record14_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record14_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record14.set("brand_id", record14_brand_idLookup.id);
    record14.set("name", "Modern Horizons");
    record14.set("description", "Magic: The Gathering Modern Horizons set");
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
    const record15_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record15_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record15.set("brand_id", record15_brand_idLookup.id);
    record15.set("name", "Commander");
    record15.set("description", "Magic: The Gathering Commander set");
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
    const record16_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record16_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record16.set("brand_id", record16_brand_idLookup.id);
    record16.set("name", "Masters");
    record16.set("description", "Magic: The Gathering Masters set");
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
    const record17_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record17_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record17.set("brand_id", record17_brand_idLookup.id);
    record17.set("name", "Universes Beyond");
    record17.set("description", "Magic: The Gathering Universes Beyond set");
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
    const record18_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record18_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record18.set("brand_id", record18_brand_idLookup.id);
    record18.set("name", "Secret Lair");
    record18.set("description", "Magic: The Gathering Secret Lair set");
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
    const record19_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record19_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record19.set("brand_id", record19_brand_idLookup.id);
    record19.set("name", "Innistrad");
    record19.set("description", "Magic: The Gathering Innistrad set");
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
    const record20_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record20_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record20.set("brand_id", record20_brand_idLookup.id);
    record20.set("name", "Zendikar");
    record20.set("description", "Magic: The Gathering Zendikar set");
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
    const record21_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record21_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record21.set("brand_id", record21_brand_idLookup.id);
    record21.set("name", "Ravnica");
    record21.set("description", "Magic: The Gathering Ravnica set");
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
    const record22_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record22_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record22.set("brand_id", record22_brand_idLookup.id);
    record22.set("name", "Dominaria");
    record22.set("description", "Magic: The Gathering Dominaria set");
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
    const record23_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record23_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record23.set("brand_id", record23_brand_idLookup.id);
    record23.set("name", "Tarkir");
    record23.set("description", "Magic: The Gathering Tarkir set");
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
    const record24_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record24_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record24.set("brand_id", record24_brand_idLookup.id);
    record24.set("name", "Ixalan");
    record24.set("description", "Magic: The Gathering Ixalan set");
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
    const record25_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record25_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record25.set("brand_id", record25_brand_idLookup.id);
    record25.set("name", "Collector Boosters");
    record25.set("description", "Magic: The Gathering Collector Boosters");
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
    const record26_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record26_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record26.set("brand_id", record26_brand_idLookup.id);
    record26.set("name", "Serialized Cards");
    record26.set("description", "Magic: The Gathering Serialized Cards");
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
    const record27_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Wizards of the Coast'");
    if (!record27_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Wizards of the Coast'\""); }
    record27.set("brand_id", record27_brand_idLookup.id);
    record27.set("name", "Mythic Editions");
    record27.set("description", "Magic: The Gathering Mythic Editions");
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
    const record28_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record28_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record28.set("brand_id", record28_brand_idLookup.id);
    record28.set("name", "Legend of Blue Eyes");
    record28.set("description", "Konami Legend of Blue Eyes Yu-Gi-Oh! set");
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
    const record29_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record29_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record29.set("brand_id", record29_brand_idLookup.id);
    record29.set("name", "Metal Raiders");
    record29.set("description", "Konami Metal Raiders Yu-Gi-Oh! set");
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
    const record30_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record30_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record30.set("brand_id", record30_brand_idLookup.id);
    record30.set("name", "Spell Ruler");
    record30.set("description", "Konami Spell Ruler Yu-Gi-Oh! set");
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
    const record31_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record31_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record31.set("brand_id", record31_brand_idLookup.id);
    record31.set("name", "Pharaoh's Servant");
    record31.set("description", "Konami Pharaoh's Servant Yu-Gi-Oh! set");
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
    const record32_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record32_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record32.set("brand_id", record32_brand_idLookup.id);
    record32.set("name", "Duelist Nexus");
    record32.set("description", "Konami Duelist Nexus Yu-Gi-Oh! set");
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
    const record33_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record33_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record33.set("brand_id", record33_brand_idLookup.id);
    record33.set("name", "Rage of the Abyss");
    record33.set("description", "Konami Rage of the Abyss Yu-Gi-Oh! set");
  try {
    app.save(record33);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record34 = new Record(collection);
    const record34_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record34_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record34.set("brand_id", record34_brand_idLookup.id);
    record34.set("name", "Quarter Century Bonanza");
    record34.set("description", "Konami Quarter Century Bonanza Yu-Gi-Oh! set");
  try {
    app.save(record34);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record35 = new Record(collection);
    const record35_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record35_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record35.set("brand_id", record35_brand_idLookup.id);
    record35.set("name", "Battles of Legend");
    record35.set("description", "Konami Battles of Legend Yu-Gi-Oh! set");
  try {
    app.save(record35);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record36 = new Record(collection);
    const record36_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record36_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record36.set("brand_id", record36_brand_idLookup.id);
    record36.set("name", "Maze of Memories");
    record36.set("description", "Konami Maze of Memories Yu-Gi-Oh! set");
  try {
    app.save(record36);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record37 = new Record(collection);
    const record37_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record37_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record37.set("brand_id", record37_brand_idLookup.id);
    record37.set("name", "OTS Tournament Packs");
    record37.set("description", "Konami OTS Tournament Packs Yu-Gi-Oh!");
  try {
    app.save(record37);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record38 = new Record(collection);
    const record38_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record38_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record38.set("brand_id", record38_brand_idLookup.id);
    record38.set("name", "Ghost Rare");
    record38.set("description", "Konami Ghost Rare Yu-Gi-Oh! cards");
  try {
    app.save(record38);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record39 = new Record(collection);
    const record39_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record39_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record39.set("brand_id", record39_brand_idLookup.id);
    record39.set("name", "Starlight Rare");
    record39.set("description", "Konami Starlight Rare Yu-Gi-Oh! cards");
  try {
    app.save(record39);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record40 = new Record(collection);
    const record40_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record40_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record40.set("brand_id", record40_brand_idLookup.id);
    record40.set("name", "Collector Rare");
    record40.set("description", "Konami Collector Rare Yu-Gi-Oh! cards");
  try {
    app.save(record40);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record41 = new Record(collection);
    const record41_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record41_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record41.set("brand_id", record41_brand_idLookup.id);
    record41.set("name", "Ultimate Rare");
    record41.set("description", "Konami Ultimate Rare Yu-Gi-Oh! cards");
  try {
    app.save(record41);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record42 = new Record(collection);
    const record42_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Konami'");
    if (!record42_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Konami'\""); }
    record42.set("brand_id", record42_brand_idLookup.id);
    record42.set("name", "Quarter Century Secret Rare");
    record42.set("description", "Konami Quarter Century Secret Rare Yu-Gi-Oh! cards");
  try {
    app.save(record42);
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
