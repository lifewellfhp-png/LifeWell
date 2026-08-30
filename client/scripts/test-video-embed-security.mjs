/**
 * Security regression tests for client/src/lib/videoEmbed.ts (P4-E3).
 *
 * The old design trusted an admin-supplied `embed_html` string, rendered
 * via dangerouslySetInnerHTML on both the admin preview AND the public
 * homepage/videos page. That field no longer exists anywhere in the write
 * or render path — the only remaining input is a `url` string, and this
 * suite proves no malicious value in that single input can ever produce
 * anything but the inert `{kind:'link', url:null}` fallback (or, for a
 * safe https URL that just isn't a recognized video host, a validated
 * plain link — never HTML, never a script-executing context).
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
  assertInert('JaVaScRiPt:alert(1)', 'javascript: URL (mixed case)');
});

test('E. a data: URL is rejected outright', () => {
  assertInert('data:text/html,<script>alert(1)</script>', 'data: URL');
});

test('F. a blob: URL is rejected outright', () => {
  assertInert('blob:https://example.com/9a1e-fake-uuid', 'blob: URL');
});

test('G. a protocol-relative URL is rejected (no scheme to validate)', () => {
  assertInert('//evil.example.com/embed/x', 'protocol-relative URL');
});

test('H. a hostile <iframe> string is fully inert', () => {
  assertInert('<iframe src="https://evil.example.com/steal"></iframe>', 'hostile iframe string');
});

test('I. mixed HTML appended to an otherwise-plausible URL never resolves as a video, and is never rendered raw', () => {
  const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>alert(1)</script>';
  // The garbage suffix corrupts the `v` param, so this must NOT resolve as
  // a YouTube embed (id-shape enforcement, not just host matching).
  assert.equal(extractYouTubeId(input), null);
  const resolved = resolveVideoEmbed('embed', input);
  assert.equal(resolved.kind, 'link');
  // It's still a well-formed https URL once the host is stripped of its
  // bogus query content, so an inert (never-executing) link is permitted —
  // same as any ordinary external link — but only in its canonicalized,
  // percent-encoded form. Raw '<', '>', '"' must never survive into the
  // value used as an href, since that's the literal string React sets as
  // the DOM attribute.
  assert.ok(resolved.url, 'expected a canonicalized fallback link');
  assert.doesNotMatch(resolved.url, /[<>"]/, 'href value must never contain raw HTML-breaking characters');
});

test('J. a malformed, non-absolute string is rejected', () => {
  assertInert('not a url at all', 'malformed string');
  assertInert('', 'empty string');
  assertInert('   ', 'whitespace-only string');
});

test('K. a plausible-looking but unapproved host is rejected as a video source', () => {
  const resolved = resolveVideoEmbed('embed', 'https://evil.example.com/embed/dQw4w9WgXcQ');
  assert.equal(resolved.kind, 'link');
  // Not a recognized video host, but it IS a well-formed https URL, so the
  // inert fallback is still allowed to link out to it (same as any
  // ordinary external link elsewhere on the site) — it just never becomes
  // an iframe/video source.
  assert.equal(resolved.url, 'https://evil.example.com/embed/dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://evil.example.com/embed/dQw4w9WgXcQ'), null);
});

test('L. an http:// (non-https) URL is rejected', () => {
  assertInert('http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'non-https URL');
});

test('M. approved: a standard YouTube watch URL resolves correctly', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  const resolved = resolveVideoEmbed('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.deepEqual(resolved, { kind: 'youtube', id: 'dQw4w9WgXcQ' });
});

test('N. approved: a youtu.be short URL resolves correctly', () => {
  assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('O. approved: a youtube.com/embed/ URL resolves correctly', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('P. approved: a vimeo.com URL resolves correctly', () => {
  assert.equal(extractVimeoId('https://vimeo.com/123456789'), '123456789');
  const resolved = resolveVideoEmbed('vimeo', 'https://vimeo.com/123456789');
  assert.deepEqual(resolved, { kind: 'vimeo', id: '123456789' });
});

test('Q. approved: a player.vimeo.com URL resolves correctly', () => {
  assert.equal(extractVimeoId('https://player.vimeo.com/video/123456789'), '123456789');
});

test('R. approved: a direct https video file URL resolves for the file provider', () => {
  const resolved = resolveVideoEmbed('file', 'https://lifewellfhp-client.vercel.app/video/example.mp4');
  assert.deepEqual(resolved, { kind: 'file', url: 'https://lifewellfhp-client.vercel.app/video/example.mp4' });
});

test('S. the file provider still rejects a non-https URL', () => {
  const resolved = resolveVideoEmbed('file', 'http://example.com/video.mp4');
  assert.equal(resolved.kind, 'link');
});

test('T. a YouTube-hostname URL with a garbage id does not resolve (id shape enforced)', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=<script>'), null);
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v='), null);
});

test('U. a Vimeo-hostname URL with a non-numeric id does not resolve (id shape enforced)', () => {
  assert.equal(extractVimeoId('https://vimeo.com/not-a-number'), null);
});

test('V. provider is a hint, not a trust boundary: a mislabeled provider cannot force an unsafe render', () => {
  // Even if provider says "youtube", a non-YouTube URL must not resolve as
  // a YouTube embed just because the field says so.
  const resolved = resolveVideoEmbed('youtube', '<script>alert(1)</script>');
  assert.equal(resolved.kind, 'link');
  assert.equal(resolved.url, null);
});
