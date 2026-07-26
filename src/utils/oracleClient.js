import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import oracledb from 'oracledb';
import AdmZip from 'adm-zip';
import logger from './logger.js';

// node-oracledb runs in "Thin" mode by default (pure JS, no Instant Client
// binaries) — that's the only mode that works inside a Vercel serverless
// function, where there's no way to bundle/install native Oracle Client libs.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// /tmp is the only writable path in a Vercel function. It's wiped on cold
// start but persists across warm invocations of the same container, so the
// wallet is only re-extracted once per container lifetime.
const WALLET_DIR = path.join(os.tmpdir(), 'oracle-wallet');

let poolPromise = null;

function isOracleConfigured() {
  return Boolean(
    process.env.ORACLE_DB_USER &&
    process.env.ORACLE_DB_PASSWORD &&
    process.env.ORACLE_DB_CONNECT_STRING &&
    process.env.ORACLE_WALLET_ZIP_B64
  );
}

// Extracts the Autonomous DB wallet zip (downloaded from the OCI console,
// base64-encoded into ORACLE_WALLET_ZIP_B64) into WALLET_DIR. See
// docs/oracle-catalogue.md for how the env var is prepared.
function ensureWalletExtracted() {
  if (fs.existsSync(path.join(WALLET_DIR, 'tnsnames.ora'))) return;

  fs.mkdirSync(WALLET_DIR, { recursive: true });
  const zip = new AdmZip(Buffer.from(process.env.ORACLE_WALLET_ZIP_B64, 'base64'));
  zip.extractAllTo(WALLET_DIR, true);
}

async function getPool() {
  if (!isOracleConfigured()) {
    throw new Error('Oracle catalogue is not configured (missing ORACLE_DB_* env vars)');
  }

  if (!poolPromise) {
    ensureWalletExtracted();
    poolPromise = oracledb.createPool({
      user: process.env.ORACLE_DB_USER,
      password: process.env.ORACLE_DB_PASSWORD,
      // TNS alias from the wallet's tnsnames.ora, e.g. "<db>_medium".
      connectString: process.env.ORACLE_DB_CONNECT_STRING,
      configDir: WALLET_DIR,
      walletLocation: WALLET_DIR,
      // Only the password-protected (PKCS12) wallet needs this — the default
      // auto-login wallet (cwallet.sso) connects without one.
      ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
      poolMin: 0,
      poolMax: 2, // one serverless container serves one request at a time — keep this small
      poolIncrement: 1,
      poolTimeout: 60,
    }).catch((err) => {
      poolPromise = null; // don't cache a failed pool — let the next call retry
      throw err;
    });
  }

  return poolPromise;
}

// Runs a single SQL statement against the Oracle catalogue and returns its rows.
async function queryOracle(sql, binds = {}) {
  const pool = await getPool();
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds);
    return result.rows ?? [];
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        logger.warn(`[ORACLE] connection close failed: ${err.message}`);
      }
    }
  }
}

export { queryOracle, isOracleConfigured };
