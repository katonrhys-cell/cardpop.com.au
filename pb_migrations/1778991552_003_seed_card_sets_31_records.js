/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("card_sets");

  const record0 = new Record(collection);
    const record0_brand_idLookup = app.findFirstRecordByFilter("brands", "name='TeamCoach'");
    if (!record0_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='TeamCoach'\""); }
    record0.set("brand_id", record0_brand_idLookup.id);
    record0.set("name", "AFL TeamCoach");
    record0.set("description", "TeamCoach AFL cards");
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
    const record1_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record1_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record1.set("brand_id", record1_brand_idLookup.id);
    record1.set("name", "Prizm UFC");
    record1.set("description", "Panini America Prizm UFC cards");
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
    const record2_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record2_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record2.set("brand_id", record2_brand_idLookup.id);
    record2.set("name", "Select UFC");
    record2.set("description", "Panini America Select UFC cards");
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
    const record3_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record3_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record3.set("brand_id", record3_brand_idLookup.id);
    record3.set("name", "Chronicles UFC");
    record3.set("description", "Panini America Chronicles UFC cards");
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
    const record4_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Panini America'");
    if (!record4_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Panini America'\""); }
    record4.set("brand_id", record4_brand_idLookup.id);
    record4.set("name", "Donruss UFC");
    record4.set("description", "Panini America Donruss UFC cards");
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
    record5.set("name", "Chrome UFC");
    record5.set("description", "Topps Chrome UFC cards");
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
    record6.set("name", "Knockout");
    record6.set("description", "Topps Knockout UFC cards");
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
    record7.set("name", "Finest UFC");
    record7.set("description", "Topps Finest UFC cards");
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
    record8.set("name", "WWE Prizm");
    record8.set("description", "Panini America WWE Prizm wrestling cards");
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
    record9.set("name", "WWE Select");
    record9.set("description", "Panini America WWE Select wrestling cards");
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
    record10.set("name", "WWE Revolution");
    record10.set("description", "Panini America WWE Revolution wrestling cards");
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
    const record11_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record11_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record11.set("brand_id", record11_brand_idLookup.id);
    record11.set("name", "WWE Chrome");
    record11.set("description", "Topps WWE Chrome wrestling cards");
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
    const record12_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record12_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record12.set("brand_id", record12_brand_idLookup.id);
    record12.set("name", "WWE Finest");
    record12.set("description", "Topps WWE Finest wrestling cards");
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
    const record13_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record13_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record13.set("brand_id", record13_brand_idLookup.id);
    record13.set("name", "WWE Heritage");
    record13.set("description", "Topps WWE Heritage wrestling cards");
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
    const record14_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record14_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record14.set("brand_id", record14_brand_idLookup.id);
    record14.set("name", "Topps Chrome Tennis");
    record14.set("description", "Topps Chrome Tennis cards");
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
    const record15_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Topps'");
    if (!record15_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Topps'\""); }
    record15.set("brand_id", record15_brand_idLookup.id);
    record15.set("name", "Finest Tennis");
    record15.set("description", "Topps Finest Tennis cards");
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
    const record16_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ace Authentic'");
    if (!record16_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ace Authentic'\""); }
    record16.set("brand_id", record16_brand_idLookup.id);
    record16.set("name", "Grand Slam");
    record16.set("description", "Ace Authentic Grand Slam tennis cards");
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
    const record17_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Ace Authentic'");
    if (!record17_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Ace Authentic'\""); }
    record17.set("brand_id", record17_brand_idLookup.id);
    record17.set("name", "Serves Collection");
    record17.set("description", "Ace Authentic Serves Collection tennis cards");
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
    const record18_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Select Australia'");
    if (!record18_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Select Australia'\""); }
    record18.set("brand_id", record18_brand_idLookup.id);
    record18.set("name", "BBL");
    record18.set("description", "Select Australia BBL cricket cards");
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
    const record19_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Select Australia'");
    if (!record19_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Select Australia'\""); }
    record19.set("brand_id", record19_brand_idLookup.id);
    record19.set("name", "Test Series");
    record19.set("description", "Select Australia Test Series cricket cards");
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
    const record20_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Select Australia'");
    if (!record20_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Select Australia'\""); }
    record20.set("brand_id", record20_brand_idLookup.id);
    record20.set("name", "Australian Cricket Collection");
    record20.set("description", "Select Australia Australian Cricket Collection cards");
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
    const record21_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Tap N Play'");
    if (!record21_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Tap N Play'\""); }
    record21.set("brand_id", record21_brand_idLookup.id);
    record21.set("name", "Cricket Attax");
    record21.set("description", "Tap N Play Cricket Attax cards");
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
    const record22_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Tap N Play'");
    if (!record22_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Tap N Play'\""); }
    record22.set("brand_id", record22_brand_idLookup.id);
    record22.set("name", "Big Bash League Cards");
    record22.set("description", "Tap N Play Big Bash League Cards");
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
    const record23_brand_idLookup = app.findFirstRecordByFilter("brands", "name='TLA Merchandising'");
    if (!record23_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='TLA Merchandising'\""); }
    record23.set("brand_id", record23_brand_idLookup.id);
    record23.set("name", "Elite");
    record23.set("description", "TLA Merchandising Elite NRL cards");
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
    const record24_brand_idLookup = app.findFirstRecordByFilter("brands", "name='TLA Merchandising'");
    if (!record24_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='TLA Merchandising'\""); }
    record24.set("brand_id", record24_brand_idLookup.id);
    record24.set("name", "Premiership");
    record24.set("description", "TLA Merchandising Premiership NRL cards");
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
    const record25_brand_idLookup = app.findFirstRecordByFilter("brands", "name='TLA Merchandising'");
    if (!record25_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='TLA Merchandising'\""); }
    record25.set("brand_id", record25_brand_idLookup.id);
    record25.set("name", "Immortals");
    record25.set("description", "TLA Merchandising Immortals NRL cards");
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
    const record26_brand_idLookup = app.findFirstRecordByFilter("brands", "name='TLA Merchandising'");
    if (!record26_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='TLA Merchandising'\""); }
    record26.set("brand_id", record26_brand_idLookup.id);
    record26.set("name", "State of Origin");
    record26.set("description", "TLA Merchandising State of Origin NRL cards");
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
    const record27_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record27_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record27.set("brand_id", record27_brand_idLookup.id);
    record27.set("name", "SP Authentic Golf");
    record27.set("description", "Upper Deck SP Authentic Golf cards");
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
    const record28_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Upper Deck'");
    if (!record28_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Upper Deck'\""); }
    record28.set("brand_id", record28_brand_idLookup.id);
    record28.set("name", "Exquisite Golf");
    record28.set("description", "Upper Deck Exquisite Golf cards");
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
    const record29_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Leaf Trading Cards'");
    if (!record29_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Leaf Trading Cards'\""); }
    record29.set("brand_id", record29_brand_idLookup.id);
    record29.set("name", "Pro Set Golf");
    record29.set("description", "Leaf Trading Cards Pro Set Golf cards");
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
    const record30_brand_idLookup = app.findFirstRecordByFilter("brands", "name='Leaf Trading Cards'");
    if (!record30_brand_idLookup) { throw new Error("Lookup failed for brand_id: no record in 'brands' matching \"name='Leaf Trading Cards'\""); }
    record30.set("brand_id", record30_brand_idLookup.id);
    record30.set("name", "Signature Golf");
    record30.set("description", "Leaf Trading Cards Signature Golf cards");
  try {
    app.save(record30);
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
