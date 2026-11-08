# Squeek Exit & Merge Planner

Squeek Exit & Merge Planner is a community project for the Squeekchain Buildooooor badge. Built through the IdentityMD contributor network. This is an independent, Sepolia-only planning tool, not affiliated with SqueekChain; it does not claim Genesis approval or promise a badge.

Enter deposited Squeeks by level and staked $SQK to calculate power, plan a single round of same-level merges, and compare an unstake now with waiting until midnight UTC. No wallet, account, backend, database, keys or transactions. As of November 2026, $SQK has not launched on mainnet. This tool offers no prices, returns or earnings forecasts.

## Use the planner

1. Enter **deposited** counts for Levels 1–10, then your staked $SQK. Power updates immediately. An optional total network power gives a power share, not projected earnings.
2. Read the merge steps from low to high. Only pairs in the original portfolio are used: survivors created by this round cannot cascade into another merge in the same plan. Review the final portfolio and power gain. Counts do not establish token-specific eligibility.
3. For an exit scenario, enter mature total network stake, gross exits over today and the previous six UTC days, and the amount to unstake. This is an independent scenario; the amount is not automatically your personal stake. Check your actual mature balance in the official app.
4. Enter the **oldest UTC day’s exits** to compare waiting. Leave it blank when unknown; enter `0` only if that day really had no exits. The API does not provide recent-exit or daily-bucket totals. No total is fabricated. The displayed date identifies the bucket that drops at the next midnight.
5. Use **Copy plan** for readable text plus the complete JSON, or **Download plan (.json)** for the structured export. Both include inputs, steps, final portfolio, exit estimates, assumptions, formulas, provenance and timestamp. If clipboard access is denied, selected copyable text appears.

**Load demo portfolio** loads 4×L1, 2×L3, 1,000 SQK and a clearly labelled sample exit scenario. The DEMO label remains on edits; **Clear** starts a manual plan. **Load worked exit example** labels the planning session DEMO and loads the documented 1M exit example. The wheel feed always remains separate and uses real API reads or OFFLINE/UNKNOWN, never demo measurements.

The optional **Use live mature stake** button copies a fresh, validated economy reading into the exit field, excluding fresh principal. It never fills the unknown exits. It is unavailable in DEMO. Personal inputs are held in page memory; reloading clears them. Public API requests contain no portfolio data. If a UTC day changes while the page is open, the week’s exits and oldest-day inputs are cleared so an old bucket is not silently reused.

## Formulas and verified sources

