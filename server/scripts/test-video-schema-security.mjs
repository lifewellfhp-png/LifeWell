/**
 * Security regression tests for videoCreate/videoUpdate
 * (server/src/validation/adminSchemas.ts) — P4-E3.
 *
 * Two things must both be true:
 *   1. `embed_html` is no longer part of the schema at all, so Zod's
 *      default (non-strict) object parsing silently drops it from
 *      `parsed.data` — and crudFactory.ts inserts/updates using ONLY
 *      `parsed.data` (see server/src/routes/crudFactory.ts:88,120-123),
 *      never the raw request body — meaning a submitted embed_html value
 *      can never reach the database via this endpoint, full stop, with no
 *      sanitization logic involved.
 *   2. `url` is validated server-side (not just client-side) against the
 *      same https-only rule the render-time code enforces — defense in
 *      depth, not a single point of failure.
 *
 * No network calls, no Supabase, no production data. Does not import
 * anything that touches ADMIN_JWT_SECRET, so no env var is required.
 *
 *   npx tsx --test scripts/test-video-schema-security.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { videoCreate, videoUpdate } from '../src/validation/adminSchemas.js';

const validBase = { title: 'A Video', provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };

test('A. a valid payload with an https URL is accepted', () => {
  const result = videoCreate.safeParse(validBase);
  assert.equal(result.success, true);
});

test('B. embed_html is silently stripped from parsed output, even if submitted', () => {
  const result = videoCreate.safeParse({ ...validBase, embed_html: '<script>alert(1)</script>' });
  assert.equal(result.success, true);
  assert.equal('embed_html' in result.data, false, 'embed_html must not appear in parsed.data at all');
});

test('C. embed_html alone (no url) is no longer sufficient to create a video', () => {
  const result = videoCreate.safeParse({
    title: 'A Video',
    provider: 'embed',
    embed_html: '<iframe src="https://legit.example.com"></iframe>',
  });
  assert.equal(result.success, false, 'a video with only embed_html and no url must be rejected');
});

test('D. a javascript: URL is rejected server-side', () => {
  const result = videoCreate.safeParse({ ...validBase, url: 'javascript:alert(1)' });
  assert.equal(result.success, false);
});

test('E. a data: URL is rejected server-side', () => {
  const result = videoCreate.safeParse({ ...validBase, url: 'data:text/html,<script>alert(1)</script>' });
  assert.equal(result.success, false);
});

test('F. a blob: URL is rejected server-side', () => {
  const result = videoCreate.safeParse({ ...validBase, url: 'blob:https://example.com/fake' });
  assert.equal(result.success, false);
});

test('G. a protocol-relative URL is rejected server-side', () => {
  const result = videoCreate.safeParse({ ...validBase, url: '//evil.example.com/x' });
  assert.equal(result.success, false);
});

test('H. a malformed URL is rejected server-side', () => {
  const result = videoCreate.safeParse({ ...validBase, url: 'not a url at all' });
  assert.equal(result.success, false);
});

test('I. an http:// (non-https) URL is rejected server-side', () => {
  const result = videoCreate.safeParse({ ...validBase, url: 'http://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.equal(result.success, false);
});

test('J. thumbnail_url is validated the same way (javascript: rejected)', () => {
  const result = videoCreate.safeParse({ ...validBase, thumbnail_url: 'javascript:alert(1)' });
  assert.equal(result.success, false);
});

test('K. thumbnail_url accepts a plain empty string (optional field)', () => {
  const result = videoCreate.safeParse({ ...validBase, thumbnail_url: '' });
  assert.equal(result.success, true);
});

test('L. videoUpdate (partial) also strips embed_html', () => {
  const result = videoUpdate.safeParse({ embed_html: '<script>alert(1)</script>', title: 'Renamed' });
  assert.equal(result.success, true);
  assert.equal('embed_html' in result.data, false);
});

test('M. videoUpdate also rejects an unsafe url when one is submitted', () => {
  const result = videoUpdate.safeParse({ url: 'javascript:alert(1)' });
  assert.equal(result.success, false);
});

test('N. a legitimate Vimeo URL passes server-side validation', () => {
  const result = videoCreate.safeParse({ title: 'Vimeo Video', provider: 'vimeo', url: 'https://vimeo.com/123456789' });
  assert.equal(result.success, true);
});
