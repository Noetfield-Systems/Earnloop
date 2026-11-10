import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, nextState, summarizeWork } from '../src/company-os/generated/feature_41dabf588aa9.mjs';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';

test('legal transitions are allowed and illegal ones rejected', () => {
  assert.equal(canTransition('queued', 'running'), true);
  assert.equal(canTransition('completed', 'running'), false);
  assert.equal(nextState('awaiting_approval', 'queued'), 'queued');
  assert.throws(() => nextState('completed', 'queued'), /ILLEGAL_TRANSITION/);
});

test('summarizeWork counts states and computes rates', () => {
  const result = summarizeWork([
    { id: A, state: 'completed' },
    { id: B, state: 'blocked' },
    { id: C, state: 'queued' }
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.valid, 3);
  assert.equal(result.invalid, 0);
  assert.equal(result.counts.completed, 1);
  assert.equal(result.completionRate, 0.3333);
  assert.equal(result.blockedRate, 0.3333);
});

test('summarizeWork flags invalid entries and handles empty input', () => {
  const result = summarizeWork([
    { id: 'not-a-uuid', state: 'queued' },
    { id: A, state: 'unknown' },
    null
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.valid, 0);
  assert.equal(result.invalid, 3);
  assert.equal(result.completionRate, null);
  assert.throws(() => summarizeWork('nope'), /INVALID_INPUT/);
});
