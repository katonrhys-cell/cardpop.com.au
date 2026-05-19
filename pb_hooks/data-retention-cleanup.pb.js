/// <reference path="../pb_data/types.d.ts" />
// Data retention policy: Clean up old records automatically
// This hook runs on any record operation and checks if cleanup is needed

// Helper function to delete old records
function cleanupOldRecords(collectionName, dateFieldName, daysOld) {
  try {
    const collection = $app.findCollectionByNameOrId(collectionName);
    if (!collection) return;
    
    // Calculate the cutoff date
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    // Build filter expression
    const filter = dateFieldName + ' < "' + cutoffDateStr + '"';
    
    // Get records to delete
    const records = $app.findRecordsByFilter(collectionName, filter, '-id', 1000);
    
    // Delete each record
    records.forEach(record => {
      try {
        $app.delete(record);
      } catch (err) {
        console.log('Failed to delete old record from ' + collectionName + ':', err);
      }
    });
    
    console.log('Cleaned up ' + records.length + ' old records from ' + collectionName);
  } catch (err) {
    console.log('Cleanup error for ' + collectionName + ':', err);
  }
}

// Run cleanup on any record create/update (approximately every operation)
// This ensures cleanup happens regularly without needing a separate cron job
onRecordCreate((e) => {
  // Clean up loginAttempts older than 30 days
  cleanupOldRecords('loginAttempts', 'created', 30);
  
  // Clean up passwordResetTokens older than 1 day
  cleanupOldRecords('passwordResetTokens', 'created', 1);
  
  // Clean up auditLogs older than 90 days
  cleanupOldRecords('auditLogs', 'created', 90);
  
  e.next();
}, 'users');

// Also run cleanup on other collections to ensure regular execution
onRecordCreate((e) => {
  cleanupOldRecords('loginAttempts', 'created', 30);
  cleanupOldRecords('passwordResetTokens', 'created', 1);
  cleanupOldRecords('auditLogs', 'created', 90);
  
  e.next();
}, 'messages');

onRecordCreate((e) => {
  cleanupOldRecords('loginAttempts', 'created', 30);
  cleanupOldRecords('passwordResetTokens', 'created', 1);
  cleanupOldRecords('auditLogs', 'created', 90);
  
  e.next();
}, 'cards');