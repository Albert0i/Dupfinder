import 'dotenv/config';
import express from 'express';

const router = express.Router();
const HOST = process.env.HOST
const PORT = process.env.PORT

router.get('/', async (req, res) => {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/dashboard`);
    const data = await response.json();

    res.render('dashboard', {
      totalFiles: data.totalFiles,
      duplicateCount: data.duplicateCount,
      scanFolder: data.scanFolder,
      scanAt: data.scanAt
    });
    
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

export default router;