import 'dotenv/config';
import express from 'express';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs/promises';

const router = express.Router();
const db = new sqlite3.Database(process.env.DB_PATH);

// Promisify db.all
const dbAll = promisify(db.all).bind(db);

router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT hash, COUNT(*) AS count,
             GROUP_CONCAT(filename, ', ') AS filenames
      FROM files
      GROUP BY hash
      HAVING count > 1
      ORDER BY count DESC
      LIMIT ${process.env.MAX_LIMIT}
    `);

    res.render('duplicates', {
      duplicates: rows
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

router.get('/:hash', async (req, res) => {
  const hash = req.params.hash;

  console.log('hash =', hash)
  try {
    const rows = await dbAll(`
      SELECT * FROM files
      WHERE hash = ?
      ORDER BY createdAt DESC
    `, [hash]);

    res.render('inspect', {
      duplicates: rows, 
      hash
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  
  console.log('id =', id)
  try {
    // Fetch the file entry
    const row = await dbGet(`SELECT fullPath FROM files WHERE id = ?`, [id]);

    if (!row) {
      return res.status(404).json({ error: 'File not found' });
    }

    console.log('fullPath =', fullPath)
    // Delete from disk
    try {
      await fs.unlink(row.fullPath);
      console.log(`Deleted file from disk: ${row.fullPath}`);
    } catch (err) {
      console.warn(`Failed to delete file from disk: ${row.fullPath}`, err.message);
      // Continue with DB deletion even if disk deletion fails
    }

    // Delete from database
    await dbRun(`DELETE FROM files WHERE id = ?`, [id]);

    res.status(200).json({ message: `File with id ${id} deleted` });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;