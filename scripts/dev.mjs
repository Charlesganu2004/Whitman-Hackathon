// Starts the API and Expo together, so a phone that scans the QR code can create an account straight away.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const port = Number(process.env.PORT || 3001);
const lan = Object.values(networkInterfaces()).flat().find(item => item && item.family === 'IPv4' && !item.internal)?.address;
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(code);
}

function start(name, args) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  child.on('exit', code => {
    if (stopping) return;
    console.error(`${name} stopped${code ? ` with exit code ${code}` : ''}.`);
    stop(code ?? 1);
  });
  children.push(child);
}

async function health() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await health();
    if (status) return status;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return null;
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

// The key file is ignored by git, so a fresh clone has none. Create it from the example so there is one obvious place to paste the key.
if (!existsSync('.env') && existsSync('.env.example')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example. Paste the team NVIDIA key after NVIDIA_API_KEY= and run this again for AI feedback.');
}

if (await health()) console.log(`API already running on port ${port}.`);
else start('API server', ['--env-file-if-exists=.env', 'server/index.mjs']);

const status = await waitForHealth();
if (!status) console.log('The API has not answered yet. If sign in fails on the phone, check the messages above.');
else if (status.gradingMode === 'ai') console.log(`AI feedback: on (${status.gradingProvider}). Voice transcription: ${status.speechAvailable ? `on (${status.speechProvider})` : 'off, typed answers and keyboard dictation still work'}.`);
else console.log('AI feedback: off, rubric practice is active. Add NVIDIA_API_KEY to .env on this computer to turn it on. See docs/NVIDIA.md.');

console.log(lan
  ? `Phones on this Wi-Fi reach the API at http://${lan}:${port}. The app finds it automatically in Expo Go.`
  : 'No Wi-Fi address found. Connect this computer to the same Wi-Fi as the phone.');

start('Expo', ['node_modules/expo/bin/cli', 'start', '--go', ...process.argv.slice(2)]);
