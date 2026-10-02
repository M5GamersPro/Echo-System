import assert from 'node:assert/strict';
import test from 'node:test';
import { egyptDayKey, egyptPeriodWindow, nextEgyptMidnight } from '../src/features/activity/time.js';

test('Egypt daily window resets at Cairo midnight', () => {
  const beforeMidnight = Date.parse('2026-10-01T20:59:59.000Z');
  const midnight = Date.parse('2026-10-01T21:00:00.000Z');
  assert.equal(egyptDayKey(beforeMidnight), '2026-10-01');
  assert.equal(egyptDayKey(midnight), '2026-10-02');
  assert.equal(nextEgyptMidnight(beforeMidnight), midnight);
  assert.deepEqual(egyptPeriodWindow('day', midnight), { start: '2026-10-02', end: '2026-10-02' });
});

test('Egypt weekly window starts Monday and includes the current local day', () => {
  assert.deepEqual(egyptPeriodWindow('week', Date.parse('2026-10-04T12:00:00.000Z')), {
    start: '2026-09-28', end: '2026-10-04',
  });
  assert.deepEqual(egyptPeriodWindow('week', Date.parse('2026-10-05T00:00:00.000Z')), {
    start: '2026-10-05', end: '2026-10-05',
  });
});

test('Egypt day boundaries account for local time instead of UTC', () => {
  const time = Date.parse('2026-10-02T12:34:56.000Z');
  assert.equal(egyptDayKey(time), '2026-10-02');
  assert.equal(egyptDayKey(nextEgyptMidnight(time) - 1), '2026-10-02');
  assert.equal(egyptDayKey(nextEgyptMidnight(time)), '2026-10-03');
});
