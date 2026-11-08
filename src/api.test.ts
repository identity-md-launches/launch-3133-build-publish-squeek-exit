import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoffMs, economyFresh, FeedError, fetchFeed, parseEconomy, parseStatus, retryAfterMs, wheelFresh } from './api';

// Synthetic fixtures for tests only. The application never imports this file.
const time = '2026-11-08T01:00:00.000Z';
const clock = Date.parse(time);
const status = () => ({ schemaVersion: 1, generatedAt: time,
  measurement: { freshness: 'online', receivedAt: time, observedAt: time, provenance: 'hardware', coreStatus: 'IDLE', rpmMilli: 12500, staleAfterSeconds: 120 },
  builder: { status: 'available', projected: { blockHeight: '9007199254740993', blockProgress: '278107453' } },
});
const economy = () => ({ schemaVersion: 3, status: 'available', generatedAt: time,
  chain: { target: 'sepolia', chainId: '11155111', safeBlockTimestamp: time },
  staking: { totalStakedBaseUnits: '95000000000000000000000000', freshPrincipalBaseUnits: '1000000000000000000000000', totalNftPower: '7507200000000000000000000', totalSqkPower: '100000000000000000000000', paused: false },
  nft: { mergesOpen: true },
});
test('status v1: real documented field names, milli RPM, decimal strings and block units', () => {
  const data = parseStatus(status());
  assert.equal(data.rpm, 12.5); assert.equal(data.blockProgress, 27.8107453);
  assert.equal(data.blockHeight, '9007199254740993'); assert.equal(data.state, 'IDLE');
  assert.equal(wheelFresh(data, clock), true); assert.equal(wheelFresh(data, clock + 46000), false);
  assert.equal(wheelFresh({ ...data, freshness: 'stale' }, clock), false);
});
test('missing, non-hardware, faulted and unsupported status never become live', () => {
  assert.throws(() => parseStatus({ ...status(), schemaVersion: 2 }));
  assert.throws(() => parseStatus({ ...status(), measurement: null }));
  assert.throws(() => parseStatus({ ...status(), measurement: { ...status().measurement, provenance: 'simulated' } }));
  assert.throws(() => parseStatus({ ...status(), measurement: { ...status().measurement, rpmMilli: -1 } }));
  assert.throws(() => parseStatus({ ...status(), measurement: { ...status().measurement, coreStatus: 'COUNTER_FAULT' } }), /counter fault/);
  const unavailable = parseStatus({ ...status(), builder: { status: 'unavailable' } });
  assert.equal(unavailable.blockHeight, null); assert.equal(unavailable.blockProgress, null);
  assert.throws(() => parseStatus({ ...status(), builder: { status: 'available', projected: { blockHeight: '1', blockProgress: '1000000000' } } }));
});
test('economy v3: mature stake excludes fresh, power converted from WAD', () => {
  const data = parseEconomy(economy());
  assert.equal(data.totalStaked, 95e6); assert.equal(data.matureStaked, 94e6);
  assert.equal(data.networkPower, 7607200); assert.equal(data.mergesOpen, true);
  assert.equal(economyFresh(data, clock), true); assert.equal(economyFresh(data, clock + 46000), false);
});
test('unavailable or wrong-chain economy is unknown, null components remain null', () => {
  assert.throws(() => parseEconomy({ ...economy(), status: 'unavailable' }));
  assert.throws(() => parseEconomy({ ...economy(), schemaVersion: 1 }));
  assert.throws(() => parseEconomy({ ...economy(), chain: { ...economy().chain, chainId: '1' } }));
  assert.throws(() => parseEconomy({ ...economy(), staking: { ...economy().staking, freshPrincipalBaseUnits: '96000000000000000000000000' } }));
  const nulls = parseEconomy({ ...economy(), staking: null, nft: null });
  assert.equal(nulls.totalStaked, null); assert.equal(nulls.mergesOpen, null);
});
test('Retry-After seconds and dates take priority over bounded exponential backoff', () => {
  assert.equal(retryAfterMs('120', clock), 120000);
  assert.equal(retryAfterMs('Sun, 08 Nov 2026 01:02:00 GMT', clock), 120000);
  assert.equal(retryAfterMs('invalid', clock), 0);
  assert.equal(backoffMs(0), 15000); assert.equal(backoffMs(1), 30000);
  assert.equal(backoffMs(99), 300000); assert.equal(backoffMs(1, 600000), 600000);
});
test('HTTP failures, empty JSON and unknown schema are errors; 429/503 preserve retry delay', async () => {
  const original = globalThis.fetch;
  try {
    for (const code of [429, 503]) {
      globalThis.fetch = async () => new Response('{}', { status: code, headers: { 'Retry-After': '90' } });
      await assert.rejects(fetchFeed('/status', parseStatus), (e: unknown) => e instanceof FeedError && e.retryAfter === 90000);
    }
    globalThis.fetch = async () => new Response('', { status: 200 });
    await assert.rejects(fetchFeed('/status', parseStatus));
    globalThis.fetch = async () => new Response('{"schemaVersion":99}', { status: 200 });
    await assert.rejects(fetchFeed('/status', parseStatus));
    globalThis.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(fetchFeed('/status', parseStatus), /HTTP 403/);
  } finally { globalThis.fetch = original; }
});
