import express from 'express';

const router = express.Router();
const HOST = process.env.HOST
const PORT = process.env.PORT

router.get('/', async (req, res) => {
  const fileFormats = await getFormats()

  res.render('search', { 
    stext: '', 
    fileFormats, 
    selectedFormat: '*ALL*', 
    results: null, 
    error: null 
  });
});

router.post('/', async (req, res) => {
  const { stext, selectedFormat } = req.body;
  const fileFormats = await getFormats()

  if (!stext || stext.trim() === '') {
    return res.render('search', {
      stext, 
      fileFormats,
      selectedFormat, 
      results: [],
      error: 'Search text cannot be empty.'
    });
  }

  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/files/search/${encodeURIComponent(stext.trim())}?format=${selectedFormat}`);
    const results = await response.json();

    res.render('search', {
      stext, 
      fileFormats: await getFormats(),
      selectedFormat, 
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

async function getFormats() {
  let formats = []

  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/files/formats`);
    const result = await response.json();

    formats = [{ fileFormat: '*ALL*' }, ...result ]
  } catch (err) {
    console.error(err.message);
  }

  return formats;
}


export default router;
