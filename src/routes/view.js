import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { db } from '../sqlite.js'

const router = express.Router();
const HOST = process.env.HOST
const PORT = process.env.PORT

// GET /view/:hash
router.get('/:hash', async (req, res) => {
  const { hash } = req.params;

  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/files/hash/${hash}?limit=1`);
    const data = await response.json();
    
    if (response.status !== 200) {
      return res.status(response.status).send(data.error || 'Error loading file.');
    }

    if (!data || !data.fullPath) {
      return res.status(404).send('File not found.');
    }

    const raw = fs.readFileSync(data.fullPath, 'utf-8');
    const content = raw.replace(/\n/g, '<br />');
    res.render('view', { 
      fileName: data.fileName, 
      fullPath: data.fullPath, 
      content });

  } catch (err) {
    console.error('View render error:', err);
    res.status(500).send('Failed to render file.');
  }

  // try {
  //   const file = await db.get('SELECT fileName, fullPath FROM files WHERE hash = ? LIMIT 1', [hash]);
    
  //   if (!file || !file.fullPath) {
  //     return res.status(404).send('File not found.');
  //   }

  //   const raw = fs.readFileSync(file.fullPath, 'utf-8');
  //   const content = raw.replace(/\n/g, '<br />');
  //   res.render('view', { 
  //     fileName: file.fileName, 
  //     fullPath: file.fullPath, 
  //     content });
  // } catch (err) {
  //   console.error('Error sending file:', err);
  //   res.status(500).send('Failed to send file.');
  // }
});

export default router;

/*
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
*/