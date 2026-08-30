/**
 * Security regression tests for admin/src/lib/videoEmbed.ts (P4-E3).
 *
 * Mirrors client/scripts/test-video-embed-security.mjs — admin/ has its
 * own independent copy of this logic (no shared package between the two
 * apps), so it needs its own independent verification. The old design
 * rendered an admin-supplied `embed_html` string via dangerouslySetInnerHTML
 * in the Admin video preview panel; that field has been removed from the
 * form and the schema entirely. This proves no malicious `url` value can
 * produce anything but the inert `{kind:'link', url:null}` fallback (or a
 * canonicalized, safely-encoded plain link).
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-video-embed-security.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeId,
  extractVimeoId,
  isSafeHttpsUrl,
  resolveVideoEmbed,
} from '../src/lib/videoEmbed.ts';

function assertInert(input, label) {
  const resolved = resolveVideoEmbed('embed', input);
  assert.equal(resolved.kind, 'link', `${label}: expected inert link fallback, got kind=${resolved.kind}`);
  assert.equal(resolved.url, null, `${label}: expected no href to be rendered from this input`);
  assert.equal(extractYouTubeId(input), null, `${label}: must not resolve as a YouTube id`);
  assert.equal(extractVimeoId(input), null, `${label}: must not resolve as a Vimeo id`);
  assert.equal(isSafeHttpsUrl(input), false, `${label}: must not be treated as a safe https URL`);
}

test('A. a raw <script> tag as the url input is fully inert', () => {
  assertInert('<script>alert(document.cookie)</script>', 'script tag');
});

test('B. an onerror handler payload is fully inert', () => {
  assertInert('<img src=x onerror=alert(1)>', 'onerror handler');
});

test('C. an onload handler payload is fully inert', () => {
  assertInert('<svg onload=alert(1)>', 'onload handler');
});

test('D. a javascript: URL is rejected outright', () => {
  assertInert('javascript:alert(document.cookie)', 'javascript: URL');
});

test('E. a data: URL is rejected outright', () => {
  assertInert('data:text/html,<script>alert(1)</script>', 'data: URL');
});

test('F. a blob: URL is rejected outright', () => {
  assertInert('blob:https://example.com/9a1e-fake-uuid', 'blob: URL');
});

test('G. a protocol-relative URL is rejected', () => {
  assertInert('//evil.example.com/embed/x', 'protocol-relative URL');
});

test('H. a hostile <iframe> string is fully inert', () => {
  assertInert('<iframe src="https://evil.example.com/steal"></iframe>', 'hostile iframe string');
});

test('I. mixed HTML appended to an otherwise-plausible URL never resolves as a video, and is never rendered raw', () => {
  const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>alert(1)</script>';
  assert.equal(extractYouTubeId(input), null);
  const resolved = resolveVideoEmbed('embed', input);
  assert.equal(resolved.kind, 'link');
  assert.ok(resolved.url, 'expected a canonicalized fallback link');
  assert.doesNotMatch(resolved.url, /[<>"]/, 'href value must never contain raw HTML-breaking characters');
});

test('J. a malformed, non-absolute string is rejected', () => {
  assertInert('not a url at all', 'malformed string');
  assertInert('', 'empty string');
});

test('K. an approved video URL still resolves correctly (positive control)', () => {
  assert.deepEqual(resolveVideoEmbed('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'), {
    kind: 'youtube',
    id: 'dQw4w9WgXcQ',
  });
  assert.deepEqual(resolveVideoEmbed('vimeo', 'https://vimeo.com/123456789'), {
    kind: 'vimeo',
    id: '123456789',
  });
});

test('L. a mislabeled provider cannot force an unsafe render', () => {
  const resolved = resolveVideoEmbed('youtube', '<script>alert(1)</script>');
  assert.equal(resolved.kind, 'link');
  assert.equal(resolved.url, null);
});

test('M. an http:// (non-https) URL is rejected', () => {
  assertInert('http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'non-https URL');
});
