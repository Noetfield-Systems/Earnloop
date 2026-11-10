import test from 'node:test';
import assert from 'node:assert/strict';
import { overview } from '../src/company-os/engine.mjs';

const ID1 = '11111111-1111-1111-1111-111111111111';
const ID2 = '22222222-2222-2222-2222-222222222222';

test('live Company OS overview exposes real, source-derived work-state metrics', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT\n  (SELECT COUNT(*)')) {
        return { rows: [{
          members: 0, waitlist: 0, activated: 0, community_xp: 0,
          referrals: 0, reported_events: 0, settled_events: 0,
          settled_gross_cents: 0, settled_reward_liability_cents: 0
        }] };
      }
      if (sql.includes('FROM earnloop_os_work ORDER BY')) {
        return { rows: [{ id: ID1, type: 'snapshot_metrics', state: 'queued' },
                        { id: ID2, type: 'growth_diagnosis', state: 'completed' }] };
      }
      if (sql.includes('FROM earnloop_os_receipts ORDER BY')) {
        return { rows: [] };
      }
      throw new Error('Unexpected database query');
    }
  };
  const snapshot = await overview(pool);
  assert.equal(snapshot.company_os, 'dedicated');
  assert.equal(snapshot.work_state_summary.total, 2);
  assert.equal(snapshot.work_state_summary.valid, 2);
  assert.equal(snapshot.work_state_summary.counts.completed, 1);
  assert.equal(snapshot.work_state_summary.completionRate, 0.5);
  assert.equal(snapshot.payouts_enabled, false);
});
