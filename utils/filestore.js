const path = require('path');
const fs = require('fs-extra');
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = {
  jobs: path.join(DATA_DIR, 'jobs.json'),
  workers: path.join(DATA_DIR, 'workers.json'),
  config: path.join(DATA_DIR, 'config.json'),
  dlq: path.join(DATA_DIR, 'dlq.json'),
  pids: path.join(DATA_DIR, 'pids.json')
};

async function ensure() {
  await fs.ensureDir(DATA_DIR);
  for (const [k, p] of Object.entries(FILES))
    if (!(await fs.pathExists(p))) await fs.writeJson(p, k === 'config' ? { maxRetries: 3, backoffBase: 2 } : []);
}

async function read(k) { await ensure(); return fs.readJson(FILES[k]); }
async function write(k, d) { await ensure(); await fs.writeJson(FILES[k], d, { spaces: 2 }); }
async function setConfig(k, v) { const c = await read('config'); c[k] = v; await write('config', c); }
async function getConfig(k) { const c = await read('config'); console.log(k ? c[k] : c); }

module.exports = { read, write, setConfig, getConfig };