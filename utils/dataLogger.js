/**
 * Utility for logging data operations to help track data integrity and persistence issues.
 */
export const dataLogger = {
  logOperation: (operation, collection, data, result = null) => {
    const timestamp = new Date().toISOString();
    console.group(`[DataLogger] ${operation.toUpperCase()} - ${collection} @ ${timestamp}`);
    console.log('Payload/Query:', data);
    if (result) {
      console.log('Result:', result);
    }
    console.groupEnd();
  },

  logError: (operation, collection, error, data = null) => {
    const timestamp = new Date().toISOString();
    console.group(`[DataLogger] ERROR: ${operation.toUpperCase()} - ${collection} @ ${timestamp}`);
    if (data) console.log('Attempted Payload/Query:', data);
    console.error('Error Details:', error);
    console.groupEnd();
  },

  logMissingData: (component, expectedFields, actualData) => {
    const timestamp = new Date().toISOString();
    const missing = expectedFields.filter(field => 
      actualData[field] === undefined || actualData[field] === null || actualData[field] === ''
    );
    
    if (missing.length > 0) {
      console.warn(`[DataLogger] MISSING DATA in ${component} @ ${timestamp}`);
      console.warn('Missing Fields:', missing);
      console.warn('Actual Data Object:', actualData);
    }
    return missing;
  }
};