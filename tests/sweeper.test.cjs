'use strict';

/**
 * Unit tests for the lock sweeper in server.cjs.
 *
 * Verifies:
 *  1. Expired locks are cleared (assignedWorker and assignedAt set to null).
 *  2. Fresh locks are left untouched.
 *  3. saveSessions (saveFn) is called when stale locks exist.
 *  4. saveSessions is NOT called when no locks are stale.
 *  5. Sessions without a lock are never modified.
 *  6. adminAction defaults to 'REVIEW_APP' when not set on a stale session.
 *  7. lastUpdated is updated to the sweeper run time on cleared sessions.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { runLockSweeper, LOCK_TIMEOUT_MS, LOCK_SWEEPER_INTERVAL_MS } = require('../server.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a session that has a lock assigned lockAgeMs ago. */
function lockedSession(lockAgeMs, extra = {}) {
  const now = Date.now();
  return {
    assignedWorker: 'worker1',
    assignedAt: now - lockAgeMs,
    adminAction: 'REVIEW_APP',
    balance: '5000',
    ...extra,
  };
}

/** Build a session with no lock. */
function unlockedSession(extra = {}) {
  return {
    assignedWorker: null,
    assignedAt: null,
    balance: '5000',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Constants', () => {
  test('LOCK_TIMEOUT_MS is 180 000 ms (3 minutes)', () => {
    assert.equal(LOCK_TIMEOUT_MS, 180_000);
  });

  test('LOCK_SWEEPER_INTERVAL_MS is 60 000 ms (1 minute)', () => {
    assert.equal(LOCK_SWEEPER_INTERVAL_MS, 60_000);
  });
});

// ---------------------------------------------------------------------------
// Stale locks → should be released
// ---------------------------------------------------------------------------

describe('Stale locks — exactly at timeout boundary', () => {
  test('clears a lock that is exactly LOCK_TIMEOUT_MS old', () => {
    const now = Date.now();
    const sessions = {
      s1: {
        assignedWorker: 'worker1',
        assignedAt: now - LOCK_TIMEOUT_MS, // exactly at the boundary
        adminAction: 'REVIEW_APP',
      },
    };
    const saveFn = (() => { let calls = 0; const fn = () => calls++; fn.callCount = () => calls; return fn; })();

    runLockSweeper(sessions, saveFn, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.assignedWorker, null, 'assignedWorker should be null');
    assert.equal(sessions.s1.assignedAt, null, 'assignedAt should be null');
    assert.equal(saveFn.callCount(), 1, 'saveFn should be called once');
  });

  test('clears a lock that is older than LOCK_TIMEOUT_MS', () => {
    const now = Date.now();
    const sessions = {
      s1: {
        assignedWorker: 'worker2',
        assignedAt: now - LOCK_TIMEOUT_MS - 30_000, // 30 s past timeout
        adminAction: 'SHOW_VERIFY',
      },
    };
    const saveFn = (() => { let calls = 0; const fn = () => calls++; fn.callCount = () => calls; return fn; })();

    runLockSweeper(sessions, saveFn, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.assignedWorker, null);
    assert.equal(sessions.s1.assignedAt, null);
    assert.equal(saveFn.callCount(), 1);
  });

  test('preserves existing adminAction when clearing a stale lock', () => {
    const now = Date.now();
    const sessions = {
      s1: {
        assignedWorker: 'worker3',
        assignedAt: now - LOCK_TIMEOUT_MS - 1,
        adminAction: 'SHOW_VERIFY',
      },
    };
    runLockSweeper(sessions, () => {}, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.adminAction, 'SHOW_VERIFY', 'existing adminAction should be preserved');
  });

  test('defaults adminAction to REVIEW_APP when not set', () => {
    const now = Date.now();
    const sessions = {
      s1: {
        assignedWorker: 'worker1',
        assignedAt: now - LOCK_TIMEOUT_MS - 1,
        // no adminAction
      },
    };
    runLockSweeper(sessions, () => {}, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.adminAction, 'REVIEW_APP');
  });

  test('sets lastUpdated to the sweeper run time', () => {
    const now = 1_000_000_000_000; // fixed timestamp
    const sessions = {
      s1: {
        assignedWorker: 'worker1',
        assignedAt: now - LOCK_TIMEOUT_MS - 1,
        lastUpdated: now - 999_999,
      },
    };
    runLockSweeper(sessions, () => {}, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.lastUpdated, now, 'lastUpdated should equal the sweeper run timestamp');
  });

  test('clears multiple stale locks in one pass', () => {
    const now = Date.now();
    const sessions = {
      s1: { assignedWorker: 'w1', assignedAt: now - LOCK_TIMEOUT_MS - 1, adminAction: 'REVIEW_APP' },
      s2: { assignedWorker: 'w2', assignedAt: now - LOCK_TIMEOUT_MS - 5_000, adminAction: 'REVIEW_APP' },
      s3: { assignedWorker: 'w3', assignedAt: now - LOCK_TIMEOUT_MS - 60_000, adminAction: 'REVIEW_APP' },
    };
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.assignedWorker, null);
    assert.equal(sessions.s2.assignedWorker, null);
    assert.equal(sessions.s3.assignedWorker, null);
    assert.equal(saveCount, 1, 'saveFn should be called exactly once even for multiple clears');
  });
});

