/*
   processFolder.concurrent.js 
*/
import fs from 'fs/promises';
import path from 'path';
import { db } from './sqlite.js'
import { analyzeFile, hashFile, walk, SQL_create_table, SQL_insert, SQL_update, SQL_create_table_fs, writeAudit } from './utils.js'

const BATCH_SIZE = process.env.BATCH_SIZE || 1000;
// Optimal configuration: MAX_WORKERS = 8
// Elapsed: 430.45s, Difference: 0
const MAX_WORKERS = process.env.MAX_WORKERS || 4

const queue = [];                   // Task queue for pending files
let enqueuedCount = 0;              // Number of files queued
const enqueuedPaths = new Set();    // Paths queued for processing

let batch = [];                     // Pending records
let processedCount = 0;             // Files processed
let skippedCount = 0;               // Files skipped

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
function flushBatch(db, insert, update) {
  if (batch.length === 0) return;

  // 🔍 Add this line to trace flush timing and batch size
  console.log(`🌀 Flushing batch of ${batch.length} items`);

  try {
    const transaction = db.transaction(() => {
      for (const item of batch) {
        try {
          insert.run(
            item.fileName,
            item.fullPath,
            item.fileFormat,
            item.fileSize,
            item.isTextFile ? 1 : 0, 
            item.content, 
            item.hash,
            item.indexedAt,
            item.createdAt,
            item.modifiedAt
          );
          processedCount++;
        } catch (err) {
          console.warn('⚠️ Constraint hit for:', item.fullPath);
          if (err.code === 'SQLITE_CONSTRAINT') {
            update.run(item.fullPath);
            skippedCount++;
          } else {
            throw err;
          }
        }
      }
    });

    transaction(); // execute the transaction
    console.log(`📦 Batch flushed: ${batch.length} items`);
    batch = [];
  } catch (err) {
    console.error('⚠️ Error during flushBatch:', err.message);
  }
}

// 🧬 Process individual file and add to batch
async function processFile(filePath, db, insert, update) {
  const now = new Date();

  try {
    const stat = await fs.stat(filePath);
    //const hash = await hashFile(filePath);
    const { hash, isTextFile, content } = await analyzeFile(filePath)
    const fileName = path.basename(filePath);
    const fileFormat = path.extname(filePath).slice(1).toLowerCase();
    const fileSize = stat.size;
    const indexedAt = now.toISOString();
    const createdAt = stat.birthtime.toISOString();
    const modifiedAt = stat.mtime.toISOString();

    if (!hash) {
      console.warn(`⚠️ Warning ${filePath} — hash is null`);
    }
    batch.push({
      fileName,
      fullPath: filePath,
      fileFormat,
      fileSize,
      isTextFile, 
      content, 
      hash,
      indexedAt, 
      createdAt,
      modifiedAt
    });
    processedPaths.add(filePath);   // Mark file as processed

    if (batch.length >= BATCH_SIZE) {
      flushLock = flushLock.then(() =>    // Chain flush to previous
        flushBatch(db, insert, update));  // Flush batch to database
      await flushLock;                    // Wait for flush to complete
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
  
  // 🧾 Create tables
  db.exec(SQL_create_table);

  // 🧾 Prepare insert statement 
  const insert = db.prepare(SQL_insert);

  // 🧾 Prepare update statement 
  const update = db.prepare(SQL_update);

  // Write audit
  writeAudit(db, 'scanFolder', ROOT_FOLDER);
  writeAudit(db, 'mode', `concurrent, ${MAX_WORKERS} workers`);
  writeAudit(db, 'batchSize', BATCH_SIZE);
  
  const startTime = new Date(); // ✅ creates a Date object
  writeAudit(db, 'startTime', startTime.toISOString());

  // Start running here... 
  for await (const filePath of walk(ROOT_FOLDER)) {
    queue.push(filePath);
    enqueuedCount++;
    enqueuedPaths.add(filePath);
  }

  // 🔄 Start processing queued tasks
  await processQueueLoop(db, insert, update, queue);
  // ⏳ Wait for all file tasks to finish
  await Promise.all(processingPromises);
  // 🧺 Ensure final DB flush completes
  await flushLock;

  // 🧺 Flush remaining records to DB
  flushBatch(db, insert, update);
  
  // Write audit
  const endTime = new Date(); // ✅ creates a Date object
  const elapsed = ((endTime - startTime) / 1000).toFixed(2);
  
  writeAudit(db, 'endTime', endTime.toISOString());
  writeAudit(db, 'elapsedTime', elapsed);
  writeAudit(db, 'enqueuedTotal', enqueuedCount);
  writeAudit(db, 'filesProcessed', processedCount);
  writeAudit(db, 'difference', enqueuedCount - processedCount);
  writeAudit(db, 'filesSkipped',  skippedCount);
  // Find paths that were enqueued but not processed
  const missing = [...enqueuedPaths].filter(p => !processedPaths.has(p));
  writeAudit(db, 'missingFiles',  missing.length);

  // 🧾 Create tables for full text search
  db.exec(SQL_create_table_fs);

  db.close();               // 🔚 Close database connection

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