import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_PUBLIC_SOURCE_CACHE, extractPublicDocumentText, loadPublicSelfRunTasks,
  parsePublicTsv, publicSelfRunTask, readPublicSourceReceipt, serializePublicSelfRunTask,
} from '../insurance-bench/selfrun-public-sources.ts';

const cacheReady = existsSync(join(DEFAULT_PUBLIC_SOURCE_CACHE, 'legalbench/test.tsv'))
  && existsSync(join(DEFAULT_PUBLIC_SOURCE_CACHE, 'harvey/insurance/extract-key-terms-from-reservation-of-rights-letter/task.json'));

test('public source receipt pins source revisions, licenses and deterministic row IDs', async () => {
  const receipt = await readPublicSourceReceipt();
  assert.equal(receipt.commits.harvey, 'f699603c5d121d8b64003bfdc5545e5c2d4dd12f');
  assert.equal(receipt.commits.legalbenchRepository, 'b46bf4ffae90524b2b72aaa30e7745fe9db64481');
  assert.equal(receipt.commits.legalbenchDataset, 'daec8237410aa23e3faf4bc41ad8b3a7e1696826');
  assert.deepEqual(receipt.legalbenchSelectedIds, ['0','1','2','3','4','5','6','7','8','9','10','11','12','14','15','17','19','25']);
  assert.equal(new Set(receipt.files.map(file => file.path)).size, receipt.files.length);
  for (const file of receipt.files) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(file.bytes > 0);
    assert.ok(!file.path.includes('..'));
    assert.ok(file.url.includes(file.key.startsWith('harvey/') ? receipt.commits.harvey
      : file.key.endsWith('.tsv') ? receipt.commits.legalbenchDataset : receipt.commits.legalbenchRepository));
  }
  assert.equal(receipt.harveyTasks.length, 3);
});

test('TSV parser retains quoted tabs, multiline fields, embedded quotes and CRLF', () => {
  assert.deepEqual(parsePublicTsv('index\ttext\tanswer\r\n0\t"a\tb\nsaid ""yes"""\tA\r\n'),
    [{ index: '0', text: 'a\tb\nsaid "yes"', answer: 'A' }]);
  assert.throws(() => parsePublicTsv('a\tb\n"unterminated'), /Unclosed/);
});

test('DOCX extraction separates current, inserted, deleted and moved text and includes headers', () => {
  const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Current </w:t></w:r><w:del><w:r><w:delText>obsolete 30 days</w:delText></w:r></w:del><w:ins><w:r><w:t>45 days</w:t></w:r></w:ins><w:moveFrom><w:r><w:t>old placement</w:t></w:r></w:moveFrom><w:moveTo><w:r><w:t> new placement</w:t></w:r></w:moveTo></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
  const bytes = execFileSync('python3', ['-c',
    'import sys,io,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); z.writestr("word/document.xml",sys.stdin.buffer.read()); z.writestr("word/header1.xml",\'<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Policy header</w:t></w:r></w:p></w:hdr>\'); z.close(); sys.stdout.buffer.write(b.getvalue())'], { input: xml });
  const result = extractPublicDocumentText('fixture.docx', bytes);
  assert.equal(result.hadTrackedChanges, true);
  const operative = result.text.split('[NON-OPERATIVE TRACKED DELETED/MOVED-FROM TEXT]')[0]!;
  assert.ok(operative.includes('Current 45 days new placement'));
  assert.ok(operative.includes('Table cell'));
  assert.ok(!operative.includes('obsolete 30 days'));
  assert.ok(!operative.includes('old placement'));
  assert.ok(result.text.includes('obsolete 30 days'));
  assert.ok(result.text.includes('Policy header'));
  assert.throws(() => extractPublicDocumentText('fixture.docx', Buffer.from('not a zip')));
  assert.throws(() => extractPublicDocumentText('fixture.pdf', Buffer.from('unsupported')), /Unsupported/);
});

test('EML extraction decodes MIME body and excludes attachments', () => {
  const message = 'From: sender@example.test\r\nSubject: Test source\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="boundary"\r\n\r\n--boundary\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\nQ292ZXJhZ2Ugbm90aWNlLg==\r\n--boundary\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="ignore.txt"\r\n\r\nattachment-only secret marker\r\n--boundary--\r\n';
  const result = extractPublicDocumentText('fixture.eml', Buffer.from(message));
  assert.ok(result.text.includes('Coverage notice.'));
  assert.ok(result.text.includes('Subject: Test source'));
  assert.ok(!result.text.includes('attachment-only secret marker'));
});

test('frozen public cache matches every receipt digest and declared licensing', { skip: !cacheReady }, async () => {
  const receipt = await readPublicSourceReceipt();
  for (const file of receipt.files) {
    const bytes = readFileSync(join(DEFAULT_PUBLIC_SOURCE_CACHE, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  assert.match(readFileSync(join(DEFAULT_PUBLIC_SOURCE_CACHE, 'legalbench/README.md'), 'utf8'), /CC By 4\.0/);
  assert.match(readFileSync(join(DEFAULT_PUBLIC_SOURCE_CACHE, 'harvey/LICENSE'), 'utf8'), /MIT License/);
});

test('actual tasks have balanced labels, five demonstrations and no grader metadata in actor serialization', { skip: !cacheReady }, async () => {
  const tasks = await loadPublicSelfRunTasks();
  assert.equal(tasks.length, 21);
  const legal = tasks.filter(task => task.componentId === 'legal-reasoning');
  assert.deepEqual(['A','B','C'].map(label => legal.filter(task => task.expected?.label === label).length), [6,6,6]);
  for (const task of legal) {
    assert.equal(task.source.license, 'CC BY 4.0');
    assert.equal((task.instruction.match(/^Label: [ABC]$/gm) ?? []).length, 5);
  }
  const lab = tasks.filter(task => task.componentId === 'legal-agent');
  assert.deepEqual(lab.map(task => task.criteriaCount), [38,39,40]);
  assert.deepEqual(lab.map(task => task.sourceTexts.length), [4,5,5]);
  for (const task of tasks) {
    assert.ok(task.expected);
    const publicTask = JSON.parse(serializePublicSelfRunTask(task));
    assert.ok(!Object.hasOwn(publicTask, 'expected'));
    assert.ok(!Object.hasOwn(publicTask, 'rubric'));
    assert.ok(!Object.hasOwn(publicSelfRunTask(task), 'rubric'));
    assert.ok(!Object.hasOwn(JSON.parse(JSON.stringify(task)), 'expected'));
    assert.ok(!Object.hasOwn(JSON.parse(JSON.stringify(task)), 'rubric'));
    if (task.rubric) {
      assert.ok(Array.isArray(task.rubric));
      const firstCriterion = (task.rubric as { match_criteria: string }[])[0]!;
      assert.ok(!serializePublicSelfRunTask(task).includes(firstCriterion.match_criteria));
    }
  }
});

test('loader rejects modified cache before any network retrieval', async () => {
  const receipt = await readPublicSourceReceipt(); const first = receipt.files[0]!;
  const temporary = mkdtempSync(join(tmpdir(), 'selfrun-public-tamper-'));
  try {
    mkdirSync(join(temporary, 'legalbench'), { recursive: true });
    writeFileSync(join(temporary, first.path), 'tampered');
    await assert.rejects(loadPublicSelfRunTasks(temporary), /integrity mismatch/);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
