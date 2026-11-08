# Local validation — 8 November 2026

This is the worker’s own validation record, not independent certification. Scope: one static React/TypeScript planner and its production `dist/` export. No wallet, transaction, server-side service, publication command or ownership challenge is part of this build.

| Area | Result |
| --- | --- |
| Implementation requirements | Met for the static build; public IMD/IPFS and GitHub URLs are assigned after review |
| Faked functionality/data | None in the production app; test fixtures are confined to test files |
| Unit/API tests | 16 passed, 0 failed |
| Typecheck and production build | Passed |
| Chromium interaction groups | 10 passed |
| Product and action on first screen at 390px | Confirmed in screenshot and bounds assertion |
| Final taste@1 probe | 16/16 passed |
| Share metadata/assets | Present; 1200×630 PNG and SVG favicon exist in source and export |
| Outstanding local limitations | WebKit unavailable; physical phone, actual screen reader and native zoom not checked |

## Commands and observed results

- `npm test`: **16/16 passed**, no skipped tests. Both worked examples, all ten rounded levels, original-inventory mixed ladder, different/odd/top-level leftovers, floor and cap, split-exit equivalence including cap crossing, midnight denominator, bad inputs, JSON provenance, API versions/units/freshness, unavailable/wrong-chain responses, and 403/429/503/empty/malformed bodies are covered.
- `npm run typecheck`: exited **0**.
- `npm run build`: exited **0**, Vite 7.3.7 built 31 modules. Final runtime entry assets are `dist/assets/index--Uz1Qc3u.js` and `dist/assets/index-C7ENnbUL.css`, plus `dist/index.html`, `favicon.svg` and `share.png`. No remote runtime font/image dependencies.
- `PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node scripts/check-browser.mjs /opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs`: **10 interaction groups passed**, exercising the actual production export under `/preview/`. Chromium covered demo/manual power, correct merge count, export contents, actual clipboard copy, denied-clipboard manual fallback/focus, a real downloaded JSON, midnight unknown/savings, invalid amounts, top-level restriction, network share, keyboard Tab/Enter, text enlargement, local asset integrity, UTC rollover and deterministic feed polling/error states. API fixtures in this script are explicitly synthetic and never bundled.
- `IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`: final result **16/16 passed**. The pinned probe is a task input, not a project dependency or delivered source file.

The probe reported no horizontal overflow at 320/390/1440, no text overlap, covered text or clipping; no undersized crowded targets; all measured text passing the resolved-solid-background contrast thresholds; natural casing/tracking; no kicker labels; five mobile / six desktop sizes and two weights; no prohibited glyphs, repeated lines or slogan stack; acceptable first-screen prose; no nested cards or border+shadow surfaces; no continuous motion; complete share metadata. It reports eight comfortably spaced controls below 44px (principally links/disclosures), which passed its 24px/spacing baseline. Main form buttons and inputs are at least 44px high.

Rendered layout checks also passed at **768 and 1024px**. Demo and maximum permitted quantities were checked at 320/390/1440 with complete, wrapping outputs. Text enlargement to 200% at 390px passed overflow checks; this is **not** native browser zoom.

## Real upstream verification

