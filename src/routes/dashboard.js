import 'dotenv/config';
import express from 'express';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const router = express.Router();
const db = new sqlite3.Database(process.env.DB_PATH);

// Promisify db.get
const dbGet = promisify(db.get).bind(db);

router.get('/', async (req, res) => {
  try {
    const totalRow = await dbGet('SELECT COUNT(*) AS totalFiles FROM files');
    const dupRow = await dbGet(`
      SELECT COUNT(*) AS duplicateCount FROM (
        SELECT hash FROM files GROUP BY hash HAVING COUNT(*) > 1
      )
    `);

    res.render('dashboard', {
      totalFiles: totalRow?.totalFiles || 0,
      duplicateCount: dupRow?.duplicateCount || 0,
      lastScanTime: null // Optional: add timestamp logic later
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

export default router;