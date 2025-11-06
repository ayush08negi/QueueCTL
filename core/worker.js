const { exec } = require('child_process');
const filestore = require('../utils/filestore');
const logger = require('../utils/logger');
const lock = require('../utils/lock');
const queue = require('./queue');

async function startDetached() {
  const { spawn } = require('child_process');
  const path = require('path');
  const workerScript = path.join(__dirname, '..', 'index.js');
  const child = spawn(process.execPath, [workerScript, 'worker', 'run'], { detached: true, stdio: 'ignore' });
  child.unref();
  const pids = await filestore.read('pids'); pids.push(child.pid);
  await filestore.write('pids', pids);
  logger.info(`Started worker pid=${child.pid}`);
}

async function stopAll() {
  const pids = await filestore.read('pids');
  for (const pid of pids) try { process.kill(pid); logger.info(`Stopped pid=${pid}`); } catch {}
  await filestore.write('pids', []);
}

async function run() {
  while (true) {
    const jobs = await filestore.read('jobs');
    const job = jobs.find(j => j.status === 'ready' && j.nextAttempt <= Date.now());
    if (!job) { await new Promise(r => setTimeout(r, 1000)); continue; }
    const lk = await lock.lockFor(job.id); if (!lk) continue;
    job.status = 'running'; await filestore.write('jobs', jobs);
    exec(job.command, async (err) => {
      if (err) {
        job.retries++; if (job.retries > job.maxRetries) {
          const dlq = await filestore.read('dlq'); dlq.push(job);
          await filestore.write('dlq', dlq);
          await filestore.write('jobs', jobs.filter(j => j.id !== job.id));
        } else {
          const delay = Math.pow(job.backoffBase, job.retries);
          job.nextAttempt = Date.now() + delay * 1000; job.status = 'ready';
          await filestore.write('jobs', jobs);
        }
      } else {
        await filestore.write('jobs', jobs.filter(j => j.id !== job.id));
      }
      await lock.unlock(lk);
    });
  }
}

module.exports = { startDetached, stopAll, run };