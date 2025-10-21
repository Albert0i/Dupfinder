/*
    Promise-based wrapper
*/
import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = process.env.DB_PATH || path.resolve('./data/db.sq3');

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database
});

export { db, dbPath };

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
/*
   SQLite Node.js: Querying Data
   https://www.sqlitetutorial.net/sqlite-nodejs/query/
*/