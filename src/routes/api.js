import express from 'express';
import { db } from '../sqlite.js'; // adjust path if needed
import fs from 'fs';
import path from 'path';

const router = express.Router();

// GET /api/v1/dashboard — returns dashboard metrics as JSON
router.get('/dashboard', async (req, res) => {
    try {
      const totalRow = db.prepare('SELECT COUNT(*) AS totalFiles FROM files').get();
  
      const dupRow = db.prepare(`
        SELECT COUNT(*) AS duplicateCount FROM (
          SELECT hash FROM files GROUP BY hash HAVING COUNT(*) > 1
        )
      `).get();
  
      const scanFolder = db.prepare(`
        SELECT auditValue FROM audit WHERE auditKey='scanFolder'
      `).get();
  
      const scanAt = db.prepare(`
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
        const rows = db.prepare(`
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
            const file = db.prepare(`
                SELECT fullPath 
                FROM files 
                WHERE hash = ? 
                LIMIT 1`).get(hash);
            
            res.json(file);
        } else { 
            const rows = db.prepare(`
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
        const file = db.prepare(`
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
      const result = db.prepare('DELETE FROM files WHERE id = ?').run(id);

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
      const auditRows = db.prepare(`
        SELECT auditKey, auditValue
        FROM audit
        ORDER BY id ASC
      `).all();

      // Fetch file statistics
      const fileStats = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM files) AS totalFilesIndexed,
          (SELECT SUM(fileSize) FROM files) AS totalSizeBytes,
          (SELECT AVG(fileSize) FROM files) AS averageFileSize,
          (SELECT MAX(indexedAt) FROM files) AS latestIndexedAt,
          (SELECT MIN(createdAt) FROM files) AS earliestCreatedAt,
          (SELECT MAX(modifiedAt) FROM files) AS latestModifiedAt
      `).all();

      // Fetch top 10 file formats
      const topFormats = db.prepare(`
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
      const versions = db.prepare(`
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

// GET /api/v1/search/:stest?format=xxx&content=false — returns info metrics as JSON
router.get('/files/search/:stext', async (req, res) => {
  const { stext } = req.params;
  const selectedFormat = req.query.format; 
  const textContent = String(req.query.content).toLowerCase() === 'true';

  if (!stext || stext.trim() === '') {
    return res.status(400).json({ error: 'Search text cannot be empty.' });
  }
  // fileName
  const cond1 = stext === '*' ? '1 = 1' : `LOWER(fileName) LIKE '%${stext.trim().toLowerCase()}%'`
  // fileFormat 
  const cond2 = selectedFormat === '*ALL*' ? '' : ` AND fileFormat = '${selectedFormat}'`
  // fileName search 
  const query1 = `
    SELECT id, fileName, fullPath, fileSize, createdAt
    FROM files
    WHERE ${cond1} ${cond2}
    LIMIT ${process.env.MAX_LIMIT};
  `;

  // full text search on file content
  const query2 = `
    SELECT f.id, f.fileName, f.fullPath, f.fileSize, f.createdAt
    FROM files_fts AS fts
    JOIN files AS f ON fts.rowid = f.id
    WHERE fts.content MATCH '${stext.trim()}'
      AND f.isTextFile = 1
    LIMIT ${process.env.MAX_LIMIT};
  `
  try {
    const rows = db.prepare(textContent ? query2 : query1).all()

    res.json( rows );
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Failed to read database.' });
  }
});

// GET /api/v1/fileformats — returns all fileFormat in files
router.get('/files/formats', async (req, res) => {  
  const query = `
    SELECT distinct fileFormat
    FROM files
    WHERE fileFormat <> '' AND 
          CAST(CAST(fileFormat AS INTEGER) AS TEXT) <> fileFormat AND 
          LOWER(fileFormat) NOT LIKE '%tmp%' AND 
          LOWER(fileFormat) NOT LIKE '%rfc%'  
    ORDER BY fileFormat;
  `;
  try {
    const formats = db.prepare(query).all()

    res.json( formats );
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Failed to read database.' });
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

/*
  SELECT f.id, fileName, f.fullPath, f.fileSize, f.createdAt
  FROM files_fts AS fts
  JOIN files AS f ON fts.rowid = f.id
  WHERE fts.content MATCH 'address'
    AND f.isTextFile = 1;
 */