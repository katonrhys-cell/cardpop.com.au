/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  const role = e.record.get("role");
  
  // If role is not set or is empty, default to 'user'
  if (!role || role === "") {
    e.record.set("role", "user");
  }
  
  e.next();
}, "users");