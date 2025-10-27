/*
   processFolder.single.js 
*/
import fs from 'fs/promises';
import path from 'path';
import { db } from './sqlite.js'
import { hashFile, walk, SQL_create_table, SQL_insert, SQL_update, writeAudit } from './utils.js'

const BATCH_SIZE = process.env.BATCH_SIZE || 100;

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
function flushBatch(db, insert, update) {
  if (batch.length === 0) return;

  try {
    const transaction = db.transaction(() => {
      for (const item of batch) {
        try {
          insert.run(
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
      flushBatch(db, insert, update);
    }
  } catch (err) {
    console.error(`⚠️ Error processing ${filePath}:`, err.message);
  }
}

// 🧱 Main ritual: setup DB, scan folder, insert records
async function main() {
  await fs.mkdir('./data', { recursive: true });

  // 🧾 Create table if not exists
  db.exec(SQL_create_table);
  
  // 🧾 Prepare insert statement 
  const insert = db.prepare(SQL_insert);

  // 🧾 Prepare update statement 
  const update = db.prepare(SQL_update);

  // Write audit
  writeAudit(db, 'scanFolder', ROOT_FOLDER);
  writeAudit(db, 'mode', 'single');
  writeAudit(db, 'batchSize', BATCH_SIZE);
  
  const startTime = new Date(); // ✅ creates a Date object
  writeAudit(db, 'startTime', startTime.toISOString());

  // Start running here... 
  for await (const filePath of walk(ROOT_FOLDER)) {
    await processFile(filePath, db, insert, update);
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
  flushBatch(db, insert, update);   
  
  // Write audit
  const endTime = new Date(); // ✅ creates a Date object
  const elapsed = ((endTime - startTime) / 1000).toFixed(2);
  
  writeAudit(db, 'endTime', endTime.toISOString());
  writeAudit(db, 'elapsedTime', elapsed);
  writeAudit(db, 'filesProcessed', processedCount);
  writeAudit(db, 'filesSkipped',  skippedCount);

  db.close();               // 🔚 Close database connection
  
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