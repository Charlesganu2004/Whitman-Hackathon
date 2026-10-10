import test from 'node:test';
import assert from 'node:assert/strict';
import { extractResume } from '../server/resume.mjs';

function pdfFixture(pageCount, text) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  for (let index = 0; index < pageCount; index++) {
    const pageNumber = 4 + index * 2;
    const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNumber + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let result = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(result).toString('base64');
}

test('text-based PDF resumes extract in bounded subprocess', async () => {
  const body = { name: 'resume.pdf', mimeType: 'application/pdf', base64: pdfFixture(1, 'Student resume with JavaScript projects, research, teamwork and community volunteering.') };
  const result = await extractResume(body);
  assert.equal(result.name, 'resume.pdf');
  assert.match(result.text, /JavaScript projects/);
});

test('PDF page, readable-text and file-size limits reject unsupported resumes', async () => {
  await assert.rejects(extractResume({ name: 'long.pdf', mimeType: 'application/pdf', base64: pdfFixture(11, 'Resume text for a deliberately oversized page-count test.') }), /at most 10 pages/);
  await assert.rejects(extractResume({ name: 'scan.pdf', mimeType: 'application/pdf', base64: pdfFixture(1, '') }), /too little readable text/);
  await assert.rejects(extractResume({ name: 'large.pdf', mimeType: 'application/pdf', base64: Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64') }), /4 MB/);
});
