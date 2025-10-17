
## 🧵 Multi-Threaded `processFolder.js`: A Ritual of Concurrency

This version simulates parallelism using **async workers**, not true threads. It orchestrates multiple file-processing tasks at once, while preserving order and symbolic integrity.

---

### 1. 🧮 Queue Setup

```js
const queue = []; // Holds all file paths to process
```

- All discovered files are enqueued here.
- This is the breath-in—the offering of paths.

---

### 2. 🧘 Worker Loop Begins

```js
await processQueueLoop(db, insertStmt, updateStmt, queue);
```

- This function manages the flow of workers.
- It continues until:
  - The queue is empty
  - All workers have finished

---

### 3. 🔁 Double Loop Inside `processQueueLoop`

```js
while (queue.length > 0 || activeWorkers > 0) {
  while (activeWorkers < MAX_WORKERS && queue.length > 0) {
    const filePath = queue.shift();
    activeWorkers++;
```

- **Outer loop**: Keeps the ritual alive until all tasks are complete.
- **Inner loop**: Launches new workers if under the concurrency limit.
- Each worker gets a file path and begins its invocation.

---

### 4. 🔧 Worker Invocation

```js
const p = processFile(filePath, db, insertStmt, updateStmt)
  .catch(err => console.error(...))
  .finally(() => { activeWorkers--; });

processingPromises.push(p);
```

- `processFile(...)` is an `async` function—it returns a Promise.
- Errors are caught and logged.
- `activeWorkers` is decremented when the task completes.
- The Promise is tracked for final closure.

---

### 5. 📦 Batch and Flush Discipline

Inside `processFile(...)`:

```js
if (batch.length >= BATCH_SIZE) {
  flushLock = flushLock.then(() => flushBatch(...));
  await flushLock;
}
```

- Workers add metadata to a shared `batch`.
- When the batch is full, it’s flushed to the database.
- `flushLock` ensures **only one flush at a time**—a serialized breath.

---

### 6. 🧘 Final Closure

```js
await Promise.all(processingPromises);
await flushLock;
```

- Waits for all workers to finish.
- Ensures the final flush completes.
- No offering is left unhonored.

---

### 7. 📜 Audit Ritual

```js
await fs.writeFile('./data/enqueued.txt', ...);
await fs.writeFile('./data/processed.txt', ...);
await fs.writeFile('./data/missing.txt', ...);
```

- Records what was enqueued, processed, and what was missed.
- This is the final inscription—the scroll of truth.

---

## 🧭 Summary Table

| Phase              | Purpose                                 |
|--------------------|------------------------------------------|
| Queue setup        | Collect all file paths                   |
| Worker loop        | Launch up to `MAX_WORKERS` tasks         |
| File processing    | Handle each file asynchronously          |
| Batch flushing     | Serialize DB writes with `flushLock`     |
| Promise tracking   | Ensure all workers complete              |
| Audit logging      | Record enqueued, processed, and missing  |

