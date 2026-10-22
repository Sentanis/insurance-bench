import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { analyticsBeforeSend } from '../scripts/web-analytics.ts';

test('analytics sends only reviewed public routes without URL data', () => {
  assert.deepEqual(analyticsBeforeSend({type: 'pageview', url: 'https://example.test/research.html?private=1#secret'}), {type: 'pageview', url: 'https://example.test/research.html'});
  assert.deepEqual(analyticsBeforeSend({type: 'pageview', url: 'https://example.test/private-id?query=1'}), {type: 'pageview', url: 'https://example.test/other'});
  assert.equal(analyticsBeforeSend({type: 'pageview', url: 'https://example.test/'}, 'https://outside.test/?private=1'), null);
  assert.equal(analyticsBeforeSend({type: 'event', url: 'https://example.test/'}), null);
  assert.equal(analyticsBeforeSend({type: 'pageview', url: 'invalid'}), null);
});

test('the build instruments every HTML page after verifying frozen publication', () => {
  execFileSync(process.execPath, ['scripts/build-site.mjs']);
  const files = readdirSync('dist', {recursive: true}).filter(file => String(file).endsWith('.html'));
  assert.equal(files.length, 4);
  for (const file of files) assert.match(readFileSync('dist/' + file, 'utf8'), /src="\/assets\/web-analytics.js"/);
  assert.match(readFileSync('dist/assets/web-analytics.js', 'utf8'), /_vercel\/insights\/script.js/);
});