// ---------------------------------------------------------------------------
// Fresh locks → must NOT be released
// ---------------------------------------------------------------------------

describe('Fresh locks — should not be released', () => {
  test('does not clear a lock that is one millisecond below the timeout', () => {
    const now = Date.now();
    const assignedAt = now - LOCK_TIMEOUT_MS + 1; // 1 ms before timeout
    const sessions = {
      s1: { assignedWorker: 'worker1', assignedAt, adminAction: 'REVIEW_APP' },
    };
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.assignedWorker, 'worker1', 'fresh lock should remain');
    assert.equal(sessions.s1.assignedAt, assignedAt, 'assignedAt should not change');
    assert.equal(saveCount, 0, 'saveFn should NOT be called for a fresh lock');
  });

  test('does not clear a lock assigned just now', () => {
    const now = Date.now();
    const sessions = {
      s1: { assignedWorker: 'worker1', assignedAt: now, adminAction: 'REVIEW_APP' },
    };
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.s1.assignedWorker, 'worker1');
    assert.equal(saveCount, 0);
  });

  test('clears only the stale session when mixed with a fresh one', () => {
    const now = Date.now();
    const sessions = {
      stale: { assignedWorker: 'w1', assignedAt: now - LOCK_TIMEOUT_MS - 1, adminAction: 'REVIEW_APP' },
      fresh: { assignedWorker: 'w2', assignedAt: now - 1_000, adminAction: 'REVIEW_APP' }, // 1 s old
    };
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(sessions.stale.assignedWorker, null, 'stale lock should be cleared');
    assert.equal(sessions.fresh.assignedWorker, 'w2', 'fresh lock should remain');
    assert.equal(saveCount, 1, 'saveFn called once');
  });
});

// ---------------------------------------------------------------------------
// Sessions without a lock → must not be touched
// ---------------------------------------------------------------------------

describe('Unlocked sessions — must not be modified', () => {
  test('does not modify a session with no assignedWorker', () => {
    const now = Date.now();
    const sessions = {
      s1: { assignedWorker: null, assignedAt: null, adminAction: 'REVIEW_APP', balance: '5000' },
    };
    const original = JSON.stringify(sessions.s1);
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(JSON.stringify(sessions.s1), original, 'session should be unchanged');
    assert.equal(saveCount, 0);
  });

  test('does not modify a session with assignedWorker but no assignedAt', () => {
    const now = Date.now();
    // Defensive: a partially-set lock (shouldn't happen in practice, but sweeper must handle it)
    const sessions = {
      s1: { assignedWorker: 'w1', assignedAt: null, adminAction: 'REVIEW_APP' },
    };
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    // sweeper requires BOTH assignedWorker AND assignedAt — no assignedAt means skip
    assert.equal(sessions.s1.assignedWorker, 'w1', 'worker should be unchanged');
    assert.equal(saveCount, 0);
  });

  test('does not call saveFn when there are no sessions at all', () => {
    const sessions = {};
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, Date.now());

    assert.equal(saveCount, 0, 'saveFn must not be called for an empty session map');
  });

  test('does not call saveFn when all sessions are fresh', () => {
    const now = Date.now();
    const sessions = {
      s1: { assignedWorker: 'w1', assignedAt: now - 1_000, adminAction: 'REVIEW_APP' },
      s2: { assignedWorker: 'w2', assignedAt: now - 30_000, adminAction: 'REVIEW_APP' },
    };
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(saveCount, 0, 'saveFn must not be called when no stale locks exist');
  });
});

// ---------------------------------------------------------------------------
// saveFn call-count guarantees
// ---------------------------------------------------------------------------

describe('saveFn call-count guarantees', () => {
  test('saveFn is called exactly once even when many stale locks are cleared', () => {
    const now = Date.now();
    const sessions = {};
    for (let i = 0; i < 20; i++) {
      sessions[`s${i}`] = { assignedWorker: `w${i}`, assignedAt: now - LOCK_TIMEOUT_MS - i * 1000 };
    }
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(saveCount, 1, 'saveFn must be called exactly once regardless of how many locks are cleared');
    // Confirm all sessions were cleared
    for (let i = 0; i < 20; i++) {
      assert.equal(sessions[`s${i}`].assignedWorker, null);
    }
  });

  test('saveFn is called when at least one stale lock exists among fresh ones', () => {
    const now = Date.now();
    const sessions = {
      fresh1: { assignedWorker: 'w1', assignedAt: now - 1_000 },
      fresh2: { assignedWorker: 'w2', assignedAt: now - 60_000 },
      stale:  { assignedWorker: 'w3', assignedAt: now - LOCK_TIMEOUT_MS - 1 },
    };
    let saveCount = 0;
    runLockSweeper(sessions, () => saveCount++, LOCK_TIMEOUT_MS, now);

    assert.equal(saveCount, 1);
  });
});
