import { networkInterfaces } from 'node:os';

let failed = false;
const nodeMajor = Number(process.versions.node.split('.')[0]);
console.log(`Node version: ${process.version}`);
if (nodeMajor !== 24) {
  console.error('FAIL: Node 24 is required for the supported development environment.');
  failed = true;
}

try {
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('CREATE TABLE smoke_check (value INTEGER NOT NULL)');
    database.prepare('INSERT INTO smoke_check (value) VALUES (?)').run(1);
    const result = database.prepare('SELECT value FROM smoke_check').get();
    if (result.value !== 1) throw new Error('SQLite round trip failed.');
    const { version } = database.prepare('SELECT sqlite_version() AS version').get();
    console.log(`SQLite capability: available (${version}; in-memory write/read passed)`);
  } finally {
    database.close();
  }
} catch {
  console.error('FAIL: Built-in node:sqlite could not complete an in-memory write/read.');
  failed = true;
}

const addresses = [...new Set(Object.values(networkInterfaces()).flatMap(entries =>
  (entries || []).filter(entry => !entry.internal && (entry.family === 'IPv4' || entry.family === 4)).map(entry => entry.address)
))].sort();
console.log(`Available LAN IPv4 addresses: ${addresses.length ? addresses.join(', ') : 'none detected'}`);

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (configuredUrl) {
  try {
    const url = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol.');
    // Report only the origin so credentials, query strings and path tokens stay private.
    console.log(`Configured API origin: ${url.origin}`);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      console.log('Phone connection: use a reachable LAN address instead of the computer loopback address.');
    }
  } catch {
    console.error('FAIL: EXPO_PUBLIC_API_URL must be a valid HTTP or HTTPS URL. Its value was not printed.');
    failed = true;
  }
} else {
  console.log('Configured API origin: not set; set Server URL in the app or EXPO_PUBLIC_API_URL in .env.');
}

const configuredPort = Number(process.env.PORT || 3001);
const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535 ? configuredPort : 3001;
for (const address of addresses) console.log(`Phone API candidate: http://${address}:${port}`);
console.log(`AI key configured: ${Boolean(process.env.OPENAI_API_KEY?.trim())}`);
console.log('AI credentials and network reachability are not validated by this check. No provider request was sent.');
console.log(failed ? 'FAIL: Environment check failed.' : 'PASS: Node 24 and SQLite environment checks passed.');
process.exitCode = failed ? 1 : 0;
