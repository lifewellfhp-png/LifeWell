/**
 * Pure regression tests for the homepage Benefits item editor added to
 * admin/src/components/HomepageCopy.tsx.
 *
 * No network calls, no CMS, no production data, no React rendering — this
 * mirrors the exact load-time and save-time transformations from
 * HomepageCopy.tsx's load() and onSubmit() (same pattern as
 * test-stats-reset-safety.mjs's simulateReset()), since those functions are
 * closures inside the component and aren't themselves exported.
 *
 *   npx tsx --test scripts/test-benefits-item-editor.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
  join(__dirname, '../src/components/HomepageCopy.tsx'),
  'utf8'
);

/** Mirrors the load()'s benefitsRow → benefitItems transform. */
function simulateLoad(rawItems) {
  return rawItems.map((item) => {
    const row = item && typeof item === 'object' ? item : {};
    return {
      title: typeof row.title === 'string' ? row.title : '',
      description: typeof row.description === 'string' ? row.description : '',
      image: typeof row.image === 'string' ? row.image : '',
      raw: row,
    };
  });
}

/** Mirrors the onSubmit()'s benefitItems → outgoing content.items transform. */
function simulateSave(benefitItems) {
  return benefitItems.map((b) => ({ ...b.raw, title: b.title, description: b.description, image: b.image }));
}

/** A fixture matching the real Production home:benefits record's shape. */
const liveFixture = [
  {
    title: 'Personalized One-on-One Care',
    description: 'Every patient receives individual attention and a treatment plan tailored to their unique needs, goals, and mental health journey.',
    image: '/images/benefits/Personalized-One-on-One-Care.avif',
  },
  {
    title: 'Private & Secure Telehealth Sessions',
    description: 'All appointments are conducted through our telehealth platform, designed with your privacy and confidentiality in mind at every step.',
    image: '/images/benefits/Private-Secure-Telehealth-Sessions.avif',
  },
  {
    title: 'Flexible & Convenient Scheduling',
    description: 'Book appointments that fit your lifestyle with easy online scheduling and virtual access from the comfort of your home.',
    image: '/images/benefits/Flexible-Convenient-Scheduling.avif',
  },
  {
    title: 'Compassionate, Judgment-Free Support',
    description: 'I provide a safe and supportive environment where you can openly discuss your concerns without fear of stigma or judgment.',
    image: '/images/benefits/Compassionate-Judgment-Free-Support.avif',
  },
  {
    title: 'Evidence-Based Treatment Approach',
    description: 'My care is guided by my clinical experience and evidence-based treatment methods, allowing me to provide effective, compassionate, and personalized mental health support.',
    image: '/images/benefits/Evidence-Based-Treatment-Approach.avif',
  },
];

test('1. existing Benefits items populate into the friendly form', () => {
  const loaded = simulateLoad(liveFixture);
  assert.equal(loaded.length, 5);
  assert.equal(loaded[3].title, 'Compassionate, Judgment-Free Support');
  assert.equal(loaded[3].description, 'I provide a safe and supportive environment where you can openly discuss your concerns without fear of stigma or judgment.');
  assert.equal(loaded[4].description, 'My care is guided by my clinical experience and evidence-based treatment methods, allowing me to provide effective, compassionate, and personalized mental health support.');
});

test('2. editing a benefit title/description updates the outgoing content', () => {
  const loaded = simulateLoad(liveFixture);
  loaded[3] = {
    ...loaded[3],
    title: 'Compassionate, Judgment-Free Support',
    description: 'We provide a safe and supportive environment where you can openly discuss your concerns without fear of stigma or judgment.',
  };
  const saved = simulateSave(loaded);
  assert.equal(saved[3].description, 'We provide a safe and supportive environment where you can openly discuss your concerns without fear of stigma or judgment.');
  assert.doesNotMatch(saved[3].description, /^I provide/);
});

test('3. an unknown item field and the image field survive an edit untouched', () => {
  const fixtureWithExtra = liveFixture.map((item, i) =>
    i === 3 ? { ...item, badge: 'featured', sort_hint: 2 } : item
  );
  const loaded = simulateLoad(fixtureWithExtra);
  loaded[3] = { ...loaded[3], description: 'edited description' };
  const saved = simulateSave(loaded);
  assert.equal(saved[3].image, '/images/benefits/Compassionate-Judgment-Free-Support.avif');
  assert.equal(saved[3].badge, 'featured');
  assert.equal(saved[3].sort_hint, 2);
  assert.equal(saved[3].description, 'edited description');
});

test('4. other Benefits items remain unchanged when one is edited', () => {
  const loaded = simulateLoad(liveFixture);
  loaded[3] = { ...loaded[3], description: 'edited description' };
  const saved = simulateSave(loaded);
  for (const i of [0, 1, 2, 4]) {
    assert.equal(saved[i].title, liveFixture[i].title);
    assert.equal(saved[i].description, liveFixture[i].description);
    assert.equal(saved[i].image, liveFixture[i].image);
  }
});

test('5. item order is preserved end to end', () => {
  const loaded = simulateLoad(liveFixture);
  const saved = simulateSave(loaded);
  assert.deepEqual(
    saved.map((s) => s.title),
    liveFixture.map((f) => f.title)
  );
});

test('6. the outgoing Benefits save call still sends both heading and items (full content, not a partial overwrite)', () => {
  const benefitsCallStart = componentSource.indexOf("saveSection(ids.benefits");
  assert.ok(benefitsCallStart >= 0, 'expected a saveSection(ids.benefits ...) call');
  const benefitsCallSlice = componentSource.slice(benefitsCallStart, benefitsCallStart + 300);
  assert.match(benefitsCallSlice, /heading:\s*benefitsHeading/);
  assert.match(benefitsCallSlice, /items:\s*benefitItems\.map/);
});

test('7. every other homepage section is still saved unmodified by this change', () => {
  for (const key of ['hero', 'welcome', 'services', 'how_it_works', 'stats']) {
    assert.match(
      componentSource,
      new RegExp(`saveSection\\(ids\\.${key} `),
      `expected saveSection(ids.${key} ...) to still be called`
    );
  }
});

test('8. the outdated "stays in raw JSON" Benefits guidance was removed', () => {
  assert.doesNotMatch(componentSource, /Individual benefit cards stay in Homepage sections JSON/);
});
