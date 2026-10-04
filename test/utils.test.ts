import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, parseDuration } from '../src/utils.js';

test('parseDuration accepts seconds, minutes, hours, and days', () => {
  assert.equal(parseDuration('30s'), 30_000);
  assert.equal(parseDuration('5m'), 300_000);
  assert.equal(parseDuration('2h'), 7_200_000);
  assert.equal(parseDuration('1d'), 86_400_000);
});

test('parseDuration rejects invalid and unsafe durations', () => {
  assert.equal(parseDuration('0m'), null);
  assert.equal(parseDuration('2 weeks'), null);
  assert.equal(parseDuration('999999999999999999999d'), null);
});

test('calculate respects arithmetic precedence and parentheses', () => {
  assert.equal(calculate('(12 + 8) / 2'), 10);
  assert.equal(calculate('2 + 3 * 4'), 14);
  assert.equal(calculate('-5 + 12 % 5'), -3);
});

test('calculate rejects divide-by-zero and executable input', () => {
  assert.throws(() => calculate('5 / 0'), /divide by zero/i);
  assert.throws(() => calculate('process.exit()'));
});
