import 'dotenv/config';
import express from 'express';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const router = express.Router();
const db = new sqlite3.Database(process.env.DB_PATH);

// Promisify db.all
const dbAll = promisify(db.all).bind(db);

router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT hash, COUNT(*) AS count
      FROM files
      GROUP BY hash
      HAVING count > 1
      ORDER BY count DESC
    `);

    console.log('rows =', rows)
    res.render('duplicates', {
      duplicates: rows,
      hash: null
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

router.get('/:hash', async (req, res) => {
  const hash = req.params.hash;
  try {
    const rows = await dbAll(`
      SELECT * FROM files
      WHERE hash = ?
      ORDER BY createdAt
    `, [hash]);

    res.render('duplicates', {
      duplicates: rows,
      hash
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

export default router;