// Verified against docs.squeekchain.com/developers/ on 2026-11-08.
export const LEVEL_POWER = [1000, 2200, 4840, 10648, 23426, 51536, 113380, 249436, 548759, 1207269] as const;
export const PRESSURE_FLOOR = 21_000_000;
export const MAX_SQK = 2_100_000_000;
export const FORMULAS = {
  levelPower: 'round(1000 * 2.2^(level - 1))',
  power: 'P = sum(count[level] * levelPower[level]); boost = 1 + P/1000; Q = S * boost / 40; W = P + Q',
  pressure: 'D = max(totalMatureStaked + recentGrossExits, 21000000); pressure(x) = (recentGrossExits + x) / D',
  marginalFee: 'min(0.60, 0.02 + 14.5 * pressure(x)^2)',
  exitFee: 'integral of marginalFee(x) from x=0 to amount; net = amount - fee',
  midnight: 'recentGrossExits becomes recentGrossExits - oldestUtcDayExits; recompute D; no new exits or stakes',
  merge: 'One round: pair original same-level Squeeks once. Newly created survivors are not reused.',
};

export type Power = { p: number; q: number; w: number; boost: number };
export function calculatePower(counts: number[], staked: number): Power {
  validateCounts(counts);
  if (!Number.isFinite(staked) || staked < 0 || staked > MAX_SQK) throw new Error('Staked SQK is out of range.');
  const p = counts.reduce((sum, count, i) => sum + count * LEVEL_POWER[i], 0);
  const boost = 1 + p / 1000;
  const q = staked * boost / 40;
  return { p, q, w: p + q, boost };
}

function validateCounts(counts: number[]) {
  if (counts.length !== 10 || counts.some(n => !Number.isInteger(n) || n < 0 || n > 9999) || counts.reduce((a, b) => a + b, 0) > 9999) {
    throw new Error('Enter whole counts with at most 9,999 Squeeks in total.');
  }
}

export type MergeStep = {
  step: number; fromLevel: number; toLevel: number; pairPower: number; survivorPower: number;
  powerBefore: number; powerAfter: number; gain: number; cumulativeGain: number;
};
export function planMerges(counts: number[], staked: number) {
  const before = calculatePower(counts, staked);
  const finalCounts = [...counts];
  const steps: MergeStep[] = [];
  let currentP = before.p;
  // Deliberately iterate original counts: an output cannot cascade in this round.
  for (let i = 0; i < 9; i++) {
    const pairs = Math.floor(counts[i] / 2);
    for (let pair = 0; pair < pairs; pair++) {
      const gain = LEVEL_POWER[i + 1] - 2 * LEVEL_POWER[i];
      steps.push({ step: steps.length + 1, fromLevel: i + 1, toLevel: i + 2,
        pairPower: 2 * LEVEL_POWER[i], survivorPower: LEVEL_POWER[i + 1],
        powerBefore: currentP, powerAfter: currentP + gain, gain, cumulativeGain: currentP + gain - before.p });
      currentP += gain;
      finalCounts[i] -= 2;
      finalCounts[i + 1] += 1;
    }
  }
  const after = calculatePower(finalCounts, staked);
  return { steps, finalCounts, before, after, gain: after.w - before.w,
    gainPercent: before.w === 0 ? 0 : (after.w - before.w) / before.w * 100 };
}

export type ExitInputs = { totalStaked: number; recentExits: number; amount: number; oldestDayExits: number | null };
export type ExitEstimate = { denominator: number; pressureStart: number; pressureEnd: number; startFee: number; endFee: number; averageFee: number; fee: number; net: number; amount: number };
export function marginalFee(pressure: number) { return Math.min(0.6, 0.02 + 14.5 * pressure ** 2); }

export function estimateExit(totalStaked: number, recentExits: number, amount: number): ExitEstimate {
  if ([totalStaked, recentExits, amount].some(n => !Number.isFinite(n) || n < 0 || n > MAX_SQK) || amount > totalStaked) {
    throw new Error('Use nonnegative SQK amounts; the exit cannot exceed mature network stake.');
  }
  const denominator = Math.max(totalStaked + recentExits, PRESSURE_FLOOR);
  const pressureStart = recentExits / denominator;
  const pressureEnd = (recentExits + amount) / denominator;
  const uncappedAmount = Math.min(amount, Math.max(0, 0.2 * denominator - recentExits));
  const a = recentExits / denominator;
  const b = (recentExits + uncappedAmount) / denominator;
  // Stable quadratic integral, including an exit that crosses the 60% cap.
  const fee = Math.min(amount * 0.6, 0.02 * uncappedAmount + 14.5 * uncappedAmount * (a * a + a * b + b * b) / 3 + 0.6 * (amount - uncappedAmount));
  return { denominator, pressureStart, pressureEnd, startFee: marginalFee(pressureStart), endFee: marginalFee(pressureEnd),
    averageFee: amount === 0 ? marginalFee(pressureStart) : fee / amount, fee, net: amount - fee, amount };
}

export function compareExit(inputs: ExitInputs) {
  const now = estimateExit(inputs.totalStaked, inputs.recentExits, inputs.amount);
  if (inputs.oldestDayExits === null) return { now, afterMidnight: null, savings: null };
  if (!Number.isFinite(inputs.oldestDayExits) || inputs.oldestDayExits < 0 || inputs.oldestDayExits > inputs.recentExits) {
    throw new Error('Oldest day exits must be between zero and the week’s exits.');
  }
  const afterMidnight = estimateExit(inputs.totalStaked, inputs.recentExits - inputs.oldestDayExits, inputs.amount);
  return { now, afterMidnight, savings: now.fee - afterMidnight.fee };
}

export function nextMidnight(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function readAmount(raw: string, max = MAX_SQK): number | null {
  if (!/^\d+(\.\d{0,6})?$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

export function makeExport(counts: number[], staked: number, networkPower: number | null, exit: ExitInputs, demo: boolean, now = new Date()) {
  return {
    title: 'Squeek Exit & Merge Planner', version: 1, timestamp: now.toISOString(), mode: demo ? 'DEMO' : 'MANUAL',
    network: 'Ethereum Sepolia testnet', inputs: { depositedCountsByLevel: counts, stakedSqk: staked, optionalNetworkPower: networkPower, exit },
    power: calculatePower(counts, staked), mergePlan: planMerges(counts, staked), exitEstimate: compareExit(exit), formulas: FORMULAS,
    assumptions: ['Counts refer only to deposited Squeeks.', 'One round; outputs cannot merge again in this plan.',
      'Admin must open merges; individual cooldown and eligibility are unknown. Check the official app.',
      'Exit stake is mature network principal, excluding current-round fresh stake.',
      'Midnight comparison assumes no new exits or stakes; oldest day is user supplied.',
      'Continuous fee estimate; onchain integer rounding may differ. Splitting an exit does not help.',
      'Not an onchain quote. Check the staking contract quote before unstaking.'],
    sources: ['https://docs.squeekchain.com/developers/', 'https://docs.squeekchain.com/rewards/staking/', 'https://docs.squeekchain.com/squeeks/merge/'],
  };
}
