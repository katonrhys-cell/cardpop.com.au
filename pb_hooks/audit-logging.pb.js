/// <reference path="../pb_data/types.d.ts" />
// Log login events
onRecordAuthRequest((e) => {
  const record = e.record;
  const requestInfo = e.requestInfo;
  
  try {
    const auditLog = new Record($app.findCollectionByNameOrId('auditLogs'));
    auditLog.set('userId', record.id);
    auditLog.set('eventType', 'login');
    auditLog.set('ipAddress', requestInfo.headers.get('x-forwarded-for') || requestInfo.remoteIP);
    auditLog.set('deviceInfo', requestInfo.headers.get('user-agent') || 'Unknown');
    auditLog.set('status', 'success');
    
    $app.save(auditLog);
  } catch (err) {
    console.log('Failed to log login event:', err);
  }
  
  e.next();
}, 'users');

// Log password changes
onRecordUpdate((e) => {
  const original = e.record.original();
  const currentPassword = e.record.get('password');
  const originalPassword = original.get('password');
  
  // Check if password was changed (password field will be different)
  if (currentPassword && originalPassword && currentPassword !== originalPassword) {
    try {
      const auditLog = new Record($app.findCollectionByNameOrId('auditLogs'));
      auditLog.set('userId', e.record.id);
      auditLog.set('eventType', 'password_change');
      auditLog.set('status', 'success');
      
      $app.save(auditLog);
    } catch (err) {
      console.log('Failed to log password change:', err);
    }
  }
  
  // Log MFA changes
  const mfaEnabled = e.record.get('mfaEnabled');
  const originalMfaEnabled = original.get('mfaEnabled');
  
  if (mfaEnabled !== originalMfaEnabled) {
    try {
      const auditLog = new Record($app.findCollectionByNameOrId('auditLogs'));
      auditLog.set('userId', e.record.id);
      auditLog.set('eventType', mfaEnabled ? 'mfa_enabled' : 'mfa_disabled');
      auditLog.set('status', 'success');
      
      $app.save(auditLog);
    } catch (err) {
      console.log('Failed to log MFA change:', err);
    }
  }
  
  // Log profile updates
  const profileFields = ['name', 'bio', 'location', 'avatar'];
  let profileChanged = false;
  
  profileFields.forEach(field => {
    if (e.record.get(field) !== original.get(field)) {
      profileChanged = true;
    }
  });
  
  if (profileChanged) {
    try {
      const auditLog = new Record($app.findCollectionByNameOrId('auditLogs'));
      auditLog.set('userId', e.record.id);
      auditLog.set('eventType', 'profile_updated');
      auditLog.set('status', 'success');
      
      $app.save(auditLog);
    } catch (err) {
      console.log('Failed to log profile update:', err);
    }
  }
  
  e.next();
}, 'users');

// Log failed login attempts
onRecordCreateRequest((e) => {
  // This hook fires on login attempts
  // Note: Failed attempts are typically handled by PocketBase internally
  // This is a placeholder for custom failed login tracking
  e.next();
}, 'users');

// Log data export requests
onRecordUpdate((e) => {
  const dataExportRequested = e.record.get('dataExportRequested');
  const originalDataExportRequested = e.record.original().get('dataExportRequested');
  
  if (dataExportRequested && !originalDataExportRequested) {
    try {
      const auditLog = new Record($app.findCollectionByNameOrId('auditLogs'));
      auditLog.set('userId', e.record.id);
      auditLog.set('eventType', 'profile_updated');
      auditLog.set('status', 'success');
      auditLog.set('details', { action: 'data_export_requested' });
      
      $app.save(auditLog);
    } catch (err) {
      console.log('Failed to log data export request:', err);
    }
  }
  
  e.next();
}, 'users');

// Log data deletion requests
onRecordUpdate((e) => {
  const dataDeleteRequested = e.record.get('dataDeleteRequested');
  const originalDataDeleteRequested = e.record.original().get('dataDeleteRequested');
  
  if (dataDeleteRequested && !originalDataDeleteRequested) {
    try {
      const auditLog = new Record($app.findCollectionByNameOrId('auditLogs'));
      auditLog.set('userId', e.record.id);
      auditLog.set('eventType', 'profile_updated');
      auditLog.set('status', 'success');
      auditLog.set('details', { action: 'data_deletion_requested' });
      
      $app.save(auditLog);
    } catch (err) {
      console.log('Failed to log data deletion request:', err);
    }
  }
  
  e.next();
}, 'users');