const fs = require('fs-extra');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

async function read(name) {
  try {
    const file = path.join(dataDir, `${name}.json`);
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function write(name, data) {
  const file = path.join(dataDir, `${name}.json`);
  const tempFile = file + '.tmp';

  try {
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempFile, file);
  } catch (err) {
    console.error(`Error writing to ${file}:`, err);
  }
}

module.exports = { read, write };
