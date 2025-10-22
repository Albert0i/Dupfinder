import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import { db } from '../sqlite.js'

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await db.all(`
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

  try {
    const rows = await db.all(`
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
  
  try {
    // Fetch the file entry
    const row = await db.get(`SELECT fullPath FROM files WHERE id = ?`, [id]);

    if (!row) {
      return res.status(404).json({ error: 'File not found' });
    }

    try {
      // Abort if disk deletion fails...
      await fs.unlink(row.fullPath);
      console.log(`Deleted file from disk: fullPath = ${row.fullPath}`);

      // Delete from database
      const result = await db.run(`DELETE FROM files WHERE id = ?`, [id]);
      console.log(`Deleted file from database: id = ${id}, rows affected = ${result.changes}`);
    } catch (err) {
      console.warn(`Failed on deletion: fullPath = ${row.fullPath}, id = ${id}`);
      console.log(err.messsage)      
    }

    res.status(200).json({ message: `File with id ${id} deleted` });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;