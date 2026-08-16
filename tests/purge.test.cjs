'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { purgeOldSessions, ONE_DAY_MS, PURGE_SWEEPER_INTERVAL_MS } = require('../server.cjs');

describe('Auto-Purge Constants', () => {
  test('ONE_DAY_MS is 86 400 000 ms (24 hours)', () => {
    assert.equal(ONE_DAY_MS, 24 * 60 * 60 * 1000);
    assert.equal(ONE_DAY_MS, 86_400_000);
  });

  test('PURGE_SWEEPER_INTERVAL_MS is 600 000 ms (10 minutes)', () => {
    assert.equal(PURGE_SWEEPER_INTERVAL_MS, 600_000);
  });
});

describe('purgeOldSessions Unit Tests', () => {
  test('deletes sessions older than 24 hours from in-memory map', async () => {
    const now = 1_700_000_000_000;
    const sessions = {
      old1: {
        lastUpdated: now - ONE_DAY_MS - 1000,
        name: 'Old User',
      },
      fresh1: {
        lastUpdated: now - 3600_000, // 1 hour old
        name: 'Fresh User',
      },
    };

    const deleted = await purgeOldSessions(sessions, null, now);
    assert.equal(deleted, 1);
    assert.equal(sessions.old1, undefined, 'old1 should be deleted');
    assert.ok(sessions.fresh1, 'fresh1 should be preserved');
  });

  test('handles createdAt fallback if lastUpdated is missing', async () => {
    const now = 1_700_000_000_000;
    const sessions = {
      oldCreated: {
        createdAt: now - ONE_DAY_MS - 5000,
        name: 'Old by Created',
      },
      freshCreated: {
        createdAt: now - 1000,
        name: 'Fresh by Created',
      },
    };

    const deleted = await purgeOldSessions(sessions, null, now);
    assert.equal(deleted, 1);
    assert.equal(sessions.oldCreated, undefined);
    assert.ok(sessions.freshCreated);
  });

  test('handles SESS-<timestamp> ID parsing as fallback', async () => {
    const now = 1_700_000_000_000;
    const oldId = 'SESS-' + (now - ONE_DAY_MS - 10_000);
    const freshId = 'SESS-' + (now - 5000);

    const sessions = {
      [oldId]: { name: 'ID Old User' },
      [freshId]: { name: 'ID Fresh User' },
    };

    const deleted = await purgeOldSessions(sessions, null, now);
    assert.equal(deleted, 1);
    assert.equal(sessions[oldId], undefined);
    assert.ok(sessions[freshId]);
  });

  test('does not delete fresh sessions at 23 hours 59 minutes', async () => {
    const now = 1_700_000_000_000;
    const sessions = {
      almostDayOld: {
        lastUpdated: now - ONE_DAY_MS + 1000, // 1 second before 24h
        name: 'Almost 1 Day',
      },
    };

    const deleted = await purgeOldSessions(sessions, null, now);
    assert.equal(deleted, 0);
    assert.ok(sessions.almostDayOld);
  });

  test('deletes exactly at 24 hour boundary', async () => {
    const now = 1_700_000_000_000;
    const sessions = {
      exactDayOld: {
        lastUpdated: now - ONE_DAY_MS,
        name: 'Exact 1 Day',
      },
    };

    const deleted = await purgeOldSessions(sessions, null, now);
    assert.equal(deleted, 1);
    assert.equal(sessions.exactDayOld, undefined);
  });
});
