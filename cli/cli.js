const { Command } = require('commander');
const queue = require('../core/queue');
const worker = require('../core/worker');
const filestore = require('../utils/filestore');

function start() {
  const program = new Command();
  program.name('queuectl').description('CLI for queuectl job queue');

  // 🟢 Enqueue command (JSON or string)
  program
    .command('enqueue <job>')
    .description('Add a new job to the queue')
    .action(async (jobInput) => {
      try {
        let jobData;
        try {
          jobData = JSON.parse(jobInput); // allow JSON
        } catch {
          // fallback if just a command string
          jobData = { command: jobInput };
        }
        await queue.enqueue(jobData.command, jobData);
      } catch (err) {
        console.error('Failed to enqueue job:', err.message);
      }
    });

  // ⚙️ Worker commands
  const workerCmd = program.command('worker').description('Manage worker processes');

  // ✅ supports: queuectl worker start --count 3
  workerCmd
    .command('start')
    .description('Start one or more workers')
    .option('--count <n>', 'Number of workers to start', '1')
    .action(async (opts) => {
      const count = parseInt(opts.count, 10) || 1;
      for (let i = 0; i < count; i++) {
        await worker.startDetached();
      }
    });

  // run worker in foreground
  workerCmd
    .command('run')
    .description('Run worker in foreground (blocking)')
    .option('--id <id>', 'Worker ID')
    .action(async (opts) => {
      await worker.run(opts.id);
    });

  // stop workers
  workerCmd
    .command('stop')
    .description('Stop all running workers gracefully')
    .action(async () => {
      await worker.stopAll();
    });

  // 🧾 Status command
  program
    .command('status')
    .description('Show summary of all job states & active workers')
    .action(async () => {
      await queue.status();
    });

  // 📋 List jobs
  program
    .command('list')
    .description('List jobs (optionally by state)')
    .option('--state <state>', 'Filter by state')
    .action(async (opts) => {
      await queue.list(opts);
    });

  // ☠️ DLQ commands
  const dlq = program.command('dlq').description('Dead Letter Queue management');

  dlq
    .command('list')
    .description('List DLQ jobs')
    .action(async () => {
      await queue.dlqList();
    });

  dlq
    .command('retry <jobId>')
    .description('Retry a job from DLQ')
    .action(async (jobId) => {
      await queue.dlqRetry(jobId);
    });

  dlq
    .command('clear')
    .description('Clear DLQ')
    .action(async () => {
      await queue.dlqClear();
    });

  // ⚙️ Config commands
  const config = program.command('config').description('Manage configuration');

  config
    .command('set <key> <value>')
    .description('Set configuration value (e.g. maxRetries, backoffBase)')
    .action(async (key, value) => {
      await filestore.setConfig(key, Number(value));
    });

  config
    .command('get [key]')
    .description('Get configuration (or single key)')
    .action(async (key) => {
      await filestore.getConfig(key);
    });

  program.parse(process.argv);
  if (!process.argv.slice(2).length) program.outputHelp();
}

module.exports = { start };
