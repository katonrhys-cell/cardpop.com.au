/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("card_sets");

  const record0 = new Record(collection);
    const record0_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Fleer'");
    if (!record0_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Fleer'\""); }
    record0.set("brand_id", record0_brand_idLookup.id);
    record0.set("name", "Fleer Ultra");
    record0.set("description", "Fleer Ultra Basketball cards");
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
    const record1_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Fleer'");
    if (!record1_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Fleer'\""); }
    record1.set("brand_id", record1_brand_idLookup.id);
    record1.set("name", "Fleer Tradition");
    record1.set("description", "Fleer Tradition Basketball cards");
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
    const record2_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Fleer'");
    if (!record2_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Fleer'\""); }
    record2.set("brand_id", record2_brand_idLookup.id);
    record2.set("name", "Metal Universe");
    record2.set("description", "Fleer Metal Universe Basketball cards");
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
    const record3_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Fleer'");
    if (!record3_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Fleer'\""); }
    record3.set("brand_id", record3_brand_idLookup.id);
    record3.set("name", "Flair Showcase");
    record3.set("description", "Fleer Flair Showcase Basketball cards");
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
    const record4_brand_idLookup = app.findFirstRecordByFilter("brands", "name='SkyBox'");
    if (!record4_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='SkyBox'\""); }
    record4.set("brand_id", record4_brand_idLookup.id);
    record4.set("name", "E-X2000");
    record4.set("description", "SkyBox E-X2000 Basketball cards");
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
    const record5_brand_idLookup = app.findFirstRecordByFilter("brands", "name='SkyBox'");
    if (!record5_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='SkyBox'\""); }
    record5.set("brand_id", record5_brand_idLookup.id);
    record5.set("name", "Premium");
    record5.set("description", "SkyBox Premium Basketball cards");
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
    const record6_brand_idLookup = app.findFirstRecordByFilter("brands", "name='SkyBox'");
    if (!record6_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='SkyBox'\""); }
    record6.set("brand_id", record6_brand_idLookup.id);
    record6.set("name", "Z-Force");
    record6.set("description", "SkyBox Z-Force Basketball cards");
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
    const record7_brand_idLookup = app.findFirstRecordByFilter("brands", "name='SkyBox'");
    if (!record7_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='SkyBox'\""); }
    record7.set("brand_id", record7_brand_idLookup.id);
    record7.set("name", "Thunder");
    record7.set("description", "SkyBox Thunder Basketball cards");
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
    const record8_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Cherry Collectables'");
    if (!record8_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Cherry Collectables'\""); }
    record8.set("brand_id", record8_brand_idLookup.id);
    record8.set("name", "NBL Hoops");
    record8.set("description", "Cherry Collectables NBL Hoops cards");
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
    const record9_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Cherry Collectables'");
    if (!record9_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Cherry Collectables'\""); }
    record9.set("brand_id", record9_brand_idLookup.id);
    record9.set("name", "NBL Champions");
    record9.set("description", "Cherry Collectables NBL Champions cards");
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
    const record10_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Cherry Collectables'");
    if (!record10_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Cherry Collectables'\""); }
    record10.set("brand_id", record10_brand_idLookup.id);
    record10.set("name", "Authentic Signatures");
    record10.set("description", "Cherry Collectables Authentic Signatures NBL cards");
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
    const record11_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Select Australia'");
    if (!record11_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Select Australia'\""); }
    record11.set("brand_id", record11_brand_idLookup.id);
    record11.set("name", "Legends");
    record11.set("description", "Select Australia Legends Basketball cards");
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
    const record12_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Select Australia'");
    if (!record12_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Select Australia'\""); }
    record12.set("brand_id", record12_brand_idLookup.id);
    record12.set("name", "Throwbacks");
    record12.set("description", "Select Australia Throwbacks Basketball cards");
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
    const record13_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record13_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record13.set("brand_id", record13_brand_idLookup.id);
    record13.set("name", "Series 1");
    record13.set("description", "Upper Deck Series 1 Hockey cards");
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
    const record14_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record14_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record14.set("brand_id", record14_brand_idLookup.id);
    record14.set("name", "Series 2");
    record14.set("description", "Upper Deck Series 2 Hockey cards");
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
    const record15_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record15_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record15.set("brand_id", record15_brand_idLookup.id);
    record15.set("name", "Extended Series");
    record15.set("description", "Upper Deck Extended Series Hockey cards");
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
    const record16_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record16_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record16.set("brand_id", record16_brand_idLookup.id);
    record16.set("name", "SP Authentic Hockey");
    record16.set("description", "Upper Deck SP Authentic Hockey cards");
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
    const record17_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record17_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record17.set("brand_id", record17_brand_idLookup.id);
    record17.set("name", "Ice");
    record17.set("description", "Upper Deck Ice Hockey cards");
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
    const record18_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record18_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record18.set("brand_id", record18_brand_idLookup.id);
    record18.set("name", "Trilogy");
    record18.set("description", "Upper Deck Trilogy Hockey cards");
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
    const record19_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record19_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record19.set("brand_id", record19_brand_idLookup.id);
    record19.set("name", "The Cup");
    record19.set("description", "Upper Deck The Cup Hockey cards");
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
    const record20_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record20_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record20.set("brand_id", record20_brand_idLookup.id);
    record20.set("name", "Black Diamond");
    record20.set("description", "Upper Deck Black Diamond Hockey cards");
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
    const record21_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record21_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record21.set("brand_id", record21_brand_idLookup.id);
    record21.set("name", "Ultimate Collection Hockey");
    record21.set("description", "Upper Deck Ultimate Collection Hockey cards");
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
    const record22_brand_idLookup = app.findFirstRecordByFilter("brands", "name='O-Pee-Chee'");
    if (!record22_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='O-Pee-Chee'\""); }
    record22.set("brand_id", record22_brand_idLookup.id);
    record22.set("name", "O-Pee-Chee Platinum");
    record22.set("description", "O-Pee-Chee Platinum Hockey cards");
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
    const record23_brand_idLookup = app.findFirstRecordByFilter("brands", "name='O-Pee-Chee'");
    if (!record23_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='O-Pee-Chee'\""); }
    record23.set("brand_id", record23_brand_idLookup.id);
    record23.set("name", "OPC Retro");
    record23.set("description", "O-Pee-Chee OPC Retro Hockey cards");
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
    record24.set("name", "Topps Series 1");
    record24.set("description", "Topps Series 1 Baseball cards");
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
    record25.set("name", "Topps Series 2");
    record25.set("description", "Topps Series 2 Baseball cards");
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
    record26.set("name", "Topps Chrome Baseball");
    record26.set("description", "Topps Chrome Baseball cards");
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
    record27.set("name", "Stadium Club Baseball");
    record27.set("description", "Topps Stadium Club Baseball cards");
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
    record28.set("name", "Allen & Ginter");
    record28.set("description", "Topps Allen & Ginter Baseball cards");
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
    record29.set("name", "Topps Finest Baseball");
    record29.set("description", "Topps Finest Baseball cards");
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
    const record30_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record30_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record30.set("brand_id", record30_brand_idLookup.id);
    record30.set("name", "Heritage");
    record30.set("description", "Topps Heritage Baseball cards");
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
    const record31_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record31_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record31.set("brand_id", record31_brand_idLookup.id);
    record31.set("name", "Archives");
    record31.set("description", "Topps Archives Baseball cards");
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
    const record32_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bowman'");
    if (!record32_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bowman'\""); }
    record32.set("brand_id", record32_brand_idLookup.id);
    record32.set("name", "Bowman Chrome");
    record32.set("description", "Bowman Chrome Baseball cards");
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
    const record33_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bowman'");
    if (!record33_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bowman'\""); }
    record33.set("brand_id", record33_brand_idLookup.id);
    record33.set("name", "Bowman Draft");
    record33.set("description", "Bowman Draft Baseball cards");
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
    const record34_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bowman'");
    if (!record34_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bowman'\""); }
    record34.set("brand_id", record34_brand_idLookup.id);
    record34.set("name", "Bowman Sterling");
    record34.set("description", "Bowman Sterling Baseball cards");
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
    const record35_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Bowman'");
    if (!record35_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Bowman'\""); }
    record35.set("brand_id", record35_brand_idLookup.id);
    record35.set("name", "Bowman Sapphire");
    record35.set("description", "Bowman Sapphire Baseball cards");
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
    const record36_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record36_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record36.set("brand_id", record36_brand_idLookup.id);
    record36.set("name", "Prizm Baseball");
    record36.set("description", "Panini America Prizm Baseball cards");
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
    const record37_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record37_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record37.set("brand_id", record37_brand_idLookup.id);
    record37.set("name", "Donruss Baseball");
    record37.set("description", "Panini America Donruss Baseball cards");
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
    const record38_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record38_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record38.set("brand_id", record38_brand_idLookup.id);
    record38.set("name", "Select Baseball");
    record38.set("description", "Panini America Select Baseball cards");
  try {
    app.save(record38);
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
