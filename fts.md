### Full-Text Search in SQLite: A Ritual Guide for dupFinder

#### I. Introduction

In the **dupFinder** project, the `files` table is a vessel of metadata — filenames, formats, hashes, and paths. But when users seek meaning — searching for fragments, formats, or phrases — traditional SQL queries fall short. This is where **SQLite’s Full-Text Search (FTS)** becomes a ritual of precision.

This guide explores:

- Why FTS matters in dupFinder  
- How to set it up using FTS5  
- How to query the `files` table with expressive clarity  
- How to integrate it into your Node.js backend using ES6 syntax  


#### II. Why Full-Text Search?

##### 1. Limitations of `LIKE`

```sql
SELECT * FROM files WHERE fileName LIKE '%report%';
```

- Slow on large datasets  
- No ranking or tokenization  
- No support for phrase or proximity search  

##### 2. FTS Advantages

- Tokenized indexing of text fields  
- Fast, ranked search results  
- Phrase, prefix, and proximity matching  
- Column-specific queries  

In dupFinder, this means users can search:

- `web + development`


#### III. Setting Up FTS5 in dupFinder

##### 1. Create the Virtual Table

Instead of modifying the existing `files` table, create a **mirror FTS table**:

```sql
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

CREATE VIRTUAL TABLE files_fts USING fts5(
  content,
  content='files',
  content_rowid='id'
);
```

This links `files_fts` to the `files` table, using `id` as the rowid.


##### 2. Populate the FTS Table

```sql
INSERT INTO files_fts(rowid, content)
SELECT id, content FROM files WHERE isTextFile = 1;
```

This indexes all existing records.


##### 3. Keep FTS in Sync

Use triggers to update `files_fts` when `files` changes:

```sql
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
```


#### IV. Querying the `files_fts` Table

```sql
SELECT f.id, fileName, f.fullPath, f.fileSize, f.createdAt
FROM files_fts AS fts
JOIN files AS f ON fts.rowid = f.id
WHERE fts.content MATCH 'address'
  AND f.isTextFile = 1;
```


#### V. Ranking Results

Use `bm25()` to rank by relevance:

```sql
SELECT f.id, fileName, f.fullPath, f.fileSize, f.createdAt, 
       bm25(files_fts) AS score
FROM files_fts AS fts
JOIN files AS f ON fts.rowid = f.id
WHERE fts.content MATCH 'address'
  AND f.isTextFile = 1;
ORDER BY bm25(files_fts)
```

> The built-in auxiliary function [bm25()](https://sqlite.org/fts5.html#the_bm25_function) returns a real value indicating how well the current row matches the full-text query. The better the match, the numerically smaller the value returned. 


#### VII. Symbolic Closure

In dupFinder, every file is a trace — a fragment of meaning. Full-text search is the ritual that lets users summon those fragments with intention. It’s not just about speed or syntax. It’s about honoring the breath of the archive.

FTS5 transforms your metadata into a living corpus — searchable, expressive, and precise. Each query is a gesture. Each result is a response.


#### VII. Bibliography 
1. [Modern Node.js Can Do That?](https://youtu.be/BKS4lDIhPaM)
2. [SQLite first impressions](https://youtu.be/C_il-JH9iJc)
3. [SQLite FTS5 Extension](https://sqlite.org/fts5.html)
4. [PRAGMA Statements](https://sqlite.org/pragma.html)
5. [sqlite-vec](https://github.com/asg017/sqlite-vec)
6. [better-sqlite3](https://www.npmjs.com/package/better-sqlite3)


### EOF (2025/10/31)
