import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { isText } from 'istextorbinary';

// 🔍 Check if file is hidden (starts with . or $)
export async function isHidden(filePath) {
  try {
    //const stats = await fs.lstat(filePath);
    const stats = fsSync.lstat(filePath);
    const name = path.basename(filePath);
    return name.startsWith('.') || (stats.mode & 0o100000 && name.startsWith('$'));
  } catch {
    return false;
  }
}

// 🔐 Generate SHA-256 hash of file contents
export async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Determines if a file is text-only using istextorbinary
export async function isTextFile (filePath) {
  try {
    const buffer = await readFile(filePath);
    return isText(filePath, buffer);
  } catch (error) {
    console.error(`Error checking file type for ${filePath}:`, error);
    return false;
  }
};


/**
 * Analyzes a file: returns its SHA-256 hash and whether it's text-only.
 * @param {string} filePath - Absolute path to the file.
 * @returns {Promise<{ hash: string, isText: boolean }>}
 */
// export async function analyzeFile (filePath) {
//   try {
//     // Check if file is text-only
//     const buffer = await readFile(filePath);
//     const isTextFile = isText(filePath, buffer);

//     // Generate SHA-256 hash
//     const hash = await new Promise((resolve, reject) => {
//       const sha = createHash('sha256');
//       const stream = createReadStream(filePath);
//       stream.on('data', chunk => sha.update(chunk));
//       stream.on('end', () => resolve(sha.digest('hex')));
//       stream.on('error', reject);
//     });

//     return { hash, isText: isTextFile };
//   } catch (error) {
//     console.error(`Error analyzing file ${filePath}:`, error);
//     return { hash: null, isText: false };
//   }
// };
/*
export async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
*/
export const analyzeFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    const sha = createHash('sha256');
    const firstChunks = [];
    let totalRead = 0;
    const maxBytes = 512;

    const stream = createReadStream(filePath);
    stream.on('data', chunk => {
      sha.update(chunk);

      if (totalRead < maxBytes) {
        const remaining = maxBytes - totalRead;
        firstChunks.push(chunk.slice(0, remaining));
        totalRead += chunk.length;
      }
    });

    stream.on('end', () => {
      const hash = sha.digest('hex');
      const buffer = Buffer.concat(firstChunks);
      //const isText = isTextSync(filePath, buffer);
      const isTextFile = isText(null, buffer);      
      // resolve({ hash, isText });
      const text = buffer.toString('utf8');
      resolve ({ 
        hash, 
        isTextFile, 
        content: isTextFile ? text : ''
      });
    });

    stream.on('error', err => {
      console.error(`Error analyzing file ${filePath}:`, err);
      resolve({ hash: null, isText: false });
    });
  });
};




