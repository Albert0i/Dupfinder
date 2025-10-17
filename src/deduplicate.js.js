// deduplicate.js
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DB_PATH = './images.db';
const BATCH_SIZE = 100;
let batch = [];
let duplicateCount = 0;
let replicas = [];

// 🧼 Delete previous database
if (fsSync.existsSync(DB_PATH)) {
  fsSync.unlinkSync(DB_PATH);
  console.log('🧼 Previous database removed. Starting fresh.');
}

// 🧭 Get folder from command-line argument
const ROOT_FOLDER = process.argv[2];
if (!ROOT_FOLDER) {
  console.error('❌ Please provide a folder path as input.\nUsage: node deduplicate.js <folder_path>');
  process.exit(1);
}

async function isHidden(filePath) {
  try {
    const stats = await fs.lstat(filePath);
    const name = path.basename(filePath);
    return name.startsWith('.') || (stats.mode & 0o100000 && name.startsWith('$'));
  } catch {
    return false;
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function* walk(dir) {
  try {
    const dirHandle = await fs.opendir(dir);
    for await (const entry of dirHandle) {
      const fullPath = path.join(dir, entry.name);
      if (await isHidden(fullPath)) continue;
      try {
        const stat = await fs.lstat(fullPath);
        if (stat.isDirectory()) {
          yield* walk(fullPath);
        } else if (stat.isFile()) {
          yield fullPath;
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.warn(`🚫 Skipped protected folder: ${dir}`);
    } else {
      console.error(`⚠️ Error accessing ${dir}:`, err.message);
    }
  }
}

async function flushBatch(db, insertStmt) {
  if (batch.length === 0) return;
  try {
    await db.exec('BEGIN TRANSACTION');
    for (const item of batch) {
      try {
        await insertStmt.run(item.path, item.size, item.created, item.hash);
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          console.log(`⚠️ Skipped duplicate insert for: ${item.path}`);
        } else {
          throw err;
        }
      }
    }
    await db.exec('COMMIT');
    batch = [];
  } catch (err) {
    console.error('⚠️ Error during flushBatch:', err.message);
  }
}

async function processFile(filePath, db, insertStmt) {
  try {
    const stat = await fs.stat(filePath);
    const hash = await hashFile(filePath);
    const created = stat.birthtime.toISOString();
    const size = stat.size;

    const existing = await db.get('SELECT * FROM files WHERE hash = ?', hash);
    if (existing && existing.path !== filePath) {
      console.log(`🧹 Duplicate found: ${filePath} ↔ ${existing.path}`);
      replicas.push({ replica: filePath, original: existing.path });
      duplicateCount++;
      return;
    }

    batch.push({ path: filePath, size, created, hash });
    if (batch.length >= BATCH_SIZE) {
      await flushBatch(db, insertStmt);
    }
  } catch (err) {
    console.error(`⚠️ Error processing ${filePath}:`, err.message);
  }
}

async function main() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    path TEXT,
    size INTEGER,
    created TEXT,
    hash TEXT UNIQUE
  )`);

  const insertStmt = await db.prepare(`INSERT INTO files (path, size, created, hash) VALUES (?, ?, ?, ?)`);

  for await (const filePath of walk(ROOT_FOLDER)) {
    await processFile(filePath, db, insertStmt);
  }

  await flushBatch(db, insertStmt);
  await insertStmt.finalize();
  await db.close();

  console.log(`✅ Deduplication complete. Total duplicates found: ${duplicateCount}`);

  if (replicas.length > 0) {
    console.log('\n🧾 Replica Map:');
    for (const pair of replicas) {
      console.log(`- ${pair.replica} → ${pair.original}`);
    }
  }
}

main();

/*
   node src/deduplicate.js "D:\RU\RUImages"

   npm run scan -- d:\
   npm run scan -- D:\RU\RUImages
*/