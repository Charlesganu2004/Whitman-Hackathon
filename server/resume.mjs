import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../src/core/engine.ts';

let activeParsers = 0;
export function decodeBase64(value, maxBytes = 4 * 1024 * 1024) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(maxBytes * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new DomainError('The uploaded file is invalid or larger than 4 MB.');
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.length > maxBytes) throw new DomainError('The uploaded file is invalid or larger than 4 MB.');
  return buffer;
}

export async function extractResume(body) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 180) throw new DomainError('Provide a resume name of at most 180 characters.');
  let text;
  if (body.text !== undefined) {
    if (typeof body.text !== 'string') throw new DomainError('Resume text must be plain text.');
    text = body.text;
  } else {
    const buffer = decodeBase64(body.base64);
    if (body.mimeType === 'application/pdf') text = await extractPDF(buffer);
    else if (body.mimeType === 'text/plain' || /\.txt$/i.test(body.name)) text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    else throw new DomainError('Upload a TXT or text-based PDF resume, or paste its text. Other formats are not supported.');
  }
  text = text.replace(/\u0000/g, '').trim();
  if (text.length < 40) throw new DomainError('The resume has too little readable text. For a scanned PDF, paste its text instead.');
  if (text.length > 50_000) throw new DomainError('Resume text must contain at most 50,000 characters.');
  return { name: body.name.trim(), text };
}

function extractPDF(buffer) {
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new DomainError('The uploaded file is not a PDF.');
  if (activeParsers >= 2) throw new DomainError('Resume extraction is busy. Try again shortly.', 429);
  activeParsers++;
  return new Promise((resolve, reject) => {
    const worker = spawn(process.execPath, ['--disallow-code-generation-from-strings', '--max-old-space-size=128', fileURLToPath(new URL('./pdf-worker.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const output = [];
    let outputSize = 0;
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; worker.kill(); }, 8_000);
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeParsers--;
      if (error) reject(error); else resolve(value);
    };
    worker.stdout.on('data', chunk => {
      outputSize += chunk.length;
      if (outputSize > 120_000) { worker.kill(); finish(new DomainError('Extracted PDF text exceeds the limit.')); }
      else output.push(chunk);
    });
    worker.stderr.on('data', () => {});
    worker.stdin.on('error', () => {});
    worker.on('error', () => finish(new DomainError('PDF extraction could not start. Paste your resume text instead.', 503)));
    worker.on('close', code => {
      if (timedOut) return finish(new DomainError('PDF extraction timed out. Use a shorter PDF or paste its text.'));
      if (code !== 0) return finish(new DomainError('PDF extraction failed. Use a text-based PDF with at most 10 pages, or paste its text.'));
      try {
        const value = JSON.parse(Buffer.concat(output).toString('utf8'));
        if (typeof value.text !== 'string') throw new Error('Invalid PDF output.');
        finish(null, value.text);
      } catch { finish(new DomainError('PDF text could not be read. Paste your resume text instead.')); }
    });
    worker.stdin.end(buffer);
  });
}
