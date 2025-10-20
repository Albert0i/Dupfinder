/*
   processFolder.single.js 
*/
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { hashFile, walk, SQL_create_table, SQL_insert, SQL_update, writeAudit } from './utils.js'

const DB_PATH = process.env.DB_PATH || './data/db.sq3';
const BATCH_SIZE = process.env.BATCH_SIZE || 1000;

let batch = [];                     // Pending records
let processedCount = 0;             // Files processed
let skippedCount = 0;               // Files skipped

// 🧭 Get folder path from command-line argument
const args = process.argv.slice(2);

// 🆘 Help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npm run single -- [folderPath]

For example: 
   npm run single -- E:\\   
   npm run single -- D:\\RU\\RUImages

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

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(db, insertStmt, updateStmt);
    }
  } catch (err) {
    console.error(`⚠️ Error processing ${filePath}:`, err.message);
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
    await processFile(filePath, db, insertStmt, updateStmt);
  }
  /*
  // JavaScript does this under the hood:

  const iterator = walk(ROOT_FOLDER)[Symbol.asyncIterator]();
  let result = await iterator.next();
  while (!result.done) {
    const filePath = result.value;
    await processFile(filePath, db, insertStmt, updateStmt);
    result = await iterator.next();
  }
  */

  // 🧺 Flush remaining records to DB
  await flushBatch(db, insertStmt, updateStmt);   
  await insertStmt.finalize();    // 🔒 Finalize insert statement
  await updateStmt.finalize();    // 🔒 Finalize update statement

  // Write audit
  const endTime = new Date(); // ✅ creates a Date object
  const elapsed = ((endTime - startTime) / 1000).toFixed(2);
  
  await writeAudit(db, 'endTime', endTime.toISOString());
  await writeAudit(db, 'elapsedTime', elapsed);
  await writeAudit(db, 'filesProcessed', processedCount);
  await writeAudit(db, 'filesSkipped',  skippedCount);

  await db.close();               // 🔚 Close database connection
  
  // 🧮 Final report
  console.log(`\n✅ Scan complete.`);
  console.log(`⏱️ Elapsed time: ${elapsed} seconds`);
  console.log(`📁 Files processed: ${processedCount}`);
  console.log(`⚠️ Files skipped (constraint violation): ${skippedCount}`);

  process.exit(0);  // ✅ Exit script successfully
}

main();

/*
   node src/processFolder.single.js "D:\RU\RUImages"

   npm run single -- d:\
   npm run single -- D:\RU\RUImages
*/