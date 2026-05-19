/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("card_sets");

  const record0 = new Record(collection);
    const record0_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record0_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record0.set("brand_id", record0_brand_idLookup.id);
    record0.set("name", "Early English Yu-Gi-Oh!");
    record0.set("description", "Upper Deck Early English Yu-Gi-Oh! releases");
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
    const record1_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record1_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record1.set("brand_id", record1_brand_idLookup.id);
    record1.set("name", "Retro Packs");
    record1.set("description", "Upper Deck Retro Packs Yu-Gi-Oh!");
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
    const record2_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Riot Games'");
    if (!record2_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Riot Games'\""); }
    record2.set("brand_id", record2_brand_idLookup.id);
    record2.set("name", "Origins");
    record2.set("description", "Riot Games Riftbound Origins set");
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
    const record3_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Riot Games'");
    if (!record3_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Riot Games'\""); }
    record3.set("brand_id", record3_brand_idLookup.id);
    record3.set("name", "Champion Decks");
    record3.set("description", "Riot Games Riftbound Champion Decks");
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
    const record4_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Riot Games'");
    if (!record4_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Riot Games'\""); }
    record4.set("brand_id", record4_brand_idLookup.id);
    record4.set("name", "Arcane Tie-In Sets");
    record4.set("description", "Riot Games Riftbound Arcane Tie-In Sets");
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
    const record5_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record5_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record5.set("brand_id", record5_brand_idLookup.id);
    record5.set("name", "TMNT Movie Cards");
    record5.set("description", "Topps TMNT Movie Cards");
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
    const record6_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record6_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record6.set("brand_id", record6_brand_idLookup.id);
    record6.set("name", "TMNT Cartoon Cards");
    record6.set("description", "Topps TMNT Cartoon Cards");
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
    const record7_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record7_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record7.set("brand_id", record7_brand_idLookup.id);
    record7.set("name", "TMNT Stickers");
    record7.set("description", "Topps TMNT Stickers");
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
    const record8_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Cryptozoic Entertainment'");
    if (!record8_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Cryptozoic Entertainment'\""); }
    record8.set("brand_id", record8_brand_idLookup.id);
    record8.set("name", "TMNT Trading Cards");
    record8.set("description", "Cryptozoic Entertainment TMNT Trading Cards");
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
    const record9_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Cryptozoic Entertainment'");
    if (!record9_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Cryptozoic Entertainment'\""); }
    record9.set("brand_id", record9_brand_idLookup.id);
    record9.set("name", "TMNT Villains");
    record9.set("description", "Cryptozoic Entertainment TMNT Villains cards");
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
    const record10_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Cryptozoic Entertainment'");
    if (!record10_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Cryptozoic Entertainment'\""); }
    record10.set("brand_id", record10_brand_idLookup.id);
    record10.set("name", "Sketch Cards");
    record10.set("description", "Cryptozoic Entertainment Sketch Cards");
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
    const record11_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record11_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record11.set("brand_id", record11_brand_idLookup.id);
    record11.set("name", "Opus I");
    record11.set("description", "Square Enix Final Fantasy Opus I");
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
    const record12_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record12_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record12.set("brand_id", record12_brand_idLookup.id);
    record12.set("name", "Opus II");
    record12.set("description", "Square Enix Final Fantasy Opus II");
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
    const record13_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record13_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record13.set("brand_id", record13_brand_idLookup.id);
    record13.set("name", "Opus III");
    record13.set("description", "Square Enix Final Fantasy Opus III");
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
    const record14_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record14_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record14.set("brand_id", record14_brand_idLookup.id);
    record14.set("name", "Opus IV");
    record14.set("description", "Square Enix Final Fantasy Opus IV");
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
    const record15_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record15_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record15.set("brand_id", record15_brand_idLookup.id);
    record15.set("name", "Opus V");
    record15.set("description", "Square Enix Final Fantasy Opus V");
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
    const record16_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record16_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record16.set("brand_id", record16_brand_idLookup.id);
    record16.set("name", "Opus VI");
    record16.set("description", "Square Enix Final Fantasy Opus VI");
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
    const record17_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record17_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record17.set("brand_id", record17_brand_idLookup.id);
    record17.set("name", "Opus VII");
    record17.set("description", "Square Enix Final Fantasy Opus VII");
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
    const record18_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record18_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record18.set("brand_id", record18_brand_idLookup.id);
    record18.set("name", "Opus VIII");
    record18.set("description", "Square Enix Final Fantasy Opus VIII");
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
    const record19_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record19_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record19.set("brand_id", record19_brand_idLookup.id);
    record19.set("name", "Opus IX");
    record19.set("description", "Square Enix Final Fantasy Opus IX");
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
    const record20_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record20_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record20.set("brand_id", record20_brand_idLookup.id);
    record20.set("name", "Opus X");
    record20.set("description", "Square Enix Final Fantasy Opus X");
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
    const record21_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record21_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record21.set("brand_id", record21_brand_idLookup.id);
    record21.set("name", "Opus XI");
    record21.set("description", "Square Enix Final Fantasy Opus XI");
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
    const record22_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record22_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record22.set("brand_id", record22_brand_idLookup.id);
    record22.set("name", "Opus XII");
    record22.set("description", "Square Enix Final Fantasy Opus XII");
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
    const record23_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record23_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record23.set("brand_id", record23_brand_idLookup.id);
    record23.set("name", "Opus XIII");
    record23.set("description", "Square Enix Final Fantasy Opus XIII");
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
    const record24_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record24_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record24.set("brand_id", record24_brand_idLookup.id);
    record24.set("name", "Opus XIV");
    record24.set("description", "Square Enix Final Fantasy Opus XIV");
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
    const record25_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record25_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record25.set("brand_id", record25_brand_idLookup.id);
    record25.set("name", "Opus XV");
    record25.set("description", "Square Enix Final Fantasy Opus XV");
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
    const record26_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record26_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record26.set("brand_id", record26_brand_idLookup.id);
    record26.set("name", "Opus XVI");
    record26.set("description", "Square Enix Final Fantasy Opus XVI");
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
    const record27_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record27_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record27.set("brand_id", record27_brand_idLookup.id);
    record27.set("name", "Opus XVII");
    record27.set("description", "Square Enix Final Fantasy Opus XVII");
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
    const record28_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record28_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record28.set("brand_id", record28_brand_idLookup.id);
    record28.set("name", "Opus XVIII");
    record28.set("description", "Square Enix Final Fantasy Opus XVIII");
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
    const record29_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record29_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record29.set("brand_id", record29_brand_idLookup.id);
    record29.set("name", "Opus XIX");
    record29.set("description", "Square Enix Final Fantasy Opus XIX");
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
    const record30_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record30_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record30.set("brand_id", record30_brand_idLookup.id);
    record30.set("name", "Opus XX");
    record30.set("description", "Square Enix Final Fantasy Opus XX");
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
    const record31_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record31_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record31.set("brand_id", record31_brand_idLookup.id);
    record31.set("name", "Opus XXI");
    record31.set("description", "Square Enix Final Fantasy Opus XXI");
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
    const record32_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record32_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record32.set("brand_id", record32_brand_idLookup.id);
    record32.set("name", "Opus XXII");
    record32.set("description", "Square Enix Final Fantasy Opus XXII");
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
    const record33_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record33_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record33.set("brand_id", record33_brand_idLookup.id);
    record33.set("name", "Opus XXIII");
    record33.set("description", "Square Enix Final Fantasy Opus XXIII");
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
    const record34_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record34_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record34.set("brand_id", record34_brand_idLookup.id);
    record34.set("name", "Opus XXIV");
    record34.set("description", "Square Enix Final Fantasy Opus XXIV");
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
    const record35_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record35_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record35.set("brand_id", record35_brand_idLookup.id);
    record35.set("name", "Opus XXV");
    record35.set("description", "Square Enix Final Fantasy Opus XXV");
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
    const record36_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record36_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record36.set("brand_id", record36_brand_idLookup.id);
    record36.set("name", "Anniversary Collection");
    record36.set("description", "Square Enix Final Fantasy Anniversary Collection");
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
    const record37_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record37_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record37.set("brand_id", record37_brand_idLookup.id);
    record37.set("name", "Crystal Dominion");
    record37.set("description", "Square Enix Final Fantasy Crystal Dominion");
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
    const record38_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record38_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record38.set("brand_id", record38_brand_idLookup.id);
    record38.set("name", "Boss Decks");
    record38.set("description", "Square Enix Final Fantasy Boss Decks");
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
    const record39_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Square Enix'");
    if (!record39_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Square Enix'\""); }
    record39.set("brand_id", record39_brand_idLookup.id);
    record39.set("name", "Legacy Collection");
    record39.set("description", "Square Enix Final Fantasy Legacy Collection");
  try {
    app.save(record39);
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
