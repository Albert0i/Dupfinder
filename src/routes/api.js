import 'dotenv/config';
import express from 'express';
import { db } from '../sqlite.js'; // adjust path if needed

const router = express.Router();

// /api/v1/dashboard — returns dashboard metrics as JSON
router.get('/dashboard', async (req, res) => {
    try {
      const totalRow = await db.get('SELECT COUNT(*) AS totalFiles FROM files');
  
      const dupRow = await db.get(`
        SELECT COUNT(*) AS duplicateCount FROM (
          SELECT hash FROM files GROUP BY hash HAVING COUNT(*) > 1
        )
      `);
  
      const scanFolder = await db.get(`
        SELECT auditValue FROM audit WHERE auditKey='scanFolder'
      `);
  
      const scanAt = await db.get(`
        SELECT auditValue FROM audit WHERE auditKey='endTime'
      `);
  
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

// /api/v1/files/hash/:hash?limit=n — returns file metadata and content
router.get('/files/hash/:hash', async (req, res) => {
    const { hash } = req.params;
    const { limit } = req.query;
    const safeLimit = parseInt(limit) || process.env.MAX_LIMIT
    
    console.log('safeLimit =',safeLimit)
    try {
        if (safeLimit === 1) {
            const file = await db.get(`
                SELECT fileName, fullPath 
                FROM files 
                WHERE hash = ? 
                LIMIT 1`, [hash]);
            
            res.json(file);  
        } else { 
            const rows = await db.all(`
                SELECT * 
                FROM files 
                WHERE hash = ? 
                ORDER BY createdAt DESC
                LIMIT ${safeLimit}`, [hash]);
        
            res.json({ rows });
        }
    } catch (err) {
        console.error('View API error:', err);
        res.status(500).json({ error: 'Failed to read database.' });
    }
  });

  

// // 📁 /api/v1/files
// router.get('/v1/files/hash/:hash', async (req, res) => {
//   // await db logic here
// });

// router.get('/v1/files/id/:id', async (req, res) => {
//     // await db logic here
//   });
  

// 📜 /api/v1/audit
router.get('/v1/audit/:id', async (req, res) => {
  // await db logic here
});

export default router;

// if (safeLimit === 1) {
    //     // Single row 
    //     try {
    //         const file = await db.get(
    //           'SELECT fileName, fullPath FROM files WHERE hash = ? LIMIT 1',
    //           [hash]
    //         );
          
    //         res.json(file);
      
    //       } catch (err) {
    //         console.error('View API error:', err);
    //         res.status(500).json({ error: 'Failed to read database.' });
    //       }
    //  } else {
    //     // Multiple rows 
    //     try {
    //         const rows = await db.all(`
    //             SELECT * FROM files
    //             WHERE hash = ?
    //             ORDER BY createdAt DESC
    //           `, [hash]);          
        
    //         res.json({ rows });
    //       } catch (err) {
    //         console.error('View API error:', err);
    //         res.status(500).json({ error: 'Failed to read database.' });
    //       }
    //  }
