const { v4: uuidv4 } = require('uuid');
const filestore = require('../utils/filestore');
const logger = require('../utils/logger');

function now() { return Date.now(); }

async function enqueue(command) {
  const jobs = await filestore.read('jobs');
  const cfg = await filestore.read('config');
  const job = { id: uuidv4(), command, status: 'ready', retries: 0,
    maxRetries: cfg.maxRetries, backoffBase: cfg.backoffBase,
    nextAttempt: now(), createdAt: now() };
  jobs.push(job);
  await filestore.write('jobs', jobs);
  logger.info(`Enqueued job ${job.id}: ${command}`);
}

async function list() {
  console.log(JSON.stringify(await filestore.read('jobs'), null, 2));
}

async function status() {
  const jobs = await filestore.read('jobs');
  const dlq = await filestore.read('dlq');
  console.log('Jobs:', jobs.length, '| DLQ:', dlq.length);
}

async function dlqList() {
  console.log(JSON.stringify(await filestore.read('dlq'), null, 2));
}

async function dlqRetry(id) {
  const dlq = await filestore.read('dlq');
  const idx = dlq.findIndex(j => j.id === id);
  if (idx === -1) return console.log('Not found');
  const job = dlq.splice(idx, 1)[0];
  job.status = 'ready'; job.retries = 0; job.nextAttempt = now();
  const jobs = await filestore.read('jobs');
  jobs.push(job);
  await filestore.write('dlq', dlq); await filestore.write('jobs', jobs);
}

async function dlqClear() { await filestore.write('dlq', []); console.log('DLQ cleared'); }

module.exports = { enqueue, list, status, dlqList, dlqRetry, dlqClear };