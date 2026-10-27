import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PAUBOX_API_KEY = 'test-key-not-logged';
process.env.CONTACT_EMAIL = 'contact@lifewellfhp.com';

const requests = [];
globalThis.fetch = async (url, init) => {
  requests.push({ url, init });
  return new Response(JSON.stringify({
    sourceTrackingId: 'test-source-tracking-id',
    data: 'Service OK',
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const { sendOutboundMail } = await import('../dist/services/email.service.js');

test('sends transactional email through Paubox with the fixed sender', async () => {
  const result = await sendOutboundMail({
    to: 'recipient@example.com',
    subject: 'Test subject',
    body: 'Test body',
  });

  assert.deepEqual(result, { delivered: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.paubox.com/v1/email/messages');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer test-key-not-logged');

  const payload = JSON.parse(requests[0].init.body);
  assert.equal(payload.data.message.headers.from, 'LifeWell Family Health & Psychiatry <contact@lifewellfhp.com>');
  assert.deepEqual(payload.data.message.recipients, ['recipient@example.com']);
  assert.equal(payload.data.message.headers.subject, 'Test subject');
});
