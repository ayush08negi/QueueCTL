const { exec } = require('child_process');
const { spawn } = require('child_process');
const path = require('path');
const filestore = require('../utils/filestore');
const logger = require('../utils/logger');
const lock = require('../utils/lock');

let shouldStop = false;

async function startDetached() {
  try {
    const workerScript = path.join(__dirname, '..', 'index.js');
    const child = spawn(process.execPath, [workerScript, 'worker', 'run'], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    const pids = await filestore.read('pids');
    pids.push(child.pid);
    await filestore.write('pids', pids);

    logger.info(`Worker started in background with pid=${child.pid}`);
  } catch (err) {
    console.error('Error starting worker:', err.message);
  }
}

async function stopAll() {
  try {
    const pids = await filestore.read('pids');
    if (!pids.length) {
      console.log('No active workers running.');
      return;
    }

    for (const pid of pids) {
      try {
        process.kill(pid);
        logger.info(`Stopped worker pid=${pid}`);
      } catch (err) {
        console.log(`Failed to stop pid=${pid}: ${err.message}`);
      }
    }

    await filestore.write('pids', []);
  } catch (err) {
    console.error('Error stopping workers:', err.message);
  }
}

async function run() {
  console.log('[Worker] Started and waiting for jobs...');

  process.on('SIGINT', () => {
    shouldStop = true;
  });
  process.on('SIGTERM', () => {
    shouldStop = true;
  });

  while (!shouldStop) {
    const jobs = await filestore.read('jobs');
    const job = jobs.find(j => j.status === 'ready' && j.nextAttempt <= Date.now());

    if (!job) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const jobLock = await lock.lockFor(job.id);
    if (!jobLock) continue;

    job.status = 'running';
    await filestore.write('jobs', jobs);

    console.log(`[Worker] Running job ${job.id}: ${job.command}`);

    exec(job.command, async (err, stdout, stderr) => {
      if (err) {
        console.log(`[Worker] Job ${job.id} failed: ${stderr || err.message}`);

        job.retries++;

        if (job.retries > job.maxRetries) {
          console.log(`[Worker] Job ${job.id} moved to DLQ after ${job.maxRetries} retries.`);

          const dlq = await filestore.read('dlq');
          job.status = 'dlq';
          dlq.push(job);

          await filestore.write('dlq', dlq);
          await filestore.write('jobs', jobs.filter(j => j.id !== job.id));
        } else {
          const delay = Math.pow(job.backoffBase, job.retries);
          job.nextAttempt = Date.now() + delay * 1000;
          job.status = 'ready';
          await filestore.write('jobs', jobs);
          console.log(`[Worker] Retrying job ${job.id} in ${delay}s...`);
        }
      } else {
        const result = stdout ? stdout.trim() : '';
        console.log(`[Worker] Job ${job.id} succeeded: ${result}`);
        await filestore.write('jobs', jobs.filter(j => j.id !== job.id));
      }

      await lock.unlock(jobLock);
    });
  }

  console.log('[Worker] Shutting down gracefully.');
}

module.exports = { startDetached, stopAll, run };