// 🧭 Recursively walk through folder and yield file paths
export async function* walk(dir) {
  try {
    const dirHandle = await fs.opendir(dir);

    for await (const entry of dirHandle) {
      const fullPath = path.join(dir, entry.name);

      if (ignoreList.includes(entry.name)) {
        console.log(`🛡️ Ignored: ${fullPath}`);
        continue;
      }

      if (await isHidden(fullPath)) {
        console.log(`🛡️ Ignored hidden: ${fullPath}`);
        continue
      };

      try {
        const stat = await fs.lstat(fullPath);

        if (stat.isDirectory()) {
          yield* walk(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (ignoreExtensions.includes(ext)) {
            console.log(`🛡️ Ignored extension: ${fullPath}`);
            continue;
          }

          if (stat.size === 0) {
            console.log(`🛡️ Ignored empty file: ${fullPath}`);
            continue;
          }

          yield fullPath;
        }
      } catch (err) {
        console.error(`⚠️ Error accessing ${fullPath}:`, err.message);
        continue;
      }
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.warn(`🚫 Skipped protected folder: ${dir}`);
    } else {
      console.error(`⚠️ Error accessing ${dir}:`, err.message);
    }
  }
}


// 🛡️ Ignore list: folders/files to skip by name
export const ignoreList = [
  'node_modules', '__pycache__', '.git', '.svn', '.DS_Store',
  'Thumbs.db', 'desktop.ini', '$Recycle.Bin', 'System Volume Information', 'Program Files',
  'Program Files (x86)', 'Windows', 'AppData', 'Local Settings', 'Recovery',
  'PerfLogs', 'Temp', 'Tmp',  'cache', 'Cache', 
  '__MACOSX', '.Spotlight-V100', '.Trashes', 'ehthumbs.db', 'pagefile.sys',
  'hiberfil.sys', 'swapfile.sys', '.gitignore', '.gitattributes', 'index.html',
  '$RECYCLE.BIN', '.env', '.dockerignore'
];

// 🛡️ Ignore extensions: skip files with these suffixes
export const ignoreExtensions = [
  '.aof', '.incr.aof', '.tmp', '.dmp', '.log',
  '.dump', '.txt~', '.lnk', '.bak', '.swp', 
  '.DS_Store', 'desktop.ini', '.env', '.env.development', '.env.production'
];


// All used SQLs
export const SQL_create_table = `
    DROP TABLE IF EXISTS files;
    CREATE TABLE files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName VARCHAR(255) NOT NULL,
      fullPath VARCHAR(255) NOT NULL,
      fileFormat VARCHAR(16) NOT NULL,
      fileSize INTEGER NOT NULL,
      isTextFile INTEGER NOT NULL DEFAULT 0, 
      content text NOT NULL DEFAULT '',
      hash CHAR(64) NOT NULL,
      indexedAt VARCHAR(24) NOT NULL,
      createdAt VARCHAR(24) NOT NULL,
      modifiedAt VARCHAR(24) NOT NULL,
      updateIdent INTEGER NOT NULL DEFAULT 0,
      UNIQUE(fullPath)
    );

    DROP TABLE IF EXISTS audit;
    CREATE TABLE audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditKey   VARCHAR(128) NOT NULL,
      auditValue VARCHAR(128) NOT NULL,
      updateIdent INTEGER NOT NULL DEFAULT 0,
      UNIQUE(auditKey)
    );
    VACUUM;
  `;

export const SQL_insert = `
    INSERT INTO files (fileName, fullPath, fileFormat, fileSize, isTextFile, 
                       content, hash, indexedAt, createdAt, modifiedAt)
    VALUES (?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?)
  `;

export const SQL_update = `
    UPDATE files SET updateIdent = updateIdent + 1 WHERE fullPath = ?
  `;

export const SQL_create_table_fs = `
    DROP TABLE IF EXISTS files_fts;
    CREATE VIRTUAL TABLE files_fts USING fts5(
      content,
      content='files',
      content_rowid='id'
    );

    INSERT INTO files_fts(rowid, content)
    SELECT id, content FROM files WHERE isTextFile = 1;

    CREATE TRIGGER files_ai AFTER INSERT ON files
    WHEN new.isTextFile = 1
    BEGIN
      INSERT INTO files_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER files_au AFTER UPDATE ON files
    WHEN new.isTextFile = 1
    BEGIN
      UPDATE files_fts SET content = new.content WHERE rowid = new.id;
    END;

    CREATE TRIGGER files_ad AFTER DELETE ON files
    BEGIN
      DELETE FROM files_fts WHERE rowid = old.id;
    END;
`

export function writeAudit(db, key, value, flush = true) {
  const sql = `
    INSERT INTO audit (auditKey, auditValue)
    VALUES (?, ?)
  `;

  try {
    db.prepare(sql).run(key, value);
    console.log(`✅ Audit added: ${key} → ${value}`);

    if (flush) {
      db.exec('PRAGMA wal_checkpoint(FULL)');
      console.log('🧾 WAL checkpoint triggered — data flushed to disk.');
    }
  } catch (err) {
    console.error('❌ Failed to write audit entry:', err);
  }
}

export function removeDuplicates(input) {
  return [...new Set(
    input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  )].join(', ');
}
