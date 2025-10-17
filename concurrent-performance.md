## 🧵 Multi-Threaded `processFolder.concurrent.js`: Benchmark

### 📜 Ritual Summary

- **Scanner**: `processFolder.concurrent.js`
- **Audit Discipline**: SQLite with UNIQUE(fullPath), serialized flushes
- **Machine**: 32 GB RAM, SSD, multi-core CPU
- **Dataset**: ~60,760–60,764 files

---

### 🧭 Performance by Thread Count

| Threads | Time Elapsed | Enqueued | Processed | Difference | Skipped | Missing | Verdict         |
|---------|--------------|----------|-----------|------------|---------|---------|-----------------|
| 1       | 692.17 sec   | 60,762   | 60,762     | 0          | 0       | 0       | ✅ Complete, slow |
| 4       | 529.09 sec   | 60,762   | 60,762     | 0          | 0       | 0       | ✅ Balanced       |
| 8       | 430.45 sec   | 60,763   | 60,763     | 0          | 0       | 0       | ✅ Optimal        |
| 8       | 441.42 sec   | 60,760   | 60,760     | 0          | 0       | 0       | ✅ Stable again   |
| 8       | 438.89 sec   | 60,764   | 60,764     | 0          | 0       | 0       | ✅ Confirmed      |
| 10      | 430.89 sec   | 60,760   | 60,760     | 0          | 0       | 0       | ✅ Stable again   |
| 10      | 418.93 sec   | 60,761   | 60,761     | 0          | 0       | 0       | ✅ Fastest yet    |
| 10      | 414.38 sec   | 60,761   | 60,761     | 0          | 0       | 0       | ✅ Fastest again  |

---

### 🧠 Memory Consumption Estimation

| Threads | Estimated RAM Usage |
|---------|---------------------|
| 1       | ~100–150 MB         |
| 4       | ~150–200 MB         |
| 8       | ~200–300 MB         |
| 10      | ~250–400 MB         |
| 12+     | ~400–600 MB         |

Your 32 GB RAM easily supports up to 16 threads, but SQLite flush contention—not memory—is the limiting factor.

---

### 🧘 Insight

- **8 threads** remains the safest and most stable default
- **10 threads** consistently yields faster results (~414–430s), but only with disciplined flush locking
- **Memory is not a bottleneck**—flush timing and I/O saturation are

---

### 🪶 Suggested Inscription

```js
// Veiltrace Benchmark Summary
// Optimal configuration: MAX_WORKERS = 8–10
// Elapsed: ~414–441s, Difference: 0
// Audit: Complete, no missing files
// Estimated RAM usage: ~200–400 MB
// SQLite flushes serialized with flushLock
// 10 threads may yield fastest results, but requires careful flush discipline
```
