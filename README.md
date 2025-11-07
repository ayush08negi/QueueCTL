# QueueCTL

QueueCTL is a simple CLI-based background job queue system built with **Node.js**.  
It allows you to add shell commands as jobs, process them using worker processes, automatically retry failed jobs with exponential backoff, and manage a Dead Letter Queue (DLQ) for permanently failed tasks.  

All data is stored locally in JSON files — no external database is required.

---
## 1. Setup Instructions

### Requirements
- Node.js (v14 or above)
- npm installed

### Steps to Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/ayush08negi/QueueCTL.git
   cd QueueCTL
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the CLI help**
   ```bash
   node index.js --help
   ```

You’ll see a list of available commands.

---

## 2. Usage Examples

### Add (Enqueue) a Job
Now you can directly enqueue plain shell commands (no JSON required):
```bash
node index.js enqueue "echo Hello World"
```

Output:
```
[INFO] Enqueued job a1b2c3d4: echo Hello World
```

---

### Run a Worker (Foreground)
To process queued jobs:
```bash
node index.js worker run
```

Example output:
```
[Worker] Started and waiting for jobs...
[Worker] Running job a1b2c3d4: echo Hello World
[Worker] Job a1b2c3d4 succeeded: Hello World
[Worker] No jobs found, waiting...
```

Stop it anytime with **Ctrl + C** — the worker exits gracefully.

---

### Start or Stop Background Workers
Run multiple background workers:
```bash
node index.js worker start --count 3
```

Stop all running workers:
```bash
node index.js worker stop
```

---

### Check Queue Status
View summary of current jobs and DLQ:
```bash
node index.js status
```

Example:
```
Jobs in queue: 2 | DLQ: 1
```

---

### Manage Failed Jobs (DLQ)
When a job fails after maximum retries, it’s moved to the **Dead Letter Queue**.

List DLQ jobs:
```bash
node index.js dlq list
```

Retry a DLQ job:
```bash
node index.js dlq retry <jobId>
```

Clear all DLQ entries:
```bash
node index.js dlq clear
```

---

### Update Configuration
You can view or update retry and backoff values:

Check current config:
```bash
node index.js config get
```

Set configuration:
```bash
node index.js config set maxRetries 3
node index.js config set backoffBase 2
```

---

## 3. Architecture Overview

The system is designed around three main components — **jobs**, **workers**, and **storage**.

### Job Lifecycle
1. When you enqueue a job, it’s saved in `data/jobs.json`.
2. Workers continuously poll for jobs with status `"ready"`.
3. The worker executes each job using `child_process.exec()`.
4. On success → the job is removed from the queue.
5. On failure → it is retried after an exponential backoff delay.
6. After max retries → the job is moved to `data/dlq.json`.

---

### Data Persistence

All data is stored in JSON files (atomic writes for safety):

| File | Description |
|------|--------------|
| `jobs.json` | Active and pending jobs |
| `dlq.json` | Dead Letter Queue (failed jobs) |
| `config.json` | Retry and backoff configuration |
| `pids.json` | Worker process tracking |

---

### Worker Logic

- Polls jobs periodically and executes them safely.
- Uses simple file-based locking to prevent duplicate processing.
- Automatically retries failed jobs with exponential backoff:  
  `delay = backoffBase ^ retryCount`
- After exceeding retries, jobs are moved to DLQ.
- Graceful shutdown on **Ctrl + C** ensures current job finishes first.
- Uses atomic file writes to prevent data corruption (no partial JSON).

---

## 4. Assumptions & Trade-offs

- **File-based JSON storage** is used for simplicity and easy debugging (not for high-scale systems).
- **Polling mechanism** instead of event-driven approach — easier to understand, though less efficient.
- Designed for **single-machine operation** — distributed locks are not implemented.
- **Commands must be valid shell commands** for your OS.  
  Example (Windows): `echo Hello`  
  Example (Linux/Mac): `ls`, `sleep 2`
- Focused on clarity and correctness for demonstration.
