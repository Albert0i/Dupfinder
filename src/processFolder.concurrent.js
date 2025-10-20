/*
   processFolder.concurrent.js 
*/
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { hashFile, walk, SQL_create_table, SQL_insert, SQL_update, writeAudit } from './utils.js'

const DB_PATH = process.env.DB_PATH || './data/db.sq3';
const BATCH_SIZE = process.env.BATCH_SIZE || 1000;
// Optimal configuration: MAX_WORKERS = 8
// Elapsed: 430.45s, Difference: 0
const MAX_WORKERS = 8; 

const queue = [];                   // Task queue for pending files
let enqueuedCount = 0;              // Number of files queued
const enqueuedPaths = new Set();    // Paths queued for processing

let batch = [];                     // Pending records
let processedCount = 0;             // Files processed
let skippedCount = 0;               // Files skipped
const startTime = Date.now();       // Scan start time

const processingPromises = [];      // Active file processing tasks
const processedPaths = new Set();   // Paths already processed
let flushLock = Promise.resolve();  // Lock to serialize DB flushes

// 🧭 Get folder path from command-line argument
const args = process.argv.slice(2);

// 🆘 Help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npm run concurrent -- [folderPath]

For example: 
   npm run concurrent -- E:\\   
   npm run concurrent -- D:\\RU\\RUImages

If no folderPath is specified, the default is "D:\\"

Options:
  -h, --help     Show this help message
`);
  process.exit(0);
}

// 📁 Default to D:\ if no argument is given
const ROOT_FOLDER = args[0] || 'D:\\';

// 📣 Show which folder will be scanned
console.log(`📂 Scanning folder: ${ROOT_FOLDER}`);

// 🧾 Flush batch into database, handle constraint violations
async function flushBatch(db, insertStmt, updateStmt) {
  if (batch.length === 0) return;

  // 🔍 Add this line to trace flush timing and batch size
  console.log(`🌀 Flushing batch of ${batch.length} items`);

  try {
    await db.exec('BEGIN TRANSACTION');
    for (const item of batch) {
      try {
        await insertStmt.run(
          item.fileName,
          item.fullPath,
          item.fileFormat,
          item.fileSize,
          item.hash,
          item.indexedAt, 
          item.createdAt,
          item.modifiedAt
        );
        processedCount++;
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          await updateStmt.run(item.fullPath);
          skippedCount++;
        } else {
          throw err;
        }
      }
    }
    await db.exec('COMMIT');
    console.log(`📦 Batch flushed: ${batch.length} items`);
    batch = [];
  } catch (err) {
    console.error('⚠️ Error during flushBatch:', err.message);
  }
}

// 🧬 Process individual file and add to batch
async function processFile(filePath, db, insertStmt, updateStmt) {
  const now = new Date();

  try {
    const stat = await fs.stat(filePath);
    const hash = await hashFile(filePath);
    const fileName = path.basename(filePath);
    const fileFormat = path.extname(filePath).slice(1).toLowerCase();
    const fileSize = stat.size;
    const indexedAt = now.toISOString();
    const createdAt = stat.birthtime.toISOString();
    const modifiedAt = stat.mtime.toISOString();

    batch.push({
      fileName,
      fullPath: filePath,
      fileFormat,
      fileSize,
      hash,
      indexedAt, 
      createdAt,
      modifiedAt
    });
    processedPaths.add(filePath);   // Mark file as processed

    if (batch.length >= BATCH_SIZE) {
      flushLock = flushLock.then(() =>            // Chain flush to previous
        flushBatch(db, insertStmt, updateStmt));  // Flush batch to database
      await flushLock;                            // Wait for flush to complete
    }
  } catch (err) {
    console.error(`⚠️ Error processing ${filePath}:`, err.message);
  }
}

async function processQueueLoop(db, insertStmt, updateStmt, queue) {
  let activeWorkers = 0;

  // Continue while tasks remain or workers are active
  while (queue.length > 0 || activeWorkers > 0) {
    while (activeWorkers < MAX_WORKERS && queue.length > 0) {
      const filePath = queue.shift();   // Dequeue next file path
      activeWorkers++;

      const p = processFile(filePath, db, insertStmt, updateStmt)
        .catch(err => console.error('⚠️ Worker error:', err.message))
        .finally(() => {
          activeWorkers--;
        });

      processingPromises.push(p);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// 🧱 Main ritual: setup DB, scan folder, insert records
async function main() {
  await fs.mkdir('./data', { recursive: true });
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  // 🧾 Create table if not exists
  await db.exec(SQL_create_table);

  // 🧾 Prepare insert statement 
  const insertStmt = await db.prepare(SQL_insert);

  // 🧾 Prepare update statement 
  const updateStmt = await db.prepare(SQL_update);

  // Write audit
  await writeAudit(db, 'scanFolder', ROOT_FOLDER);
  const startTime = new Date(); // ✅ creates a Date object
  await writeAudit(db, 'startTime', startTime.toISOString());

  // Start running here... 
  for await (const filePath of walk(ROOT_FOLDER)) {
    queue.push(filePath);
    enqueuedCount++;
    enqueuedPaths.add(filePath);
  }

  // 🔄 Start processing queued tasks
  await processQueueLoop(db, insertStmt, updateStmt, queue);
  // ⏳ Wait for all file tasks to finish
  await Promise.all(processingPromises);
  // 🧺 Ensure final DB flush completes
  await flushLock;

  // 🧺 Flush remaining records to DB
  await flushBatch(db, insertStmt, updateStmt);
  await insertStmt.finalize();    // 🔒 Finalize insert statement
  await updateStmt.finalize();    // 🔒 Finalize update statement

  // Write audit
  const endTime = new Date(); // ✅ creates a Date object
  const elapsed = ((endTime - startTime) / 1000).toFixed(2);
  
  await writeAudit(db, 'endTime', endTime.toISOString());
  await writeAudit(db, 'elapsedTime', elapsed);
  await writeAudit(db, 'enqueuedTotal', enqueuedCount);
  await writeAudit(db, 'filesProcessed', processedCount);
  await writeAudit(db, 'difference', enqueuedCount - processedCount);
  await writeAudit(db, 'filesSkipped',  skippedCount);
  // Find paths that were enqueued but not processed
  const missing = [...enqueuedPaths].filter(p => !processedPaths.has(p));
  await writeAudit(db, 'missingFiles',  missing.length);

  await db.close();               // 🔚 Close database connection

  // Write all enqueued paths
  await fs.writeFile('./data/enqueued.txt', [...enqueuedPaths].join('\n'));
  // Write all processed paths
  await fs.writeFile('./data/processed.txt', [...processedPaths].join('\n'));
  // Write missing paths to file
  await fs.writeFile('./data/missing.txt', missing.join('\n'));

  // 🧮 Final report
  console.log(`\n✅ Scan complete.`);
  console.log(`⏱️ Elapsed time: ${elapsed} seconds`);
  console.log(`📦 Enqueued total: ${enqueuedCount}`);
  console.log(`📁 Processed total: ${processedCount}`);
  console.log(`🧮 Difference: ${enqueuedCount - processedCount}`);
  console.log(`⚠️ Files skipped (constraint violation): ${skippedCount}`);
  console.log(`📜 Audit complete. Missing files: ${missing.length}`);

  process.exit(0);  // ✅ Exit script successfully
}

main();

/*
   node src/processFolder.concurrent.js "D:\RU\RUImages"

   npm run concurrent -- d:\
   npm run concurrent -- D:\RU\RUImages
*/