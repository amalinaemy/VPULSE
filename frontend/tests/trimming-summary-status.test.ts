import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTrimmingStatus, dashboardTrimmingStatus } from '../src/services/trimmingWork.ts';

test('configured numeric choices and exact labels map without guessing unknown values', () => {
  for (const [value, status] of [[0, 'Completed'], ['0', 'Completed'], [1, 'N/A'], ['1', 'N/A'], [' N/A ', 'N/A'], ['In Progress', 'N/A'], ['2', 'Not Started'], [' Completed ', 'Completed'], ['Pending', 'Pending']] as const) {
    assert.equal(getTrimmingStatus(value), status);
  }
  for (const value of [null, undefined, '', ' ', 3, 999, 'unrecognized', 'incomplete']) {
    assert.equal(getTrimmingStatus(value), null);
  }
});

test('missing records become Pending only after successful loading; invalid saved choices stay Unknown', () => {
  assert.equal(dashboardTrimmingStatus(false, undefined, true, false), 'Loading');
  assert.equal(dashboardTrimmingStatus(false, undefined, false, true), 'Unavailable');
  assert.equal(dashboardTrimmingStatus(true, 0, true, false), 'Loading');
  assert.equal(dashboardTrimmingStatus(true, 0, false, true), 'Unavailable');
  assert.equal(dashboardTrimmingStatus(false, undefined, false, false), 'Pending');
  assert.equal(dashboardTrimmingStatus(true, null, false, false), 'Unknown');
  assert.equal(dashboardTrimmingStatus(true, 99, false, false), 'Unknown');
  assert.equal(dashboardTrimmingStatus(true, 0, false, false), 'Completed');
});

test('each loaded candidate belongs to exactly one status including missing and unknown records', () => {
  const records = new Map<string, string | number | null>([['A', 0], ['B', 1], ['C', 2], ['D', null], ['E', 99]]);
  const counts: Record<string, number> = {};
  for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const status = dashboardTrimmingStatus(records.has(id), records.get(id), false, false);
    counts[status] = (counts[status] ?? 0) + 1;
  }
  assert.deepEqual(counts, { Completed: 1, 'N/A': 1, 'Not Started': 1, Unknown: 2, Pending: 1 });
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 6);
});


test('N/A remains separate from Completed and Pending in dashboard summaries', () => {
  assert.equal(dashboardTrimmingStatus(true, 1, false, false), 'N/A');
  assert.equal(dashboardTrimmingStatus(true, 'N/A', false, false), 'N/A');
});
