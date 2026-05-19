/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  // Auto-populate uploadedBy with the current authenticated user's ID
  if (e.auth && e.auth.id) {
    e.record.set("uploadedBy", e.auth.id);
  }
  e.next();
}, "csvFiles");