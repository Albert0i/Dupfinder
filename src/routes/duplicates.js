import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';

const router = express.Router();
const HOST = process.env.HOST
const PORT = process.env.PORT

router.get('/', async (req, res) => {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/duplicates`);
    const data = await response.json();

    res.render('duplicates', {
      duplicates: data
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

router.get('/:hash', async (req, res) => {
  const hash = req.params.hash;

  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/v1/files/hash/${hash}`);
    const data = await response.json();
    
    res.render('inspect', {
      duplicates: data, 
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
    const response1 = await fetch(`http://${HOST}:${PORT}/api/v1/files/hash/${hash}?pathonly=true`);
    const data = await response1.json();

    // Abort if disk deletion fails...
    await fs.unlink(data.fullPath);
    console.log(`Deleted file from disk: fullPath = ${data.fullPath}`);

    // Delete from database
    const response2 = await fetch(`/api/v1/files/id/${id}`, {
      method: 'DELETE'
    });

    const result = await response2.json();

    if (response.ok) {
      //console.log('Deleted:', result.deletedId);
      console.log(`Deleted file from database: id = ${result.deletedId}, rows affected = ${result.changes}`);    
    } else {
      console.error('Delete failed:', result.error);
    }

    res.status(200).json({ message: `File with id ${id} deleted` });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;