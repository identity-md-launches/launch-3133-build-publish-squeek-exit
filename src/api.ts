export const API = 'https://api.squeekchain.com/v1';
export const POLL_MS = 15_000;
export const TIMEOUT_MS = 8_000;
type Dict = Record<string, unknown>;
function object(value: unknown): Dict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected API response.');
  return value as Dict;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Invalid feed timestamp.');
  return value;
}
function decimal(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,78}$/.test(value)) throw new Error('Invalid feed number.');
  return value;
}
function baseUnits(value: unknown): number {
  const n = BigInt(decimal(value));
  // Keep large uint strings in BigInt, converting only bounded whole display units.
  const whole = n / 10n ** 18n;
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Feed number is too large.');
  return Number(whole) + Number(n % (10n ** 18n)) / 1e18;
}
export type Wheel = {
  generatedAt: string; receivedAt: string; observedAt: string; staleAfterSeconds: number;
  freshness: 'online' | 'stale'; state: 'ACTIVE' | 'IDLE' | 'UNKNOWN'; rpm: number;
  blockHeight: string | null; blockProgress: number | null;
};
export function parseStatus(value: unknown): Wheel {
  const d = object(value);
  if (d.schemaVersion !== 1) throw new Error('Unsupported status schemaVersion.');
  const m = object(d.measurement);
  if (m.provenance !== 'hardware') throw new Error('Hardware wheel reading unavailable.');
  if (m.freshness !== 'online' && m.freshness !== 'stale') throw new Error('Unknown feed freshness.');
  if (!['ACTIVE', 'IDLE', 'COUNTER_FAULT'].includes(String(m.coreStatus))) throw new Error('Unknown wheel state.');
  if (m.coreStatus === 'COUNTER_FAULT') throw new Error('Wheel counter fault; current reading unknown.');
  if (!Number.isSafeInteger(m.rpmMilli) || (m.rpmMilli as number) < 0 || typeof m.staleAfterSeconds !== 'number' || !Number.isFinite(m.staleAfterSeconds) || m.staleAfterSeconds <= 0) throw new Error('Invalid wheel measurement.');
  const builder = object(d.builder);
  let blockHeight: string | null = null, blockProgress: number | null = null;
  if (builder.status === 'available') {
    const projected = object(builder.projected);
    blockHeight = decimal(projected.blockHeight);
    const units = BigInt(decimal(projected.blockProgress));
    if (units >= 1_000_000_000n) throw new Error('Invalid block progress.');
    blockProgress = Number(units) / 10_000_000;
  } else if (builder.status !== 'unavailable') throw new Error('Unknown builder availability.');
  return { generatedAt: timestamp(d.generatedAt), receivedAt: timestamp(m.receivedAt), observedAt: timestamp(m.observedAt),
    staleAfterSeconds: m.staleAfterSeconds, freshness: m.freshness,
    state: m.coreStatus as 'ACTIVE' | 'IDLE',
    rpm: (m.rpmMilli as number) / 1000, blockHeight, blockProgress };
}
export type Economy = { generatedAt: string; safeBlockTimestamp: string; totalStaked: number | null; matureStaked: number | null; networkPower: number | null; mergesOpen: boolean | null; stakingPaused: boolean | null };
export function parseEconomy(value: unknown): Economy {
  const d = object(value);
  if (d.schemaVersion !== 3) throw new Error('Unsupported economy schemaVersion.');
  if (d.status !== 'available') throw new Error('Economy unavailable.');
  const chain = object(d.chain);
  if (chain.chainId !== '11155111' || chain.target !== 'sepolia') throw new Error('Feed is not Sepolia.');
  let totalStaked: number | null = null, matureStaked: number | null = null, networkPower: number | null = null, stakingPaused: boolean | null = null;
  if (d.staking !== null) {
    const s = object(d.staking);
    totalStaked = baseUnits(s.totalStakedBaseUnits);
    const fresh = baseUnits(s.freshPrincipalBaseUnits);
    if (fresh > totalStaked) throw new Error('Invalid fresh stake.');
    matureStaked = totalStaked - fresh;
    networkPower = baseUnits(s.totalNftPower) + baseUnits(s.totalSqkPower);
    if (typeof s.paused !== 'boolean') throw new Error('Unknown staking availability.');
    stakingPaused = s.paused;
  }
  let mergesOpen: boolean | null = null;
  if (d.nft !== null) {
    const nft = object(d.nft);
    if (typeof nft.mergesOpen !== 'boolean') throw new Error('Unknown merge availability.');
    mergesOpen = nft.mergesOpen;
  }
  return { generatedAt: timestamp(d.generatedAt), safeBlockTimestamp: timestamp(chain.safeBlockTimestamp), totalStaked, matureStaked, networkPower, mergesOpen, stakingPaused };
}

export function wheelFresh(data: Wheel, now = Date.now()) {
  const age = now - Date.parse(data.receivedAt), snapshotAge = now - Date.parse(data.generatedAt);
  return data.freshness === 'online' && data.state !== 'UNKNOWN' && age >= -30_000 && age <= data.staleAfterSeconds * 1000 && snapshotAge >= -30_000 && snapshotAge <= 45_000;
}
export function economyFresh(data: Economy, now = Date.now()) {
  const snapshotAge = now - Date.parse(data.generatedAt), blockAge = now - Date.parse(data.safeBlockTimestamp);
  return snapshotAge >= -30_000 && snapshotAge <= 45_000 && blockAge >= -30_000 && blockAge <= 10 * 60_000;
}
export function retryAfterMs(raw: string | null, now = Date.now()) {
  if (!raw) return 0;
  if (/^\d+(\.\d+)?$/.test(raw.trim())) return Number(raw) * 1000;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? Math.max(0, time - now) : 0;
}
export function backoffMs(failures: number, retryAfter = 0) {
  return Math.max(POLL_MS, Math.min(300_000, POLL_MS * 2 ** Math.min(failures, 5)), retryAfter);
}
export class FeedError extends Error {
  constructor(message: string, public retryAfter = 0) { super(message); }
}
export async function fetchFeed<T>(path: '/status' | '/economy/state', parse: (body: unknown) => T, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, TIMEOUT_MS);
  try {
    const res = await fetch(API + path, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new FeedError(`Feed returned HTTP ${res.status}.`, [429, 503].includes(res.status) ? retryAfterMs(res.headers.get('Retry-After')) : 0);
    return parse(await res.json());
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
