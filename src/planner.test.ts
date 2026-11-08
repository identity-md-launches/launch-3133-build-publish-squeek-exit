import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePower, compareExit, estimateExit, LEVEL_POWER, makeExport, marginalFee, nextMidnight, planMerges, readAmount } from './planner';
const counts = (entries: Record<number, number>) => Array.from({ length: 10 }, (_, i) => entries[i + 1] ?? 0);
function close(a: number, b: number, tolerance = 1e-7) { assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`); }

test('worked power example: 2 L3 + 1000 SQK, then L4', () => {
  assert.deepEqual(calculatePower(counts({ 3: 2 }), 1000), { p: 9680, q: 267, w: 9947, boost: 10.68 });
  const plan = planMerges(counts({ 3: 2 }), 1000);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.after.p, 10648);
  close(plan.after.q, 291.2); close(plan.after.w, 10939.2); close(plan.gain, 992.2);
});
test('every official level L1–L10 uses rounded base power', () => {
  assert.deepEqual(LEVEL_POWER, [1000, 2200, 4840, 10648, 23426, 51536, 113380, 249436, 548759, 1207269]);
  for (let i = 0; i < 10; i++) {
    assert.equal(LEVEL_POWER[i], Math.round(1000 * 2.2 ** i));
    assert.equal(calculatePower(counts({ [i + 1]: 1 }), 0).w, LEVEL_POWER[i]);
  }
});
test('mixed merge ladder is one round, never cascades output survivors', () => {
  const input = counts({ 1: 4, 2: 1, 3: 2, 9: 2, 10: 2 });
  const plan = planMerges(input, 1000);
  assert.deepEqual(plan.steps.map(s => [s.fromLevel, s.toLevel]), [[1, 2], [1, 2], [3, 4], [9, 10]]);
  assert.deepEqual(plan.finalCounts, counts({ 2: 3, 4: 1, 10: 3 }));
  assert.deepEqual(input, counts({ 1: 4, 2: 1, 3: 2, 9: 2, 10: 2 }));
  assert.equal(plan.steps.at(-1)?.cumulativeGain, plan.after.p - plan.before.p);
});
test('different levels, odd remainders, and top-level pairs stay unmerged', () => {
  const c = counts({ 1: 1, 2: 1, 10: 2 });
  assert.deepEqual(planMerges(c, 0).finalCounts, c);
  assert.equal(planMerges(c, 0).steps.length, 0);
});
test('worked exit example integrates 5% to 6% pressure', () => {
  const exit = estimateExit(95_000_000, 5_000_000, 1_000_000);
  close(exit.pressureStart, 0.05); close(exit.pressureEnd, 0.06);
  close(exit.startFee, 0.05625); close(exit.endFee, 0.0722);
  close(exit.fee, 63983.333333333336); close(exit.net, 936016.6666666666);
  close(exit.averageFee, 0.06398333333333334);
});
test('splitting an exit cannot lower the fee', () => {
  for (const [t, e, amount] of [[95e6, 5e6, 1e6], [20e6, 0, 10e6], [100e6, 19e6, 20e6], [10e6, 8e6, 5e6]]) {
    const first = estimateExit(t, e, amount / 3);
    const second = estimateExit(t - amount / 3, e + amount / 3, amount * 2 / 3);
    close(first.fee + second.fee, estimateExit(t, e, amount).fee, 1e-6);
  }
});
test('floor, saturation and zero amount are well defined', () => {
  assert.equal(estimateExit(1000, 0, 100).denominator, 21e6);
  close(marginalFee(0), .02); close(marginalFee(.05), .05625); close(marginalFee(.1), .165); close(marginalFee(.2), .6);
  assert.equal(estimateExit(1e8, 3e7, 1e6).fee, 600000);
  const zero = estimateExit(0, 0, 0); assert.equal(zero.fee, 0); assert.equal(zero.net, 0);
});
test('midnight drops only supplied oldest bucket and recomputes denominator', () => {
  const inputs = { totalStaked: 95e6, recentExits: 5e6, amount: 1e6, oldestDayExits: 1e6 };
  const result = compareExit(inputs);
  close(result.afterMidnight!.denominator, 99e6);
  close(result.afterMidnight!.pressureStart, 4 / 99);
  assert.ok(result.savings! > 0);
  assert.equal(compareExit({ ...inputs, oldestDayExits: null }).afterMidnight, null);
  assert.equal(compareExit({ ...inputs, oldestDayExits: 0 }).savings, 0);
  assert.equal(nextMidnight(new Date('2026-12-31T23:59:59Z')).toISOString(), '2027-01-01T00:00:00.000Z');
});
test('reject invalid, nonfinite or excessive inputs', () => {
  assert.throws(() => calculatePower(counts({ 1: .5 }), 0));
  assert.throws(() => calculatePower(counts({ 1: 9999, 2: 1 }), 0));
  assert.throws(() => estimateExit(100, 0, 101));
  assert.throws(() => estimateExit(Infinity, 0, 0));
  assert.throws(() => compareExit({ totalStaked: 10, recentExits: 1, amount: 1, oldestDayExits: 2 }));
  for (const raw of ['', '-1', 'NaN', 'Infinity', '1e6', '1.1234567', '2100000001']) assert.equal(readAmount(raw), null);
  assert.equal(readAmount('1000.123456'), 1000.123456);
});
test('export is complete and preserves explicit DEMO provenance', () => {
  const plan = makeExport(counts({ 1: 4, 3: 2 }), 1000, null, { totalStaked: 95e6, recentExits: 5e6, amount: 500, oldestDayExits: null }, true, new Date('2026-11-08T01:00:00Z'));
  const copy = JSON.parse(JSON.stringify(plan));
  assert.equal(copy.mode, 'DEMO'); assert.equal(copy.mergePlan.steps.length, 3);
  assert.equal(copy.timestamp, '2026-11-08T01:00:00.000Z'); assert.ok(copy.formulas.exitFee);
  assert.equal(copy.exitEstimate.afterMidnight, null);
});
