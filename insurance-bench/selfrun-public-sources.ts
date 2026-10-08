import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PublicSourceFile {
  key: string; path: string; url: string; sha256: string; bytes: number;
  kind: string; task?: string;
}
export interface PublicSourceReceipt {
  version: string; retrievedDate: string;
  commits: { harvey: string; legalbenchRepository: string; legalbenchDataset: string };
  selectionRule: string; files: PublicSourceFile[];
  legalbenchSelectedIds: string[]; harveyTasks: string[];
}
export interface PublicSelfRunTask {
  id: string; componentId: 'legal-agent' | 'legal-reasoning'; instruction: string;
  sourceTexts: { id: string; text: string }[];
  answerFormat: Record<string, string>;
  source: { name: string; commit: string; url: string; license: string;
    attribution: string; modificationNotice: string; inputSha256: Record<string, string> };
  criteriaCount?: number;
  /** Non-enumerable grading metadata: deliberately excluded from JSON and object spread. */
  expected?: Record<string, string>;
  rubric?: unknown;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PUBLIC_SOURCE_CACHE = resolve(moduleDir, '../.tmp/insurance-bench/selfrun-sources');
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export async function readPublicSourceReceipt(): Promise<PublicSourceReceipt> {
  return JSON.parse(await readFile(join(moduleDir, 'selfrun-source-receipt.json'), 'utf8')) as PublicSourceReceipt;
}

/** RFC-style quoted TSV parsing; preserving tabs/newlines inside fields matters for exact fixtures. */
export function parsePublicTsv(input: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"' && (quoted || field === '')) {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (c === '\t' || c === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (c === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed quoted TSV field');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift(); if (!headers) throw new Error('Empty TSV');
  return rows.map(values => {
    if (values.length !== headers.length) throw new Error('TSV column count mismatch');
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
  });
}

// No office application, external service, macro, or embedded object is executed. ZIP members
// are read in memory. The stdlib XML traversal explicitly distinguishes current and deleted text.
const EXTRACT_DOCUMENT = String.raw`
import sys, io, json, zipfile, re
import xml.etree.ElementTree as ET
from email.parser import BytesParser
from email.policy import default
from html.parser import HTMLParser
b=sys.stdin.buffer.read(); kind=sys.argv[1]; W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
class HTMLText(HTMLParser):
 def __init__(self): super().__init__(); self.parts=[]
 def handle_data(self,t): self.parts.append(t)
def current(n):
 if n.tag in [W+'del',W+'moveFrom']: return ''
 if n.tag==W+'t': return n.text or ''
 if n.tag==W+'tab': return '\t'
 if n.tag in [W+'br',W+'cr']: return '\n'
 return ''.join(current(c) for c in n)
if kind=='.docx':
 z=zipfile.ZipFile(io.BytesIO(b))
 if sum(i.file_size for i in z.infolist())>20*1024*1024: raise ValueError('DOCX expanded size exceeds limit')
 names=[n for n in z.namelist() if re.fullmatch(r'word/(document|header[0-9]*|footer[0-9]*|footnotes|endnotes|comments)\.xml',n)]
 if 'word/document.xml' not in names: raise ValueError('Missing DOCX document.xml')
 names=sorted(names,key=lambda n:(n!='word/document.xml',n)); sections=[]; tracked=False
 for name in names:
  root=ET.fromstring(z.read(name)); texts=[current(p) for p in root.iter(W+'p')]
  sections.append('['+name+']\n'+'\n'.join(t for t in texts if t.strip()))
  edits=[n for n in root.iter() if n.tag in [W+'ins',W+'del',W+'moveFrom',W+'moveTo']]
  tracked=tracked or bool(edits)
  deleted=[''.join(n.itertext()) for n in edits if n.tag in [W+'del',W+'moveFrom']]
  if deleted: sections.append('[NON-OPERATIVE TRACKED DELETED/MOVED-FROM TEXT]\n'+'\n'.join(deleted))
 if tracked: sections.insert(0,'[TRACKED CHANGE QUALIFICATION: current view retains insertions/moved-to text and excludes deletions/moved-from text. Deleted text is supplied separately as non-operative context; no Word rendering or legal validation was performed.]')
 print(json.dumps({'text':'\n\n'.join(sections),'hadTrackedChanges':tracked}))
elif kind=='.eml':
 msg=BytesParser(policy=default).parsebytes(b)
 plain=[]; html=[]
 for part in msg.walk():
  if part.is_multipart() or part.get_content_disposition()=='attachment': continue
  if part.get_content_type()=='text/plain': plain.append(part.get_content())
  elif part.get_content_type()=='text/html':
   p=HTMLText();p.feed(part.get_content());html.append(' '.join(p.parts))
 headers='\n'.join(k+': '+str(msg[k]) for k in ['From','To','Cc','Date','Subject'] if msg[k])
 body='\n\n'.join(plain or html)
 if not body.strip(): raise ValueError('No readable EML text body')
 print(json.dumps({'text':headers+'\n\n'+body,'hadTrackedChanges':False}))
else: raise ValueError('Unsupported public document format')
`;

export function extractPublicDocumentText(filename: string, bytes: Buffer): { text: string; hadTrackedChanges: boolean } {
  const extension = filename.toLowerCase().endsWith('.docx') ? '.docx'
    : filename.toLowerCase().endsWith('.eml') ? '.eml' : '';
  if (!extension) throw new Error(`Unsupported public document: ${filename}`);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Public document size exceeds limit');
  const result = execFileSync('python3', ['-c', EXTRACT_DOCUMENT, extension], {
    input: bytes, encoding: 'utf8', timeout: 15_000, maxBuffer: 24 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(result) as { text: string; hadTrackedChanges: boolean };
}

export function publicSelfRunTask(task: PublicSelfRunTask): Omit<PublicSelfRunTask, 'expected' | 'rubric'> {
  const { expected: _expected, rubric: _rubric, ...publicTask } = task;
  return publicTask;
}
export function serializePublicSelfRunTask(task: PublicSelfRunTask): string {
  return JSON.stringify(publicSelfRunTask(task));
}
function privateGrade<T extends PublicSelfRunTask>(task: T, metadata: { expected?: Record<string, string>; rubric?: unknown }): T {
  for (const [key, value] of Object.entries(metadata)) Object.defineProperty(task, key, {
    value, enumerable: false, writable: false, configurable: false,
  });
  return task;
}

async function frozenBytes(file: PublicSourceFile, cacheDir: string): Promise<Buffer> {
  const destination = resolve(cacheDir, file.path);
  if (!destination.startsWith(resolve(cacheDir) + '/')) throw new Error('Invalid source cache path');
  let bytes: Buffer;
  try { bytes = await readFile(destination); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const response = await fetch(file.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Public source fetch failed ${response.status}: ${file.key}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Public source integrity mismatch: ${file.key}`);
    await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes);
  }
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Public source integrity mismatch: ${file.key}`);
  return bytes;
}

/** Loads only hash-verified, pinned public fixtures; missing cache entries are fetched by exact URL. */
export async function loadPublicSelfRunTasks(cacheDir = DEFAULT_PUBLIC_SOURCE_CACHE): Promise<PublicSelfRunTask[]> {
  const receipt = await readPublicSourceReceipt();
  const files = new Map<string, Buffer>();
  for (const file of receipt.files) files.set(file.key, await frozenBytes(file, cacheDir));
  const text = (key: string) => {
    const bytes = files.get(key); if (!bytes) throw new Error(`Missing frozen source: ${key}`); return bytes.toString('utf8');
  };
  const hashes = (keys: string[]) => Object.fromEntries(keys.map(key => {
    const file = receipt.files.find(file => file.key === key); if (!file) throw new Error(`Missing receipt: ${key}`);
    return [key, file.sha256];
  }));
  const train = parsePublicTsv(text('legalbench/train.tsv'));
  if (train.length !== 5) throw new Error('LegalBench demonstration count changed');
  const prompt = text('legalbench/base_prompt.txt');
  for (const row of train) if (!prompt.includes(row.policy ?? '') || !prompt.includes(row.claim ?? '')) {
    throw new Error('Official LegalBench prompt does not contain frozen demonstrations');
  }
  const rows = parsePublicTsv(text('legalbench/test.tsv'));
  const selected = new Set(receipt.legalbenchSelectedIds);
  const selection = rows.filter(row => selected.has(row.index ?? ''));
  if (selection.length !== 18 || ['A', 'B', 'C'].some(label => selection.filter(row => row.answer === label).length !== 6)) {
    throw new Error('LegalBench frozen balanced selection invalid');
  }
  const tasks: PublicSelfRunTask[] = selection.map(row => privateGrade({
    id: `legalbench-insurance-policy-${row.index}`, componentId: 'legal-reasoning',
    instruction: prompt.replace('{{policy}}', row.policy ?? '').replace('{{claim}}', row.claim ?? '')
      + '\n\nReturn JSON with exactly one field: "label" containing A, B, or C. This is a sampled LegalBench task with the five official demonstrations.',
    sourceTexts: [{ id: `policy-${row.index}`, text: row.policy ?? '' }, { id: `claim-${row.index}`, text: row.claim ?? '' }],
    answerFormat: { label: 'A | B | C' },
    source: {
      name: 'LegalBench insurance_policy_interpretation balanced public subset', commit: receipt.commits.legalbenchDataset,
      url: `https://huggingface.co/datasets/nguha/legalbench/tree/${receipt.commits.legalbenchDataset}/data/insurance_policy_interpretation`,
      license: 'CC BY 4.0', attribution: 'LegalBench contributors Brandon Waldon, Zehua Li, Megan Ma; source Vague Contracts by Madigan Brodsky. https://creativecommons.org/licenses/by/4.0/',
      modificationNotice: `${receipt.selectionRule} Official five-shot prompt preserved; JSON answer-format instruction appended. Prompt repository commit ${receipt.commits.legalbenchRepository}. Crowd-derived ambiguity labels are not authoritative legal determinations.`,
      inputSha256: hashes(['legalbench/test.tsv', 'legalbench/train.tsv', 'legalbench/base_prompt.txt', 'legalbench/README.md']),
    },
  }, { expected: { label: row.answer ?? '' } }));
  for (const taskId of receipt.harveyTasks) {
    const taskKey = `harvey/${taskId}/task.json`;
    const native = JSON.parse(text(taskKey)) as { instructions: string; deliverables: Record<string, string>; criteria: unknown[] };
    const documents = receipt.files.filter(file => file.kind === 'harvey-document' && file.task === taskId);
    const artifactNames = Object.keys(native.deliverables);
    if (artifactNames.length !== 1 || !native.instructions || !native.criteria.length || !documents.length) throw new Error(`Unsupported LAB task: ${taskId}`);
    tasks.push(privateGrade({
      id: `harvey-lab-${taskId}`, componentId: 'legal-agent',
      instruction: native.instructions + '\n\nTEXT ARTIFACT ADAPTATION: Return JSON with "artifactName" set to the original requested deliverable filename and "documentText" containing its complete text. Input documents are deterministic text extractions; tracked changes, when present, distinguish current and non-operative text. This adapted subset uses custom blinded graders, not the native LAB harness or its standard dual-judge profile.',
      sourceTexts: documents.map(file => ({ id: file.path.split('/').at(-1) ?? file.path,
        text: extractPublicDocumentText(file.path, files.get(file.key)!).text })),
      answerFormat: { artifactName: artifactNames[0]!, documentText: 'Complete requested work product text' },
      criteriaCount: native.criteria.length,
      source: { name: 'Harvey LAB public insurance text-artifact adaptation', commit: receipt.commits.harvey,
        url: `https://github.com/harveyai/harvey-labs/tree/${receipt.commits.harvey}/tasks/${taskId}`,
        license: 'MIT', attribution: 'Copyright (c) 2026 Harvey AI. Full MIT notice retained in frozen harvey/LICENSE; source documents are synthetically generated under lawyer guidance/review per the official tutorial.',
        modificationNotice: 'DOCX/EML source files extracted to text; DOCX deliverable adapted to JSON documentText; custom blinded rubric grading replaces native tool harness and dual judges. No native full-LAB score is claimed.',
        inputSha256: hashes([taskKey, ...documents.map(file => file.key), 'harvey/LICENSE', 'harvey/docs/tutorial.md', 'harvey/docs/eval-strategies.md']),
      },
    }, { expected: { artifactName: artifactNames[0]! }, rubric: native.criteria }));
  }
  return tasks;
}
