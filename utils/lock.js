const path = require('path');
const fs = require('fs-extra');
const LOCK_DIR = path.join(__dirname, '..', 'data', 'locks');

async function lockFor(id) {
  await fs.ensureDir(LOCK_DIR);
  const p = path.join(LOCK_DIR, id + '.lock');
  try { const fd = await fs.open(p, 'wx'); await fs.close(fd); return { path: p }; } catch { return null; }
}
async function unlock(lk) { if (lk) await fs.remove(lk.path); }
module.exports = { lockFor, unlock };