import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FOLDER = path.join(__dirname, '../../csvfiles');

// Collection field mappings
const COLLECTION_MAPPINGS = {
  products: {
    collection: 'products',
    requiredFields: ['name', 'price'],
    fieldMappings: {
      'product_name': 'name',
      'product_title': 'name',
      'title': 'name',
      'name': 'name',
      'price': 'price',
      'cost': 'price',
      'description': 'description',
      'category': 'category',
      'sku': 'sku',
      'stock': 'quantity',
      'quantity': 'quantity',
      'image': 'images',
      'images': 'images',
    },
  },
  marketplace: {
    collection: 'marketplace',
    requiredFields: ['title', 'price'],
    fieldMappings: {
      'listing_title': 'title',
      'title': 'title',
      'name': 'title',
      'price': 'price',
      'description': 'description',
      'category': 'category',
      'condition': 'condition',
      'seller': 'seller',
      'image': 'images',
      'images': 'images',
    },
  },
  markets: {
    collection: 'markets',
    requiredFields: ['name'],
    fieldMappings: {
      'market_name': 'name',
      'name': 'name',
      'market_type': 'type',
      'type': 'type',
      'location': 'location',
      'description': 'description',
      'url': 'url',
      'api_key': 'apiKey',
    },
  },
  grading: {
    collection: 'grading',
    requiredFields: ['cardName', 'grade'],
    fieldMappings: {
      'card_name': 'cardName',
      'cardname': 'cardName',
      'name': 'cardName',
      'grade': 'grade',
      'grading_company': 'gradingCompany',
      'company': 'gradingCompany',
      'cert_number': 'certNumber',
      'certification_number': 'certNumber',
      'grade_date': 'gradeDate',
      'date': 'gradeDate',
    },
  },
  community: {
    collection: 'community',
    requiredFields: ['title'],
    fieldMappings: {
      'post_title': 'title',
      'title': 'title',
      'content': 'content',
      'body': 'content',
      'author': 'author',
      'category': 'category',
      'tags': 'tags',
    },
  },
  blog: {
    collection: 'blog',
    requiredFields: ['title'],
    fieldMappings: {
      'post_title': 'title',
      'title': 'title',
      'content': 'content',
      'body': 'content',
      'author': 'author',
      'published_date': 'publishedDate',
      'date': 'publishedDate',
      'category': 'category',
      'tags': 'tags',
    },
  },
};

/**
 * Detect which collection a CSV belongs to based on filename
 * @param {string} filename - CSV filename
 * @returns {string|null} Collection name or null if not recognized
 */
function detectCollectionFromFilename(filename) {
  const lowerFilename = filename.toLowerCase();
  
  for (const [collectionName] of Object.entries(COLLECTION_MAPPINGS)) {
    if (lowerFilename.includes(collectionName)) {
      return collectionName;
    }
  }
  
  return null;
}

/**
 * Detect which collection a CSV belongs to based on column headers
 * @param {Array<string>} headers - CSV column headers
 * @returns {string|null} Collection name or null if not recognized
 */
function detectCollectionFromHeaders(headers) {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // Check each collection's field mappings
  for (const [collectionName, config] of Object.entries(COLLECTION_MAPPINGS)) {
    const mappingKeys = Object.keys(config.fieldMappings).map(k => k.toLowerCase());
    const matchCount = lowerHeaders.filter(h => mappingKeys.includes(h)).length;
    
    // If we have matches for at least 50% of the headers, it's likely this collection
    if (matchCount >= headers.length * 0.5) {
      return collectionName;
    }
  }
  
  return null;
}

/**
 * Map CSV columns to PocketBase collection fields
 * @param {Object} row - CSV row object
 * @param {string} collectionName - Target collection name
 * @returns {Object} Mapped record object
 */
