import express from 'express';
import { db } from '../sqlite.js'

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT auditKey, auditValue FROM audit ORDER BY id ASC');

    // Convert rows into a key-value object for easy access in EJS
    const info = {};
    rows.forEach(row => {
      info[row.auditKey] = row.auditValue;
    });

    res.render('info', { info });
  } catch (err) {
    console.error('Error loading audit info:', err);
    res.status(500).render('error', { message: 'Failed to load scan info.' });
  }
});

export default router;