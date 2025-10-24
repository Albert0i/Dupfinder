import 'dotenv/config';
import express from 'express';
import { db } from '../sqlite.js'; // adjust path if needed
import fs from 'fs';
import path from 'path';

const router = express.Router();

// GET /api/v1/dashboard — returns dashboard metrics as JSON
router.get('/dashboard', async (req, res) => {
    try {
      const totalRow = await db.prepare('SELECT COUNT(*) AS totalFiles FROM files').get();
  
      const dupRow = await db.prepare(`
        SELECT COUNT(*) AS duplicateCount FROM (
          SELECT hash FROM files GROUP BY hash HAVING COUNT(*) > 1
        )
      `).get();
  
      const scanFolder = await db.prepare(`
        SELECT auditValue FROM audit WHERE auditKey='scanFolder'
      `).get();
  
      const scanAt = await db.prepare(`
        SELECT auditValue FROM audit WHERE auditKey='endTime'
      `).get();
  
      res.json({
        totalFiles: totalRow?.totalFiles || 0,
        duplicateCount: dupRow?.duplicateCount || 0,
        scanFolder: scanFolder?.auditValue || null,
        scanAt: scanAt?.auditValue || null
      });
    } catch (err) {
      console.error('Dashboard API error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });  

// GET /api/v1/duplicates — returns duplicates metrics as JSON
router.get('/duplicates', async (req, res) => {
    try {
        const rows = await db.prepare(`
            SELECT hash, COUNT(*) AS count,
                   GROUP_CONCAT(filename, ', ') AS filenames
            FROM files
            GROUP BY hash
            HAVING count > 1
            ORDER BY count DESC
            LIMIT ${process.env.MAX_LIMIT}
          `).all();
        res.json(rows);

      } catch (err) {
        console.error('Dashboard API error:', err);
        res.status(500).json({ error: 'Database error' });
      }
  });

// GET /api/v1/files/hash/:hash?pathonly=true — returns file metadata and content
router.get('/files/hash/:hash', async (req, res) => {
    const { hash } = req.params;
    const pathOnly = req.query.pathonly === 'true';
    
    try {
        if (pathOnly) {
            const file = await db.prepare(`
                SELECT fullPath 
                FROM files 
                WHERE hash = ? 
                LIMIT 1`).get(hash);
            
            res.json(file);
        } else { 
            const rows = await db.prepare(`
                SELECT * 
                FROM files 
                WHERE hash = ? 
                ORDER BY createdAt DESC`).all(hash);
            
            res.json( rows );
        }
    } catch (err) {
        console.error('API error:', err);
        res.status(500).json({ error: 'Failed to read database.' });
    }
  });  

// GET /api/v1/files/id/:id?pathonly=true — returns file metadata and content
router.get('/files/id/:id', async (req, res) => {
    const { id } = req.params;
    const pathOnly = req.query.pathonly === 'true';
    
    try {
        const file = await db.prepare(`
          SELECT ${pathOnly ? 'fullPath' : '*'} 
          FROM files 
          WHERE id = ?`).get(id);
      
        res.json(file); 
    } catch (err) {
        console.error('API error:', err);
        res.status(500).json({ error: 'Failed to read database.' });
    }
  });

// DELETE /api/v1/files/id/:id — removes a file record by ID
router.delete('/files/id/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const result = await db.prepare('DELETE FROM files WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'File not found.' });
      }

      res.json({ success: true, ...result });
    } catch (err) {
      console.error('API error:', err);
      res.status(500).json({ error: 'Failed to delete file.' });
    }
  });

// GET /api/v1/info — returns info metrics as JSON
router.get('/info', async (req, res) => {
    try {
      // Fetch audit metadata
      const auditRows = await db.prepare(`
        SELECT auditKey, auditValue
        FROM audit
        ORDER BY id ASC
      `).all();

      // Fetch file statistics
      const fileStats = await db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM files) AS totalFilesIndexed,
          (SELECT SUM(fileSize) FROM files) AS totalSizeBytes,
          (SELECT AVG(fileSize) FROM files) AS averageFileSize,
          (SELECT MAX(indexedAt) FROM files) AS latestIndexedAt,
          (SELECT MIN(createdAt) FROM files) AS earliestCreatedAt,
          (SELECT MAX(modifiedAt) FROM files) AS latestModifiedAt
      `).all();

      // Fetch top 10 file formats
      const topFormats = await db.prepare(`
        SELECT fileFormat, COUNT(*) AS count
        FROM files
        WHERE fileFormat <> ''
        GROUP BY fileFormat
        ORDER BY count DESC
        LIMIT 10
      `).all();

      const info = {};
      auditRows.forEach(row => {
        info[row.auditKey] = row.auditValue;
      });

      Object.assign(info, fileStats[0]); // merge file stats
      info.topFileFormats = topFormats;  // add top 10 formats

      // Fetch SQLite and VSS version
      const versions = await db.prepare(`
        SELECT sqlite_version() AS sqlite_version, vec_version() AS vec_version
      `).get();
      
      info.sqliteVersion = versions.sqlite_version;
      info.vecVersion = versions.vec_version;
      info.dbSize = getDatabaseSize(process.env.DB_PATH)

      res.json( info );
    } catch (err) {
      console.error('Error loading audit info:', err);
      res.status(500).render('error', { message: 'Failed to load scan info.' });
    }
  });

function getDatabaseSize(dbPath) {
  try {
    const resolvedPath = path.resolve(dbPath);
    const stats = fs.statSync(resolvedPath);
        
    //return (stats.size / (1024 * 1024)).toFixed(2) // in MB
    return stats.size // in bytes
  } catch (err) {
    console.error(`Failed to get database size: ${err.message}`);
    return 0;
  }
}

export default router;
