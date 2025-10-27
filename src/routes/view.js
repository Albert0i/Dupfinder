import express from 'express';
import fs from 'fs';

const router = express.Router();
const HOST = process.env.HOST
const PORT = process.env.PORT

// GET /view/:hash
router.get('/:hash', async (req, res) => {
  const { hash } = req.params;

  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/files/hash/${hash}?pathonly=true`);
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
      fullPath: data.fullPath, 
      content });

  } catch (err) {
    console.error('View render error:', err);
    res.status(500).send('Failed to render file.');
  }
});

export default router;
