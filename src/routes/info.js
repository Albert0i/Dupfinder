import 'dotenv/config';
import express from 'express';
import { db } from '../sqlite.js'
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Fetch audit metadata
    const auditRows = await db.all(`
      SELECT auditKey, auditValue
      FROM audit
      ORDER BY id ASC
    `);

    // Fetch file statistics
    const fileStats = await db.all(`
      SELECT
        (SELECT COUNT(*) FROM files) AS totalFilesIndexed,
        (SELECT SUM(fileSize) FROM files) AS totalSizeBytes,
        (SELECT AVG(fileSize) FROM files) AS averageFileSize,
        (SELECT MAX(indexedAt) FROM files) AS latestIndexedAt,
        (SELECT MIN(createdAt) FROM files) AS earliestCreatedAt,
        (SELECT MAX(modifiedAt) FROM files) AS latestModifiedAt
    `);

    // Fetch top 10 file formats
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

    // Fetch SQLite and VSS version
    const versions = await db.get(`
      SELECT sqlite_version() AS sqlite_version, vec_version() AS vec_version
    `);
    
    info.sqliteVersion = versions.sqlite_version;
    info.vecVersion = versions.vec_version;
    info.dbSize = `${getDatabaseSize(process.env.DB_PATH)} MB`

    res.render('info', { info });
  } catch (err) {
    console.error('Error loading audit info:', err);
    res.status(500).render('error', { message: 'Failed to load scan info.' });
  }
});

function getDatabaseSize(dbPath) {
  try {
    const resolvedPath = path.resolve(dbPath);
    const stats = fs.statSync(resolvedPath);
        
    return (stats.size / (1024 * 1024)).toFixed(2) // in MB
  } catch (err) {
    console.error(`Failed to get database size: ${err.message}`);
    return 0;
  }
}

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