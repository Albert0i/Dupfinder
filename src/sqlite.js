/*
    Promise-based wrapper
*/
import 'dotenv/config';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';

const dbPath = process.env.DB_PATH || path.resolve('./data/db.sq3');
const db = new Database(dbPath); // synchronous, no await

// Sets the journal mode to WAL, which stands for Write-Ahead Logging. 
db.pragma('journal_mode = WAL');
/*
   Use the sqliteVec.load() function to load sqlite-vec SQL functions 
   into a SQLite connection.
*/
sqliteVec.load(db);

// Show version info
const { sqlite_version, vec_version } = await db.
  prepare(
    `SELECT sqlite_version() AS sqlite_version, 
            vec_version() AS vec_version;`
   ).get()
console.log(`sqlite_version=${sqlite_version}, vec_version=${vec_version}`);

/*
   Test vector capability
*/
const items = [
   [1, [0.1, 0.1, 0.1, 0.1]],
   [2, [0.2, 0.2, 0.2, 0.2]],
   [3, [0.3, 0.3, 0.3, 0.3]],
   [4, [0.4, 0.4, 0.4, 0.4]],
   [5, [0.5, 0.5, 0.5, 0.5]],
 ];
 const query = [0.1, 0.2, 0.3, 0.4];
 
 await db.exec(`DROP TABLE vec_items`)
 await db.exec(`
   CREATE VIRTUAL TABLE vec_items USING vec0 (
         embedding float[4]
      );
   `);

 const insertStmt = await db.prepare(
   "INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)",
 );
 // TODO node:sqlite doesn't have `.transaction()` support yet
 for (const [id, vector] of items) {
   // node:sqlite requires Uint8Array for BLOB values, so a bit awkward
   await insertStmt.run(BigInt(id), new Uint8Array(new Float32Array(vector).buffer));
 }
 
 const selectStmt = await db.prepare(`
         SELECT rowid, distance
         FROM vec_items
         WHERE embedding MATCH ?
         ORDER BY distance
         LIMIT 3
      `
   )
//const rows = await..all(new Uint8Array(new Float32Array(query).buffer));
await selectStmt.bind(new Uint8Array(new Float32Array(query).buffer))
const rows = await selectStmt.all()
console.log(rows);
/*
Output: 
[
  { rowid: 3, distance: 0.24494898319244385 },
  { rowid: 2, distance: 0.24494898319244385 },
  { rowid: 4, distance: 0.37416577339172363 }
]
*/

export { db, dbPath };

/*
   better-sqlite3
   https://github.com/WiseLibs/better-sqlite3

   Using the better-sqlite3 driver
   https://www.prisma.io/docs/orm/overview/databases/sqlite

   SQLite Client for Node.js Apps
   https://www.npmjs.com/package/sqlite

   Using sqlite-vec in Node.js, Deno, and Bun
   https://alexgarcia.xyz/sqlite-vec/js.html

   sqlite-vec/examples/simple-node2/demo.mjs
   https://github.com/asg017/sqlite-vec/blob/main/examples/simple-node2/demo.mjs
*/

/*
   Classic sqlite3 API 
*/
/* 
import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

const dbPath = process.env.DB_PATH || path.resolve('./data/db.sq3');
const db = new sqlite3.Database(dbPath);

// Promisified methods
const dbAll = promisify(db.all).bind(db);
const dbGet = promisify(db.get).bind(db);
const dbRun = promisify(db.run).bind(db);

export { dbAll, dbGet, dbRun, dbPath, db };
*/