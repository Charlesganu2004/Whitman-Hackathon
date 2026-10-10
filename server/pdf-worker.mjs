import { getDocumentProxy } from 'unpdf';

const chunks = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > 4 * 1024 * 1024) throw new Error('PDF exceeds the 4 MB limit.');
  chunks.push(chunk);
}
const data = new Uint8Array(Buffer.concat(chunks));
if (Buffer.from(data.subarray(0, 5)).toString() !== '%PDF-') throw new Error('The file is not a valid PDF.');
const document = await getDocumentProxy(data, { useWasm: false, useWorkerFetch: false, enableXfa: false, useSystemFonts: false, disableFontFace: true, maxImageSize: 1_000_000, standardFontDataUrl: undefined, cMapUrl: undefined, wasmUrl: undefined, stopAtErrors: true });
if (document.numPages > 10) throw new Error('Resume PDFs must have at most 10 pages.');
const pages = [];
let length = 0;
for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
  length += Buffer.byteLength(text);
  if (length > 100_000) throw new Error('Extracted resume text exceeds the limit.');
  pages.push(text);
  page.cleanup();
}
// The short-lived process releases the parser after its output is flushed.
process.stdout.write(JSON.stringify({ text: pages.join('\n') }), () => process.exit(0));