Rules and actual API shapes were checked on **8 November 2026** against the official [power guide](https://docs.squeekchain.com/squeeks/power/), [deployed parameters](https://docs.squeekchain.com/developers/), [staking guide](https://docs.squeekchain.com/rewards/staking/), [merge guide](https://docs.squeekchain.com/squeeks/merge/), [staking contract reference](https://docs.squeekchain.com/developers/staking/) and [public API reference](https://docs.squeekchain.com/developers/api/).

`src/planner.ts` contains the pure calculation functions. Level powers are rounded independently, as in the published table:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Power | 1,000 | 2,200 | 4,840 | 10,648 | 23,426 | 51,536 | 113,380 | 249,436 | 548,759 | 1,207,269 |

```text
levelPower(L) = round(1000 × 2.2^(L − 1))
P = sum(depositedCount[L] × levelPower[L])
boost = 1 + P / 1000
Q = stakedSQK × boost / 40
W = P + Q
```

Two same-level Squeeks produce one at the next level, approximately 10% more power than the pair (whole-number rounding affects higher levels). A donor is permanently burned. Merges require the admin to open them, both Squeeks to be eligible, and Staking intake to allow deposited merges. Individual cooldowns are **unknown** here: check the [official Sepolia app](https://sepolia.squeekchain.com/). L1 has no cooldown; higher levels wait in **completed Squeek blocks**, not hours or Ethereum blocks. Transfers and deposits preserve cooldowns. L10 cannot merge. Withdrawing Squeeks and claiming rewards are free.

```text
T = mature total network stake (exclude fresh current-round principal)
E = gross exits during today + the previous six UTC days
A = gross amount to unstake
D = max(T + E, 21,000,000)
pressure(x) = (E + x) / D, for x from 0 to A
marginalRate(x) = min(0.60, 0.02 + 14.5 × pressure(x)^2)
fee = integral(marginalRate(x), x = 0..A)
averageRate = fee / A
net = A − fee
```

Pressure is a fraction (`5% = 0.05`). Gross stake leaving decreases T and increases E equally, so D stays constant throughout this exit. The implementation integrates the quadratic exactly until the 60% cap, then adds the capped part. Start, end and average rates are different. For a zero-sized scenario, fee and net are zero and the displayed average is the marginal rate. Display amounts round to two decimals, rates to three decimal places; calculations retain floating-point precision. Inputs accept up to six decimal places. This is a continuous estimate, not the contract’s integer arithmetic or an on-chain quote.

At midnight UTC, `E_after = E − oldestDayExits`, and `D_after = max(T + E_after, 21,000,000)`. Recompute the full exit estimate. The comparison assumes **no new exits or stakes**, not that the fee will actually stay fixed. Splitting an exit does not lower its combined fee within the same window. The entire fee is burned. Obtain the on-chain quote in the official app before unstaking. Newly staked SQK matures from the next ten-minute round.

Worked examples covered by unit tests:

- **Power:** 2×L3 gives P=9,680; with S=1,000, Q=267 and W=9,947. One L4 gives P=10,648, Q=291.2 and W=10,939.2.
- **Exit:** T=95M, E=5M, A=1M gives 5%→6% pressure, 5.625%→7.22% marginal fees, **6.398333…% average**, **63,983.33 SQK burned**, and **936,016.67 SQK net**. This matches the documented approximately 64,000 SQK / 6.4% example.

## Public feed behavior

Only these two bodyless, credential-free GETs are used:

- `https://api.squeekchain.com/v1/status`: schemaVersion **1**, `measurement.coreStatus`, `rpmMilli / 1000`, `receivedAt`, `observedAt`, `freshness`, and `builder.projected.blockHeight` / `blockProgress`. One billion block units equals one block. The UI explicitly calls these **projected**, optimistic values.
- `https://api.squeekchain.com/v1/economy/state`: schemaVersion **3**, Sepolia chain identity, `generatedAt`, `chain.safeBlockTimestamp`, `staking.totalStakedBaseUnits`, `freshPrincipalBaseUnits`, power totals, pause state and `nft.mergesOpen`. Amounts and WAD power are parsed as decimal `BigInt` values before bounded display conversion.

A fresh hardware reading is labelled LIVE with fetch/observation timestamps. A simulated, replayed, derived, missing, faulted, malformed or unsupported-schema response cannot become a live hardware reading. HTTP errors (including 403), empty/invalid JSON and unavailable bodies become offline/unknown. The last valid reading is retained in memory, labelled STALE and historical; current wheel state becomes Unknown. No last good reading means unknown values, not zero. An economy response must identify Sepolia and have a recent safe-block timestamp. Neither endpoint provides an individual merge eligibility check or an unstake fee quote.

Each endpoint polls separately, at least **15 seconds after the preceding request completes**. Requests time out after 8 seconds; retries back off from 30 seconds to 5 minutes. For 429/503, the greater of backoff and `Retry-After` is used, supporting seconds and HTTP dates. Timestamps are checked again locally each second, so a successful but stale feed is not displayed as live. Unknown extra API fields are ignored; consumed fields, version, units and bounds are validated. These are targeted UI parsers, not a validator for every unrelated field in the complete upstream schema.

## Install, run, test and rebuild

Use Node 22 or a compatible modern version (Vite requires Node 20.19+ or 22.12+). Dependencies and exact versions are recorded in `package-lock.json`; normal npm access is required for installation, with no vendored registry.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
```

Open the local URL printed by Vite. `npm run build` includes the TypeScript check and writes `dist/index.html`, bundled CSS/JS, favicon and share image. `npm run preview` serves that production export. The Vite base is `./`; all runtime assets are local and relative. There are no routes requiring server rewrites. The production export was also tested under `/preview/` to exercise a gateway subpath.

`npm test` runs the Node test runner with the tsx import hook. It requires no browser, network or environment values. It covers both worked examples, all ten levels, a mixed one-round ladder without cascading, odd/different/top-level leftovers, the denominator floor, fee cap and cap crossing, split-exit equivalence, midnight behavior, bad input, export provenance, API versions, units, stale data and HTTP failures.

For optional browser validation, provide a locally installed Playwright module and its Chromium installation:

```sh
node scripts/check-browser.mjs /path/to/playwright/index.mjs
```

The script serves `dist/` temporarily under `/preview/`, performs assertions and saves disposable screenshots in `test/scratch/browser-check/`. Its synthetic API fixtures are confined to tests and never bundled into the application. On the IMD worker this used the provided Playwright/Chromium installation, without installing browsers.

Actual results: **16/16 unit/API tests passed**; production build and standalone typecheck passed; **10 Chromium interaction groups passed**, including clipboard denial fallback, JSON download, error/unknown states, simulated 429 retry timing, last-good retention, UTC rollover, maximum values, keyboard interaction, and reflow at 320, 390, 768, 1024 and 1440. Text enlargement to 200% was checked separately from native browser zoom. See [VALIDATION.md](VALIDATION.md) for the final design probe result and coverage.

Limitations: WebKit’s executable is absent from the supplied installation, so Safari is unverified. A physical phone, real screen reader and native 200% browser zoom were not tested. The browser connector failed to open; direct Playwright Chromium provided the rendered checks. Public API responses were validated with the production parsers after real HTTP 200 reads; deterministic browser feed/error checks use explicitly synthetic fixtures. API availability can change, and this tool cannot verify personal on-chain eligibility. No transaction was attempted.

## Static delivery and publication

`dist/` is a required, tracked delivery alongside source, package manifests and lockfile. The IMD delivery plane publishes the committed export to IPFS/IMD after review and handles the public source repository. No separate publishing command or backend is needed. A public site/repository URL is assigned by that delivery process and is not fabricated in this checkout.

The explicit `.gitignore` path budget excludes only dependency/cache directories (`**/node_modules/`, `**/.npm/`, `**/.vite/`, `**/*.tsbuildinfo`), task inputs (`/.imd/`), workspace cache (`/.cache/`) and disposable checks (`/test/scratch/`). It intentionally **does not exclude dist/**. No submodules, dependency tarballs or registry mirrors are required. The complete added submission must stay below 8 MiB; see validation for the measured size.

## Genesis /code ownership verification

Follow the current instructions at [SqueekChain Genesis /code](https://squeekchain.com/genesis/code). This utility does not perform verification or imply approval.

For a direct submission, the maintainer must first have the final public GitHub repository and a live site on a domain they control. On `/genesis/code`, obtain the exact ownership challenge, add its **DNS TXT record** to that domain, add its exact **page tag** to this project’s `index.html`, and add its exact **repository verification line** to this README. Rebuild the static export, publish it, ensure the DNS record and both lines are visible, then press **Verify** in Genesis. Keep the TXT record in place for rechecks. The tag/record names and challenge values are supplied by Genesis; none are guessed or prefilled here. Verification and any approval or badge are decisions made by Genesis/SqueekChain, not this planner.

For an IMD submission, Genesis documents attribution through the project’s first paid IMD job and the wallet already verified on the contributor’s Genesis profile. Keep this README’s IMD attribution and the pipeline’s job/source links. The requester handles ownership verification; the planning site itself never requests a wallet connection.

## Source map

- `index.html`: metadata and single entry point.
- `src/main.tsx`, `src/styles.css`: interface, input provenance, exports and responsive styles.
- `src/planner.ts`: power, one-round merges, integrated exit estimates and JSON plan.
- `src/api.ts`, `src/useFeed.ts`: typed parsers, freshness, timeout/backoff and isolated public polling.
- `src/*.test.ts`: offline unit/API tests.
- `scripts/check-browser.mjs`: production interaction validation.
- `public/`: required favicon and social image; copied into `dist/`.
- `DESIGN.md`: final implemented design tokens and components.

Design review used the pinned Better Interface guide (Jakub Krehel, MIT) and documentation method adapted from Paul Bakaus’s Impeccable (Apache-2.0), provided through IMD. This acknowledgment does not imply either author’s endorsement.
