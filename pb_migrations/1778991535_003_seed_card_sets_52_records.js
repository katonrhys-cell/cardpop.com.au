/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("card_sets");

  const record0 = new Record(collection);
    const record0_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record0_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record0.set("brand_id", record0_brand_idLookup.id);
    record0.set("name", "Base Set");
    record0.set("description", "The original Pok\u00e9mon Trading Card Game set");
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
    const record1_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record1_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record1.set("brand_id", record1_brand_idLookup.id);
    record1.set("name", "Jungle");
    record1.set("description", "Second Pok\u00e9mon TCG expansion");
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
    const record2_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record2_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record2.set("brand_id", record2_brand_idLookup.id);
    record2.set("name", "Fossil");
    record2.set("description", "Third Pok\u00e9mon TCG expansion");
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
    const record3_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record3_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record3.set("brand_id", record3_brand_idLookup.id);
    record3.set("name", "Team Rocket");
    record3.set("description", "Team Rocket Pok\u00e9mon TCG expansion");
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
    const record4_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record4_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record4.set("brand_id", record4_brand_idLookup.id);
    record4.set("name", "Gym Heroes");
    record4.set("description", "Gym Heroes Pok\u00e9mon TCG expansion");
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
    const record5_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record5_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record5.set("brand_id", record5_brand_idLookup.id);
    record5.set("name", "Neo Genesis");
    record5.set("description", "Neo Genesis Pok\u00e9mon TCG expansion");
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
    const record6_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record6_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record6.set("brand_id", record6_brand_idLookup.id);
    record6.set("name", "e-Reader");
    record6.set("description", "e-Reader Pok\u00e9mon TCG expansion");
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
    const record7_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record7_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record7.set("brand_id", record7_brand_idLookup.id);
    record7.set("name", "EX Series");
    record7.set("description", "EX Series Pok\u00e9mon TCG expansion");
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
    const record8_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record8_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record8.set("brand_id", record8_brand_idLookup.id);
    record8.set("name", "Diamond & Pearl");
    record8.set("description", "Diamond & Pearl Pok\u00e9mon TCG expansion");
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
    const record9_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record9_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record9.set("brand_id", record9_brand_idLookup.id);
    record9.set("name", "Platinum");
    record9.set("description", "Platinum Pok\u00e9mon TCG expansion");
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
    const record10_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record10_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record10.set("brand_id", record10_brand_idLookup.id);
    record10.set("name", "HeartGold SoulSilver");
    record10.set("description", "HeartGold SoulSilver Pok\u00e9mon TCG expansion");
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
    const record11_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record11_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record11.set("brand_id", record11_brand_idLookup.id);
    record11.set("name", "Black & White");
    record11.set("description", "Black & White Pok\u00e9mon TCG expansion");
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
    const record12_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record12_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record12.set("brand_id", record12_brand_idLookup.id);
    record12.set("name", "XY");
    record12.set("description", "XY Pok\u00e9mon TCG expansion");
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
    const record13_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record13_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record13.set("brand_id", record13_brand_idLookup.id);
    record13.set("name", "Sun & Moon");
    record13.set("description", "Sun & Moon Pok\u00e9mon TCG expansion");
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
    const record14_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record14_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record14.set("brand_id", record14_brand_idLookup.id);
    record14.set("name", "Sword & Shield");
    record14.set("description", "Sword & Shield Pok\u00e9mon TCG expansion");
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
    const record15_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record15_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record15.set("brand_id", record15_brand_idLookup.id);
    record15.set("name", "Scarlet & Violet");
    record15.set("description", "Scarlet & Violet Pok\u00e9mon TCG expansion");
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
    const record16_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record16_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record16.set("brand_id", record16_brand_idLookup.id);
    record16.set("name", "Shining Legends");
    record16.set("description", "Shining Legends Pok\u00e9mon TCG set");
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
    const record17_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record17_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record17.set("brand_id", record17_brand_idLookup.id);
    record17.set("name", "Hidden Fates");
    record17.set("description", "Hidden Fates Pok\u00e9mon TCG set");
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
    const record18_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record18_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record18.set("brand_id", record18_brand_idLookup.id);
    record18.set("name", "Champion's Path");
    record18.set("description", "Champion's Path Pok\u00e9mon TCG set");
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
    const record19_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record19_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record19.set("brand_id", record19_brand_idLookup.id);
    record19.set("name", "Celebrations");
    record19.set("description", "Celebrations Pok\u00e9mon TCG set");
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
    const record20_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record20_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record20.set("brand_id", record20_brand_idLookup.id);
    record20.set("name", "Crown Zenith");
    record20.set("description", "Crown Zenith Pok\u00e9mon TCG set");
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
    const record21_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record21_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record21.set("brand_id", record21_brand_idLookup.id);
    record21.set("name", "151");
    record21.set("description", "151 Pok\u00e9mon TCG set");
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
    const record22_brand_idLookup = app.findFirstRecordByFilter("brands", "name='The Pokémon Company International'");
    if (!record22_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='The Pokémon Company International'\""); }
    record22.set("brand_id", record22_brand_idLookup.id);
    record22.set("name", "Paldean Fates");
    record22.set("description", "Paldean Fates Pok\u00e9mon TCG set");
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
    const record23_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record23_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record23.set("brand_id", record23_brand_idLookup.id);
    record23.set("name", "Topps Pok\u00e9mon TV Animation Edition");
    record23.set("description", "Topps Pok\u00e9mon TV Animation Edition");
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
    const record24_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record24_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record24.set("brand_id", record24_brand_idLookup.id);
    record24.set("name", "Topps Chrome Pok\u00e9mon");
    record24.set("description", "Topps Chrome Pok\u00e9mon cards");
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
    const record25_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record25_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record25.set("brand_id", record25_brand_idLookup.id);
    record25.set("name", "Topps Johto");
    record25.set("description", "Topps Johto Pok\u00e9mon cards");
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
    record26.set("name", "Topps Advanced Challenge");
    record26.set("description", "Topps Advanced Challenge Pok\u00e9mon cards");
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
    record27.set("name", "Topps Movie Cards");
    record27.set("description", "Topps Pok\u00e9mon Movie Cards");
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
    const record28_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record28_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record28.set("brand_id", record28_brand_idLookup.id);
    record28.set("name", "Carddass");
    record28.set("description", "Bandai Carddass Pok\u00e9mon cards");
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
    const record29_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record29_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record29.set("brand_id", record29_brand_idLookup.id);
    record29.set("name", "Bandai Pocket Monsters");
    record29.set("description", "Bandai Pocket Monsters cards");
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
    const record30_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record30_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record30.set("brand_id", record30_brand_idLookup.id);
    record30.set("name", "Dragon Ball Super Card Game");
    record30.set("description", "Bandai Dragon Ball Super Card Game");
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
    const record31_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record31_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record31.set("brand_id", record31_brand_idLookup.id);
    record31.set("name", "Fusion World");
    record31.set("description", "Bandai Fusion World Dragon Ball cards");
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
    const record32_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record32_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record32.set("brand_id", record32_brand_idLookup.id);
    record32.set("name", "Bandai Carddass Dragon Ball");
    record32.set("description", "Bandai Carddass Dragon Ball cards");
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
    const record33_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record33_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record33.set("brand_id", record33_brand_idLookup.id);
    record33.set("name", "Super Battle");
    record33.set("description", "Bandai Super Battle Dragon Ball cards");
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
    const record34_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record34_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record34.set("brand_id", record34_brand_idLookup.id);
    record34.set("name", "Heroes");
    record34.set("description", "Bandai Heroes Dragon Ball cards");
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
    const record35_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record35_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record35.set("brand_id", record35_brand_idLookup.id);
    record35.set("name", "Data Carddass");
    record35.set("description", "Bandai Data Carddass Dragon Ball cards");
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
    const record36_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record36_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record36.set("brand_id", record36_brand_idLookup.id);
    record36.set("name", "Battle Spirits Crossover");
    record36.set("description", "Bandai Battle Spirits Crossover Dragon Ball cards");
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
    const record37_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record37_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record37.set("brand_id", record37_brand_idLookup.id);
    record37.set("name", "Digimon Card Game");
    record37.set("description", "Bandai Digimon Card Game");
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
    const record38_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record38_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record38.set("brand_id", record38_brand_idLookup.id);
    record38.set("name", "Hyper Colosseum");
    record38.set("description", "Bandai Hyper Colosseum Digimon cards");
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
    const record39_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record39_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record39.set("brand_id", record39_brand_idLookup.id);
    record39.set("name", "Digi-Battle");
    record39.set("description", "Bandai Digi-Battle Digimon cards");
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
    const record40_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record40_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record40.set("brand_id", record40_brand_idLookup.id);
    record40.set("name", "Classic Collection");
    record40.set("description", "Bandai Classic Collection Digimon cards");
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
    const record41_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record41_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record41.set("brand_id", record41_brand_idLookup.id);
    record41.set("name", "BT Series");
    record41.set("description", "Bandai BT Series Digimon cards");
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
    const record42_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record42_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record42.set("brand_id", record42_brand_idLookup.id);
    record42.set("name", "EX Series Digimon");
    record42.set("description", "Bandai EX Series Digimon cards");
  try {
    app.save(record42);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record43 = new Record(collection);
    const record43_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record43_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record43.set("brand_id", record43_brand_idLookup.id);
    record43.set("name", "Romance Dawn");
    record43.set("description", "Bandai Romance Dawn One Piece cards");
  try {
    app.save(record43);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record44 = new Record(collection);
    const record44_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record44_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record44.set("brand_id", record44_brand_idLookup.id);
    record44.set("name", "Paramount War");
    record44.set("description", "Bandai Paramount War One Piece cards");
  try {
    app.save(record44);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record45 = new Record(collection);
    const record45_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record45_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record45.set("brand_id", record45_brand_idLookup.id);
    record45.set("name", "Pillars of Strength");
    record45.set("description", "Bandai Pillars of Strength One Piece cards");
  try {
    app.save(record45);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record46 = new Record(collection);
    const record46_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record46_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record46.set("brand_id", record46_brand_idLookup.id);
    record46.set("name", "Kingdoms of Intrigue");
    record46.set("description", "Bandai Kingdoms of Intrigue One Piece cards");
  try {
    app.save(record46);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record47 = new Record(collection);
    const record47_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record47_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record47.set("brand_id", record47_brand_idLookup.id);
    record47.set("name", "Awakening of the New Era");
    record47.set("description", "Bandai Awakening of the New Era One Piece cards");
  try {
    app.save(record47);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record48 = new Record(collection);
    const record48_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record48_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record48.set("brand_id", record48_brand_idLookup.id);
    record48.set("name", "Wings of the Captain");
    record48.set("description", "Bandai Wings of the Captain One Piece cards");
  try {
    app.save(record48);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record49 = new Record(collection);
    const record49_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record49_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record49.set("brand_id", record49_brand_idLookup.id);
    record49.set("name", "Manga Rare");
    record49.set("description", "Bandai Manga Rare One Piece cards");
  try {
    app.save(record49);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record50 = new Record(collection);
    const record50_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record50_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record50.set("brand_id", record50_brand_idLookup.id);
    record50.set("name", "Treasure Rare");
    record50.set("description", "Bandai Treasure Rare One Piece cards");
  try {
    app.save(record50);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record51 = new Record(collection);
    const record51_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bandai'");
    if (!record51_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bandai'\""); }
    record51.set("brand_id", record51_brand_idLookup.id);
    record51.set("name", "SP Cards");
    record51.set("description", "Bandai SP Cards One Piece");
  try {
    app.save(record51);
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
