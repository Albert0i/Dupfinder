import 'dotenv/config';
import express from 'express';
import { db } from '../sqlite.js'

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const totalRow = await db.get('SELECT COUNT(*) AS totalFiles FROM files');

    const dupRow = await db.get(`
      SELECT COUNT(*) AS duplicateCount FROM (
        SELECT hash FROM files GROUP BY hash HAVING COUNT(*) > 1
      )
    `);

    const scanFolder = await db.get(`
      SELECT auditValue
        FROM audit 
        WHERE auditKey='scanFolder'`)
        
    const scanAt = await db.get(`
      SELECT auditValue
      FROM audit 
      WHERE auditKey='endTime'`)

    res.render('dashboard', {
      totalFiles: totalRow?.totalFiles || 0,
      duplicateCount: dupRow?.duplicateCount || 0,
      scanFolder: scanFolder?.auditValue || null, 
      scanAt: scanAt?.auditValue || null
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

export default router;