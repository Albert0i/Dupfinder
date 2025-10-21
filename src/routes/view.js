import express from 'express';
import fs from 'fs';
import { db } from '../sqlite.js'

const router = express.Router();

// GET /view/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const file = await db.get('SELECT fullPath FROM files WHERE id = ?', [id]);

    if (!file || !file.fullPath) {
      return res.status(404).send('File not found.');
    }

    const raw = fs.readFileSync(file.fullPath, 'utf-8');
    const content = raw.replace(/\n/g, '<br />');
    res.render('view', { content });
  } catch (err) {
    console.error('Error sending file:', err);
    res.status(500).send('Failed to send file.');
  }
});

export default router;