/**
 * Pure unit tests for provider JSON-LD synchronization (P3-E1):
 * client/src/lib/schema.ts's providerNode()/providerPageGraph() now prefer
 * CMS-resolved provider data field-by-field, falling back to the static
 * record (client/src/data/provider.ts) per field.
 *
 * No network calls, no CMS, no production data.
 *
 *   npx tsx --test scripts/test-provider-schema.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { providerNode, providerPageGraph } from '../src/lib/schema.ts';
import { provider as staticProvider } from '../src/data/provider.ts';

test('A. providerNode with a full resolved provider uses CMS name/title/bio/credentials', () => {
  const resolved = {
    name: 'Jane Example',
    credentials: 'MD',
    title: 'Family Medicine Physician',
    bio: 'CMS bio paragraph one.\n\nCMS bio paragraph two.',
    photoUrl: '/images/cms-photo.jpg',
    certifications: ['MD — Board Certified'],
  };
  const node = providerNode(resolved);
  assert.equal(node.name, 'Jane Example, MD');
  assert.equal(node.jobTitle, 'Family Medicine Physician');
  assert.equal(node.description, 'CMS bio paragraph one.');
  assert.equal(node.image.url.includes('/images/cms-photo.jpg'), true);
  assert.deepEqual(
    node.hasCredential.map((c) => c.name),
    ['MD — Board Certified']
  );
});

test('B. providerNode with no argument uses the existing static provider fallback', () => {
  const node = providerNode();
  assert.equal(node.name, `${staticProvider.name}, ${staticProvider.credentials}`);
  assert.equal(node.jobTitle, staticProvider.role);
  assert.equal(node.description, staticProvider.bio[0]);
  assert.ok(node.image.url.includes(staticProvider.image.src));
  assert.deepEqual(
    node.hasCredential.map((c) => c.name),
    staticProvider.certifications
  );
});

test('B2. providerNode with undefined explicitly passed behaves the same as no argument', () => {
  const withArg = providerNode(undefined);
  const withoutArg = providerNode();
  assert.deepEqual(withArg, withoutArg);
});

test('B3. providerNode with null passed behaves the same as no argument (real mapProvider() return type)', () => {
  const withNull = providerNode(null);
  const withoutArg = providerNode();
  assert.deepEqual(withNull, withoutArg);
});

test('C. when a resolved field differs from the static value, the resolved (CMS) value wins', () => {
  const node = providerNode({ name: 'Updated Name', credentials: staticProvider.credentials });
  assert.equal(node.name, `Updated Name, ${staticProvider.credentials}`);
  assert.notEqual(node.name, `${staticProvider.name}, ${staticProvider.credentials}`);
});

test('D. a partially-filled resolved provider still produces complete, valid output (per-field fallback)', () => {
  // Only `name` is supplied — every other field must fall back to static,
  // not become undefined/null/broken.
  const node = providerNode({ name: 'Only Name Set' });
  assert.equal(node.name, `Only Name Set, ${staticProvider.credentials}`);
  assert.equal(node.jobTitle, staticProvider.role);
  assert.equal(node.description, staticProvider.bio[0]);
  assert.notEqual(node.jobTitle, undefined);
  assert.notEqual(node.description, undefined);
  assert.ok(Array.isArray(node.hasCredential) && node.hasCredential.length > 0);
  // Serialize to catch any stray `undefined` reaching the JSON-LD output.
  const serialized = JSON.stringify(node);
  assert.equal(serialized.includes('undefined'), false);
});

test('D2. an empty resolved certifications array falls back to static certifications rather than emitting an empty hasCredential list', () => {
  const node = providerNode({ certifications: [] });
  assert.deepEqual(
    node.hasCredential.map((c) => c.name),
    staticProvider.certifications
  );
});

test('E. no fragile extraction of years/DNP/certifications from bio prose', () => {
  // A resolved bio mentioning "15 years" and "DNP" must be used verbatim as
  // the description text — nothing should parse it into a derived field,
  // and no such field should appear on the node at all.
  const resolved = {
    bio: 'With more than 15 years of experience, I am currently pursuing my DNP.',
  };
  const node = providerNode(resolved);
  assert.equal(node.description, 'With more than 15 years of experience, I am currently pursuing my DNP.');
  assert.equal('yearsOfExperience' in node, false);
  assert.equal('dnpStatus' in node, false);
  assert.equal('yearsExperience' in node, false);
  // alumniOf must remain the static, non-parsed value regardless of bio content.
  assert.deepEqual(node.alumniOf, providerNode().alumniOf);
});

test('F. providerPageGraph passes resolved provider name/credentials through to its WebPage node', () => {
  const withResolved = providerPageGraph('A description', { name: 'Jane Example', credentials: 'MD' });
  const webPage = withResolved['@graph'].find((n) => n['@type'] === 'ProfilePage');
  assert.ok(webPage);
  assert.equal(webPage.name, 'Jane Example, MD');
});

test('F2. providerPageGraph without resolved data falls back to the static name/credentials', () => {
  const withoutResolved = providerPageGraph('A description');
  const webPage = withoutResolved['@graph'].find((n) => n['@type'] === 'ProfilePage');
  assert.equal(webPage.name, `${staticProvider.name}, ${staticProvider.credentials}`);
});

test('name splitting: a real two-token CMS name safely derives givenName/familyName', () => {
  const node = providerNode({ name: 'Jane Example' });
  assert.equal(node.givenName, 'Jane');
  assert.equal(node.familyName, 'Example');
});

test('name splitting: a name that is not exactly two tokens falls back to the static given/family values rather than guessing', () => {
  const oneToken = providerNode({ name: 'Cher' });
  assert.equal(oneToken.givenName, 'Lourdie');
  assert.equal(oneToken.familyName, 'Chachoute');

  const threeTokens = providerNode({ name: 'Mary Jane Watson' });
  assert.equal(threeTokens.givenName, 'Lourdie');
  assert.equal(threeTokens.familyName, 'Chachoute');
});

test('owner-approved facts are preserved end-to-end when no CMS override is supplied', () => {
  const node = providerNode();
  assert.ok(node.name.includes('Lourdie Chachoute'));
  assert.ok(node.name.includes('FNP-C'));
  assert.ok(node.name.includes('PMHNP-BC'));
  assert.ok(node.name.includes('RRT'));
  assert.ok(node.name.includes('CCRN'));
  assert.equal(node.jobTitle, 'Psychiatric-Mental Health Nurse Practitioner');
  assert.ok(staticProvider.bio.some((p) => p.includes('15 years')));
  assert.ok(staticProvider.education.some((e) => /DNP/.test(e) && /pursuing/i.test(e)));
});

test('a CMS certifications value that includes DNP-in-progress flows through, where the static-only list never did', () => {
  // The static `certifications` array (used for hasCredential) never
  // included DNP status — only the CMS record's certifications field does.
  // This documents that the synchronization actually adds real information
  // to JSON-LD when CMS data is available, not just relabels the same facts.
  assert.equal(
    staticProvider.certifications.some((c) => /DNP/.test(c)),
    false
  );
  const node = providerNode({
    certifications: ['Doctor of Nursing Practice (DNP) — University of Central Florida (in progress)'],
  });
  assert.ok(node.hasCredential.some((c) => /DNP/.test(c.name) && /in progress/i.test(c.name)));
});

test('a CMS credentials value ("APRN, FNP-C, PMHNP-BC, RRT, CCRN") is used verbatim, not merged with the static string', () => {
  // Documents a real, pre-existing drift this phase reduces: the static
  // fallback's credentials string ('FNP-C, PMHNP-BC, RRT, CCRN') omits
  // "APRN", which the CMS record (and the owner-approved formal display)
  // includes. When CMS data is available, its value must win outright.
  const node = providerNode({ credentials: 'APRN, FNP-C, PMHNP-BC, RRT, CCRN' });
  assert.ok(node.name.includes('APRN, FNP-C, PMHNP-BC, RRT, CCRN'));
});
