import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

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
  'hiberfil.sys', 'swapfile.sys', '.gitignore', '.gitattributes'
];

// 🛡️ Ignore extensions: skip files with these suffixes
export const ignoreExtensions = [
  '.aof', '.incr.aof', '.tmp', '.dmp', '.log'
];


// All used SQLs
export const SQL_create_table = `
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName VARCHAR(255) NOT NULL,
      fullPath VARCHAR(255) NOT NULL,
      fileFormat VARCHAR(16) NOT NULL,
      fileSize INTEGER NOT NULL,
      description text NOT NULL DEFAULT '',
      hash CHAR(64) NOT NULL,
      indexedAt VARCHAR(24) NOT NULL,
      createdAt VARCHAR(24) NOT NULL,
      modifiedAt VARCHAR(24) NOT NULL,
      updateIdent INTEGER NOT NULL DEFAULT 0,
      UNIQUE(fullPath)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditKey   VARCHAR(128) NOT NULL,
      auditValue VARCHAR(128) NOT NULL,
      updateIdent INTEGER NOT NULL DEFAULT 0,
      UNIQUE(auditKey)
    );
    DELETE FROM files; 
    DELETE FROM sqlite_sequence WHERE name='files';
    DELETE FROM audit; 
    DELETE FROM sqlite_sequence WHERE name='audit';
    VACUUM;
  `;

export const SQL_insert = `
    INSERT INTO files (fileName, fullPath, fileFormat, fileSize, hash, indexedAt, createdAt, modifiedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

export const SQL_update = `
    UPDATE files SET updateIdent = updateIdent + 1 WHERE fullPath = ?
  `;


export async function writeAudit(db, key, value, flush = true) {
  const sql = `
    INSERT INTO audit (auditKey, auditValue)
    VALUES (?, ?)
  `;

  try {
    await db.run(sql, [key, value]);
    console.log(`✅ Audit added: ${key} → ${value}`);

    if (flush) {
      // Optional: force WAL checkpoint to flush changes to disk
      await db.run('PRAGMA wal_checkpoint(FULL)');
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
