import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/work-summary.ts';

test('summary endpoint makes one uncached call, normalizes rows and sorts newest first', async () => {
  const original = globalThis.fetch;
  const oldUrl = process.env.POWER_AUTOMATE_GET_WORK_SUMMARY_URL;
  let calls = 0;
  const response: any = { code: 0, data: null, headers: {}, setHeader(key: string, value: string) { this.headers[key] = value; }, status(code: number) { this.code = code; return this; }, json(data: unknown) { this.data = data; return this; } };
  try {
    process.env.POWER_AUTOMATE_GET_WORK_SUMMARY_URL = 'https://example.invalid/summary';
    globalThis.fetch = async (_url, options) => {
      calls++;
      assert.equal(options?.method, 'POST');
      assert.equal(options?.cache, 'no-store');
      return Response.json({ value: [
        { cr1da_feederpolesection: ' A ', crf11_trimmingwork: 1, aiconfirmedenroachment: 2, modifiedon: '2026-10-15T00:00:00Z' },
        { poleId: 'A', trimmingWork: 0, aiConfirmedEncroachment: 'AI Correct - vegetation risk confirmed', modifiedOn: '2026-10-16T00:00:00Z' },
      ] });
    };
    await handler({ method: 'GET', query: { fresh: '1' } }, response);
    assert.equal(calls, 1);
    assert.equal(response.code, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.data[0].trimmingWork, 0);
    assert.equal(response.data[0].aiConfirmedEncroachment, 'AI Correct - vegetation risk confirmed');
    assert.equal(response.data[1].poleId, 'A');
    assert.equal(response.data[1].aiConfirmedEncroachment, 2);
    globalThis.fetch = async () => Response.json({ value: [], '@odata.nextLink': 'more' });
    await handler({ method: 'GET' }, response);
    assert.equal(response.code, 502);
    globalThis.fetch = async () => Response.json({ unexpected: [] });
    await handler({ method: 'GET' }, response);
    assert.equal(response.code, 502);
    delete process.env.POWER_AUTOMATE_GET_WORK_SUMMARY_URL;
    await handler({ method: 'GET' }, response);
    assert.equal(response.code, 503);
  } finally {
    globalThis.fetch = original;
    if (oldUrl === undefined) delete process.env.POWER_AUTOMATE_GET_WORK_SUMMARY_URL;
    else process.env.POWER_AUTOMATE_GET_WORK_SUMMARY_URL = oldUrl;
  }
});
