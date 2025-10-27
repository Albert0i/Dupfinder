import express from 'express';

const router = express.Router();
const HOST = process.env.HOST
const PORT = process.env.PORT

router.get('/', (req, res) => {
  res.render('search', { 
    stext: '', 
    results: null, 
    error: null 
  });
});

router.post('/', async (req, res) => {
  const { stext } = req.body;

  if (!stext || stext.trim() === '') {
    return res.render('search', {
      stext, 
      results: [],
      error: 'Search text cannot be empty.'
    });
  }

  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/search/${encodeURIComponent(stext)}`);
    const results = await response.json();

    res.render('search', {
      stext, 
      results,
      error: results.length === 0 ? 'No matching files found.' : null
    });
  } catch (err) {
    console.error('Search error:', err.message);
    res.render('search', {
      stext, 
      results: [],
      error: 'An error occurred while searching.'
    });
  }
});

export default router;