function mapRowToRecord(row, collectionName) {
  const config = COLLECTION_MAPPINGS[collectionName];
  if (!config) {
    throw new Error(`Unknown collection: ${collectionName}`);
  }

  const record = {};
  const lowerRow = {};
  
  // Create lowercase version of row for case-insensitive matching
  for (const [key, value] of Object.entries(row)) {
    lowerRow[key.toLowerCase()] = { originalKey: key, value };
  }

  // Map fields using the collection's field mappings
  for (const [csvField, pbField] of Object.entries(config.fieldMappings)) {
    const lowerCsvField = csvField.toLowerCase();
    
    if (lowerRow[lowerCsvField]) {
      const value = lowerRow[lowerCsvField].value;
      
      // Handle array fields (images, tags)
      if ((pbField === 'images' || pbField === 'tags') && typeof value === 'string') {
        record[pbField] = value.split(',').map(v => v.trim()).filter(v => v);
      } else {
        record[pbField] = value;
      }
    }
  }

  return record;
}

/**
 * Validate a record against collection requirements
 * @param {Object} record - Record to validate
 * @param {string} collectionName - Collection name
 * @returns {Object} Validation result with isValid and errors
 */
function validateRecord(record, collectionName) {
  const config = COLLECTION_MAPPINGS[collectionName];
  const errors = [];

  // Check required fields
  for (const requiredField of config.requiredFields) {
    if (!record[requiredField] || (typeof record[requiredField] === 'string' && !record[requiredField].trim())) {
      errors.push(`Missing required field: ${requiredField}`);
    }
  }

  // Type validation
  if (record.price !== undefined && record.price !== null) {
    const price = parseFloat(record.price);
    if (isNaN(price) || price < 0) {
      errors.push(`Invalid price: ${record.price}`);
    }
  }

  if (record.quantity !== undefined && record.quantity !== null) {
    const quantity = parseInt(record.quantity, 10);
    if (isNaN(quantity) || quantity < 0) {
      errors.push(`Invalid quantity: ${record.quantity}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parse CSV file and return rows
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} Array of parsed rows
 */
function parseCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const rows = [];
    let headers = [];

    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Import CSV file into PocketBase
 * @param {string} filePath - Path to CSV file
 * @param {string} filename - CSV filename
 * @returns {Promise<Object>} Import result
 */
async function importCSVFile(filePath, filename) {
  logger.info(`[CSV_IMPORT] Processing file: ${filename}`);

  // Parse CSV file
  const rows = await parseCSVFile(filePath);
  
  if (rows.length === 0) {
    logger.warn(`[CSV_IMPORT] CSV file is empty: ${filename}`);
    return {
      filename,
      collection: null,
      imported: 0,
      failed: 0,
      errors: ['CSV file is empty'],
    };
  }

  // Get headers from first row
  const headers = Object.keys(rows[0]);
  logger.debug(`[CSV_IMPORT] CSV headers: ${headers.join(', ')}`);

  // Detect collection from filename first, then from headers
  let collectionName = detectCollectionFromFilename(filename);
  if (!collectionName) {
    collectionName = detectCollectionFromHeaders(headers);
  }

  if (!collectionName) {
    logger.warn(`[CSV_IMPORT] Could not detect collection for file: ${filename}`);
    return {
      filename,
      collection: null,
      imported: 0,
      failed: 0,
      errors: ['Could not detect target collection from filename or headers'],
    };
  }

  logger.info(`[CSV_IMPORT] Detected collection: ${collectionName}`);

  const result = {
    filename,
    collection: collectionName,
    imported: 0,
    failed: 0,
    errors: [],
  };

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because row 1 is headers, and we're 0-indexed

    try {
      // Skip empty rows
      if (Object.values(row).every(v => !v || (typeof v === 'string' && !v.trim()))) {
        logger.debug(`[CSV_IMPORT] Skipping empty row ${rowNumber}`);
        continue;
      }

      // Map row to record
      const record = mapRowToRecord(row, collectionName);
      logger.debug(`[CSV_IMPORT] Mapped row ${rowNumber}: ${JSON.stringify(record)}`);

      // Validate record
      const validation = validateRecord(record, collectionName);
      if (!validation.isValid) {
        logger.warn(`[CSV_IMPORT] Validation failed for row ${rowNumber}: ${validation.errors.join(', ')}`);
        result.failed += 1;
        result.errors.push({
          row: rowNumber,
          error: validation.errors.join(', '),
        });
        continue;
      }

      // Create record in PocketBase
      logger.debug(`[CSV_IMPORT] Creating record in ${collectionName} collection`);
      await pb.collection(collectionName).create(record);
      result.imported += 1;
      logger.info(`[CSV_IMPORT] Successfully imported row ${rowNumber} to ${collectionName}`);
    } catch (error) {
      logger.error(`[CSV_IMPORT] Error importing row ${rowNumber}: ${error.message}`);
      result.failed += 1;
      result.errors.push({
        row: rowNumber,
        error: error.message,
      });
    }
  }

  logger.info(`[CSV_IMPORT] File ${filename} completed: ${result.imported} imported, ${result.failed} failed`);
  return result;
}

/**
 * POST /csv/import
 * Import all CSV files from csvfiles folder
 */
router.post('/import', async (req, res) => {
  logger.info('[CSV_IMPORT] Starting CSV import process');

  // Check if csvfiles folder exists
  if (!fs.existsSync(CSV_FOLDER)) {
    logger.warn(`[CSV_IMPORT] CSV folder does not exist: ${CSV_FOLDER}`);
    throw new Error(`CSV folder not found: ${CSV_FOLDER}`);
  }

  // Read all CSV files from folder
  const files = fs.readdirSync(CSV_FOLDER);
  const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv'));

  if (csvFiles.length === 0) {
    logger.warn('[CSV_IMPORT] No CSV files found in csvfiles folder');
    return res.json({
      status: 'success',
      collections: {
        products: { imported: 0, failed: 0 },
        marketplace: { imported: 0, failed: 0 },
        markets: { imported: 0, failed: 0 },
        grading: { imported: 0, failed: 0 },
        community: { imported: 0, failed: 0 },
        blog: { imported: 0, failed: 0 },
      },
      errors: ['No CSV files found in csvfiles folder'],
    });
  }

  logger.info(`[CSV_IMPORT] Found ${csvFiles.length} CSV files to process`);

  // Initialize result structure
  const collections = {
    products: { imported: 0, failed: 0 },
    marketplace: { imported: 0, failed: 0 },
    markets: { imported: 0, failed: 0 },
    grading: { imported: 0, failed: 0 },
    community: { imported: 0, failed: 0 },
    blog: { imported: 0, failed: 0 },
  };
  const allErrors = [];

  // Process each CSV file
  for (const csvFile of csvFiles) {
    const filePath = path.join(CSV_FOLDER, csvFile);
    logger.info(`[CSV_IMPORT] Processing CSV file: ${csvFile}`);

    const fileResult = await importCSVFile(filePath, csvFile);

    // Aggregate results by collection
    if (fileResult.collection && collections[fileResult.collection]) {
      collections[fileResult.collection].imported += fileResult.imported;
      collections[fileResult.collection].failed += fileResult.failed;
    }

    // Collect errors
    if (fileResult.errors.length > 0) {
      allErrors.push({
        file: csvFile,
        collection: fileResult.collection,
        errors: fileResult.errors,
      });
    }
  }

  logger.info('[CSV_IMPORT] CSV import process completed');

  // Log import summary to audit logs
  const totalImported = Object.values(collections).reduce((sum, c) => sum + c.imported, 0);
  const totalFailed = Object.values(collections).reduce((sum, c) => sum + c.failed, 0);

  try {
    await pb.collection('auditLogs').create({
      eventType: 'csv_import',
      description: `CSV import completed: ${totalImported} records imported, ${totalFailed} failed`,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      status: totalFailed === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
    });
    logger.info('[CSV_IMPORT] Audit log created for CSV import');
  } catch (auditError) {
    logger.warn(`[CSV_IMPORT] Failed to create audit log: ${auditError.message}`);
  }

  res.json({
    status: 'success',
    collections,
    errors: allErrors.length > 0 ? allErrors : [],
  });
});

export default router;