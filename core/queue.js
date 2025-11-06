const { v4: uuidv4 } = require('uuid');
const filestore = require('../utils/filestore');
const logger = require('../utils/logger');


const now = () => Date.now();


async function enqueue(command) {
  try {
    const jobs = await filestore.read('jobs');
    const config = await filestore.read('config');

    const newJob = {
      id: uuidv4(),
      command,
      status: 'ready',
      retries: 0,
      maxRetries: config.maxRetries,
      backoffBase: config.backoffBase,
      nextAttempt: now(),
      createdAt: now()
    };

    jobs.push(newJob);
    await filestore.write('jobs', jobs);

    logger.info(`Enqueued job ${newJob.id}: ${command}`);
  } catch (err) {
    console.error('Failed to enqueue job:', err.message);
  }
}


async function list() {
  const jobs = await filestore.read('jobs');
  if (!jobs.length) {
    console.log('No jobs found.');
    return;
  }
  console.log(JSON.stringify(jobs, null, 2));
}


async function status() {
  const jobs = await filestore.read('jobs');
  const dlq = await filestore.read('dlq');

  console.log(`Jobs in queue: ${jobs.length} | DLQ: ${dlq.length}`);
}


async function dlqList() {
  const dlq = await filestore.read('dlq');
  if (!dlq.length) {
    console.log('DLQ is empty.');
    return;
  }
  console.log(JSON.stringify(dlq, null, 2));
}


async function dlqRetry(jobId) {
  const dlq = await filestore.read('dlq');
  const index = dlq.findIndex(j => j.id === jobId);

  if (index === -1) {
    console.log('Job not found in DLQ.');
    return;
  }

  const job = dlq.splice(index, 1)[0];
  job.status = 'ready';
  job.retries = 0;
  job.nextAttempt = now();

  const jobs = await filestore.read('jobs');
  jobs.push(job);

  await filestore.write('jobs', jobs);
  await filestore.write('dlq', dlq);

  console.log(`Moved job ${jobId} back to main queue.`);
}



async function dlqClear() {
  await filestore.write('dlq', []);
  console.log('DLQ cleared.');
}


module.exports = {
  enqueue,
  list,
  status,
  dlqList,
  dlqRetry,
  dlqClear
};
