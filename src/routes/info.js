import express from 'express';
import { db } from '../sqlite.js'

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const auditRows = await db.all(`
      SELECT auditKey, auditValue
      FROM audit
      ORDER BY id ASC
    `);

    const fileStats = await db.all(`
      SELECT
        (SELECT COUNT(*) FROM files) AS totalFilesIndexed,
        (SELECT SUM(fileSize) FROM files) AS totalSizeBytes,
        (SELECT AVG(fileSize) FROM files) AS averageFileSize,
        (SELECT MAX(indexedAt) FROM files) AS latestIndexedAt,
        (SELECT MIN(createdAt) FROM files) AS earliestCreatedAt,
        (SELECT MAX(modifiedAt) FROM files) AS latestModifiedAt
    `);

    const topFormats = await db.all(`
      SELECT fileFormat, COUNT(*) AS count
      FROM files
      WHERE fileFormat <> ''
      GROUP BY fileFormat
      ORDER BY count DESC
      LIMIT 10
    `);

    const info = {};
    auditRows.forEach(row => {
      info[row.auditKey] = row.auditValue;
    });

    Object.assign(info, fileStats[0]); // merge file stats
    info.topFileFormats = topFormats;  // add top 10 formats

    res.render('info', { info });
  } catch (err) {
    console.error('Error loading audit info:', err);
    res.status(500).render('error', { message: 'Failed to load scan info.' });
  }
});

/* router.get('/', async (req, res) => {
  try {
    const auditRows = await db.all('SELECT auditKey, auditValue FROM audit ORDER BY id ASC');
    const fileStats = await db.all(`
      SELECT
        (SELECT COUNT(*) FROM files) AS totalFilesIndexed,
        (SELECT SUM(fileSize) FROM files) AS totalSizeBytes,
        (SELECT AVG(fileSize) FROM files) AS averageFileSize,
        (SELECT fileFormat FROM files GROUP BY fileFormat ORDER BY COUNT(*) DESC LIMIT 1) AS mostCommonFormat,
        (SELECT MAX(indexedAt) FROM files) AS latestIndexedAt,
        (SELECT MIN(createdAt) FROM files) AS earliestCreatedAt,
        (SELECT MAX(modifiedAt) FROM files) AS latestModifiedAt
    `);
    
    const info = {};
    auditRows.forEach(row => {
      info[row.auditKey] = row.auditValue;
    });
    Object.assign(info, fileStats[0]); // merge file stats into info
    
    res.render('info', { info });
  } catch (err) {
    console.error('Error loading audit info:', err);
    res.status(500).render('error', { message: 'Failed to load scan info.' });
  }
});
 */
export default router;