Official documentation was opened and checked on 2026-11-08: [power](https://docs.squeekchain.com/squeeks/power/), [developer parameters](https://docs.squeekchain.com/developers/), [merging](https://docs.squeekchain.com/squeeks/merge/), [staking](https://docs.squeekchain.com/rewards/staking/), [staking reference](https://docs.squeekchain.com/developers/staking/), [API](https://docs.squeekchain.com/developers/api/) and [Genesis /code](https://squeekchain.com/genesis/code). The official merge page’s app link confirmed the Sepolia app destination. Genesis’s published ownership workflow informed README instructions; no challenge value was guessed.

Both real public endpoints returned HTTP **200** and were run through `parseStatus`/`parseEconomy`, not merely inspected as illustrative docs examples:

- `https://api.squeekchain.com/v1/status`: schema 1, generated `2026-11-08T00:16:17.739Z`, hardware IDLE, rpmMilli 0, projected blockHeight `2115`, blockProgress `278107453`. The parser converted the last field to 27.8107453%, preserved the decimal height and validated timestamps/freshness. These are historical validation observations, **not current live values or application defaults**.
- `https://api.squeekchain.com/v1/economy/state`: schema 3, available, Sepolia, generated `2026-11-08T00:16:13.016Z`. Actual staking/fresh-principal/WAD-power fields and `nft.mergesOpen` were successfully parsed. No addresses or monetary balances are hard-coded into the app.

The real endpoint exposes `Retry-After` to browsers via `Access-Control-Expose-Headers`. The deterministic 429 test includes that same header exposure. Browser network availability is not guaranteed: the offline states are implemented and tested; no live success is inferred from a fixture. Real HTTP reads and synthetic browser state checks are distinct evidence.

## Six-domain review

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility | Checked native landmarks, fieldset/labels, described errors, table/definition-list roles, named live output, skip link, keyboard Tab/Enter, visible focused button screenshot, clipboard fallback selection, target spacing and reduced motion | No real screen reader, physical touch test or native zoom; automated checks do not certify compliance |
| Layout | Checked actual export at 320/390/768/1024/1440; demo/max values; no overflow; first-screen product and action; responsive order and comparison columns | English only; translated expansion/RTL not tested or requested |
| Writing | Checked action labels, unknown/error recovery, DEMO/LIVE separation, eligibility and fee caveats, exact required community-project sentence in About/README, testnet disclaimer and source links | Upstream rules can change after verification date |
| Typography | Checked six-size scale, two weights, 16px inputs, tabular values, complete long-number wrapping and bounded prose | System font varies by OS; Safari rendering unverified |
| Colors | Probe measured rendered solid backgrounds with passing text contrast; labels accompany status colors; navy panel has a light focus outline | No complete forced-colors device test or alternate theme; no alternate theme requested |
| UI | Checked form empty/error/populated states, native disclosures, copy/download success/failure, feed loading/offline/stale/fixture-live, hover/focus tokens and reduced-motion rules | No motion-timeline replay needed for the two color/border-only 120ms transitions; no entrance or endless animation exists |

The visual idea is a focused worksheet with a dark power result and an orange action, keeping the holder’s decisions ahead of the small public feed.

## Findings fixed during construction

| Severity/domain | Source and observed cause | Correction and recheck |
| --- | --- | --- |
| Medium/UI | `src/styles.css:141` `.callout` and `src/styles.css:184` `.exit-warning`: the initial probe identified two rounded inset cards inside sections | Removed inset surfaces, kept inline information and a leading warning rule. Final `chrome` probe passes with zero nested cards; final desktop demo screenshot inspected |
| Medium/layout and writing | `src/main.tsx:49` `planningDay` / rollover effect: long-lived inputs could otherwise retain a bucket after its displayed UTC date changed | Clear weekly/oldest exits on UTC date change and announce the need to update. Virtual-clock browser assertion passes |
| Medium/data integrity | `src/api.ts:36`: a counter-fault response must not replace a last good wheel reading or imply a current state | Reject faulted hardware readings so the hook retains prior data and current state stays unknown. Unit tests and stale/retention browser checks pass |
| Low/accessibility | `src/main.tsx:166`: total power was originally plain text without a named dynamic result | Use a named live `output`; static review and final browser build confirm the control/result structure |

During verification, the original test CLI hit a sandbox IPC restriction; `npm test` now uses `node --import tsx --test`. An initial hand-calculated exit test expectation was corrected by independently evaluating the quadratic integral: the correct estimate is **63,983.333…**, consistent with the brief’s approximately 64,000. The production formula itself was unchanged. The first polling fixture omitted CORS exposure for `Retry-After`; after checking actual response headers, the test fixture was corrected and the retry timing assertions passed. A virtual-clock assertion now waits for React’s effect to complete before observing midnight-cleared inputs.

## Screenshot evidence

Disposable paths generated and inspected locally:

- `test/scratch/taste/shots/390.png`: empty portfolio with product title, main demo action and editable counts on the first screen.
- `test/scratch/taste/shots/1440.png`: desktop form with power result and feed context.
- `test/scratch/browser-check/1440-demo.png`: full populated plan, final portfolio, side feed, exit comparison and export actions.
- `test/scratch/browser-check/390-keyboard-focus.png`: visible focus on the demo action and unambiguous DEMO label.
- Additional full-page demo screenshots at 320/390/768/1024 were generated for reflow checks.
- `public/share.png`: 1200×630 share image, visually inspected.

Scratch images and downloaded test files are excluded from delivery and removed by the worker. The source, production assets and documentation do not depend on them.

## Delivery and remaining limitations

The browser connector returned `Transport closed`; direct provided Playwright Chromium was used successfully for all rendered checks. WebKit launch reported an unavailable executable; no Safari test is claimed. No physical phone, actual screen-reader session or native browser zoom was available. The tool cannot establish personal cooldowns, balances, a transaction quote, or future network behavior. Float estimates and rounded display values are labelled accordingly.

Complete for the stated static build and local check scope. IMD/IPFS hosting, the public repository URL and any requester-owned Genesis verification occur **after review**. This report does not assert that those public URLs already exist. The verifier checks paths/bytes and does not independently certify the behavior reported here.

## Submission budget

The final production export is **317,614 bytes**. The complete Git submission candidate (source, lockfile, export, assets and documentation) is **under 0.6 MiB**, below the 8,388,608-byte limit. Read-only Git checks confirmed `dist/index.html` is not ignored and all required files are candidates for the worker’s commit. No submodules, symlinks, dependency directories or npm archives are included. The worker performs staging/commit after this task; this seat did not write Git metadata.
