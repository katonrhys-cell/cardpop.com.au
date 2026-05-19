import Papa from 'papaparse';
import pb from '@/lib/pocketbaseClient.js';

export const parseCSVFile = async (fileUrlOrBlob) => {
  return new Promise(async (resolve, reject) => {
    try {
      let text;
      if (typeof fileUrlOrBlob === 'string') {
        const response = await fetch(fileUrlOrBlob);
        if (!response.ok) throw new Error('Failed to fetch CSV file');
        text = await response.text();
      } else {
        text = await fileUrlOrBlob.text();
      }

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            reject(new Error('Failed to parse CSV: ' + results.errors[0].message));
          } else {
            resolve(results);
          }
        },
        error: (error) => reject(error)
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const validateRow = (row, fieldMapping) => {
  const errors = [];
  
  // Check required fields (title, price)
  const titleCol = fieldMapping['title'];
  const priceCol = fieldMapping['price'];

  if (!titleCol || !row[titleCol]) {
    errors.push('Missing required field: title');
  }

  if (priceCol && row[priceCol]) {
    const price = parseFloat(row[priceCol]);
    if (isNaN(price) || price < 0) {
      errors.push('Price must be a valid positive number');
    }
  } else if (!priceCol || !row[priceCol]) {
    errors.push('Missing required field: price');
  }

  const qtyCol = fieldMapping['quantity'];
  if (qtyCol && row[qtyCol]) {
    const qty = parseInt(row[qtyCol], 10);
    if (isNaN(qty) || qty < 0) {
      errors.push('Quantity must be a valid positive integer');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const mapRowToListing = (row, fieldMapping, sellerId) => {
  const listing = {
    seller: sellerId,
    status: 'active' // Default status
  };

  Object.entries(fieldMapping).forEach(([listingField, csvColumn]) => {
    if (!csvColumn || !row[csvColumn]) return;

    let value = row[csvColumn];

    // Type conversions
    if (listingField === 'price') {
      value = parseFloat(value) || 0;
    } else if (listingField === 'quantity') {
      value = parseInt(value, 10) || 0;
    }

    listing[listingField] = value;
  });

  return listing;
};

export const importCSVData = async (csvFileRecord, parsedData, fieldMapping, sellerId, onProgress) => {
  const totalRecords = parsedData.data.length;
  let successfulRecords = 0;
  let failedRecords = 0;
  const errorDetails = [];

  for (let i = 0; i < totalRecords; i++) {
    const row = parsedData.data[i];
    const validation = validateRow(row, fieldMapping);

    if (!validation.isValid) {
      failedRecords++;
      errorDetails.push({ row: i + 1, data: row, errors: validation.errors });
    } else {
      try {
        const listingData = mapRowToListing(row, fieldMapping, sellerId);
        await pb.collection('listings').create(listingData, { $autoCancel: false });
        successfulRecords++;
      } catch (error) {
        failedRecords++;
        errorDetails.push({ 
          row: i + 1, 
          data: row, 
          errors: [error.response?.message || error.message || 'Database creation failed'] 
        });
      }
    }

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: totalRecords,
        successful: successfulRecords,
        failed: failedRecords,
        percentage: Math.round(((i + 1) / totalRecords) * 100)
      });
    }
  }

  const importStatus = failedRecords === 0 ? 'success' : (successfulRecords > 0 ? 'partial' : 'failed');

  // Save to importHistory
  try {
    await pb.collection('importHistory').create({
      csvFileName: csvFileRecord.filename || 'Unknown File',
      totalRecords,
      successfulRecords,
      failedRecords,
      importStatus,
      errorDetails,
      mappingUsed: fieldMapping,
      importedBy: sellerId
    }, { $autoCancel: false });
  } catch (historyError) {
    console.error('Failed to save import history:', historyError);
  }

  return {
    totalRecords,
    successfulRecords,
    failedRecords,
    importStatus,
    errorDetails
  };
};

export const getImportHistory = async (page = 1, perPage = 20) => {
  return await pb.collection('importHistory').getList(page, perPage, {
    sort: '-created',
    expand: 'importedBy',
    $autoCancel: false
  });
};