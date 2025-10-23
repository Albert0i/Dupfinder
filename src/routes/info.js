import 'dotenv/config';
import express from 'express';

const router = express.Router();
const HOST = process.env.HOST
const PORT = process.env.PORT

router.get('/', async (req, res) => {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/info`);
    const data = await response.json();

    res.render('info', { info:data } );
  } catch (err) {
    console.error('Error loading audit info:', err);
    res.status(500).render('error', { message: 'Failed to load scan info.' });
  }
});

export default router;
