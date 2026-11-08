import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { API, economyFresh, parseEconomy, parseStatus, wheelFresh } from './api';
import { useFeed } from './useFeed';
import { calculatePower, compareExit, LEVEL_POWER, makeExport, MAX_SQK, nextMidnight, planMerges, readAmount } from './planner';
import './styles.css';

const docs = 'https://docs.squeekchain.com';
const number = (value: number, digits = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const percent = (value: number) => `${number(value * 100, 3)}%`;
const utc = (value: string | number) => new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
type IconName = 'merge' | 'arrow' | 'copy' | 'download' | 'info' | 'external' | 'wheel' | 'check';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    merge: <><path d="M4 5h4l7 7h5M4 19h4l7-7M16 8l4 4-4 4" /></>,
    arrow: <><path d="M4 12h16M15 7l5 5-5 5" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
    external: <><path d="M14 3h7v7m0-7L10 14M10 4H3v17h17v-7" /></>,
    wheel: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="m6 6 4.5 4.5m3 3L18 18M6 18l4.5-4.5m3-3L18 6M12 3v7m0 4v7M3 12h7m4 0h7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}<Icon name="external" size={14} /></a>;
}
function Field({ id, label, value, onChange, hint, optional = false, max = MAX_SQK }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; optional?: boolean; max?: number }) {
  const invalid = (value !== '' || !optional) && readAmount(value, max) === null;
  return <div className="field">
    <label htmlFor={id}>{label}{optional && <span className="optional">Optional</span>}</label>
    <input id={id} name={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={e => onChange(e.target.value)} aria-invalid={invalid} aria-describedby={`${id}-hint`} placeholder={optional ? 'Not entered' : '0'} />
    <span className={invalid ? 'field-error' : 'hint'} id={`${id}-hint`}>{invalid ? `Use 0–${number(max, 0)}, with up to 6 decimal places.` : hint}</span>
  </div>;
}

function App() {
  const [counts, setCounts] = useState<string[]>(Array(10).fill('0'));
  const [staked, setStaked] = useState('0');
  const [network, setNetwork] = useState('');
  const [exit, setExit] = useState({ totalStaked: '0', recentExits: '0', amount: '0', oldestDayExits: '' });
  const [demo, setDemo] = useState(false);
  const [exitSource, setExitSource] = useState('Manual inputs');
  const [notice, setNotice] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  const [now, setNow] = useState(Date.now());
  const planningDay = useRef(new Date().toISOString().slice(0, 10));
  const copyArea = useRef<HTMLTextAreaElement>(null);
  const wheel = useFeed('/status', parseStatus);
  const economy = useFeed('/economy/state', parseEconomy);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const today = new Date(now).toISOString().slice(0, 10);
    if (planningDay.current !== today) {
      planningDay.current = today;
      setExit(previous => ({ ...previous, recentExits: '', oldestDayExits: '' }));
      setExitSource('UTC day changed · update your exit totals');
      setNotice('Midnight UTC passed. Re-enter the week’s exits and oldest day for the new window.');
    }
  }, [now]);
  useEffect(() => { if (copyFallback) { copyArea.current?.focus(); copyArea.current?.select(); } }, [copyFallback]);

  const numericCounts = counts.map(v => /^\d+$/.test(v) ? Number(v) : NaN);
  const countsValid = numericCounts.every(v => Number.isInteger(v) && v >= 0 && v <= 9999) && numericCounts.reduce((a, b) => a + b, 0) <= 9999;
  const personalStake = readAmount(staked);
  const portfolioValid = countsValid && personalStake !== null;
  const power = portfolioValid ? calculatePower(numericCounts, personalStake!) : null;
  const merge = portfolioValid ? planMerges(numericCounts, personalStake!) : null;
  const networkPower = network === '' ? null : readAmount(network, Number.MAX_SAFE_INTEGER);
  const share = power && networkPower !== null && networkPower > 0 && networkPower >= power.w ? power.w / networkPower : null;
  const exitInputs = { totalStaked: readAmount(exit.totalStaked), recentExits: readAmount(exit.recentExits), amount: readAmount(exit.amount), oldestDayExits: exit.oldestDayExits === '' ? null : readAmount(exit.oldestDayExits) };
  let exitError = '';
  if (exitInputs.totalStaked === null || exitInputs.recentExits === null || exitInputs.amount === null || (exit.oldestDayExits !== '' && exitInputs.oldestDayExits === null)) exitError = 'Correct the SQK amounts to see an estimate.';
  else if (exitInputs.amount > exitInputs.totalStaked) exitError = 'Amount to unstake must be no more than mature network stake.';
  else if (exitInputs.oldestDayExits !== null && exitInputs.oldestDayExits > exitInputs.recentExits) exitError = 'Oldest day exits must be no more than exits past week.';
  const validExit = !exitError ? { totalStaked: exitInputs.totalStaked!, recentExits: exitInputs.recentExits!, amount: exitInputs.amount!, oldestDayExits: exitInputs.oldestDayExits } : null;
  const comparison = validExit ? compareExit(validExit) : null;
  const midnight = nextMidnight(new Date(now));
  const seconds = Math.max(0, Math.ceil((midnight.getTime() - now) / 1000));
  const countdown = `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  const oldestDate = new Date(now - 6 * 86400000).toISOString().slice(0, 10);
  const wheelLive = !!wheel.data && !wheel.error && wheelFresh(wheel.data, now);
  const economyLive = !!economy.data && !economy.error && economyFresh(economy.data, now);
  const exportValid = portfolioValid && !!validExit && (network === '' || (networkPower !== null && !!power && networkPower >= power.w && networkPower > 0));

  function changeExit(key: keyof typeof exit, value: string) { setExit(prev => ({ ...prev, [key]: value })); setExitSource(demo ? 'DEMO · edited scenario' : 'Manual inputs'); setNotice(''); }
  function loadDemo() {
    setCounts(['4', '0', '2', '0', '0', '0', '0', '0', '0', '0']); setStaked('1000'); setNetwork('');
    setExit({ totalStaked: '95000000', recentExits: '5000000', amount: '500', oldestDayExits: '1000000' });
    setDemo(true); setExitSource('DEMO · sample network'); setShowAll(false); setCopyFallback(''); setNotice('Demo portfolio loaded. All planning inputs are sample data.');
  }
  function clear() {
    setCounts(Array(10).fill('0')); setStaked('0'); setNetwork('');
    setExit({ totalStaked: '0', recentExits: '0', amount: '0', oldestDayExits: '' });
    setDemo(false); setExitSource('Manual inputs'); setShowAll(false); setCopyFallback(''); setNotice('All planning inputs cleared.');
  }
  function getPlan() {
    if (!exportValid || !validExit) return null;
    return { ...makeExport(numericCounts, personalStake!, networkPower, validExit, demo), exitInputSource: exitSource,
      liveContext: { wheel: { fetchedAt: wheel.fetchedAt ? new Date(wheel.fetchedAt).toISOString() : null, state: wheelLive ? 'LIVE' : 'OFFLINE/UNKNOWN' },
        economy: { fetchedAt: economy.fetchedAt ? new Date(economy.fetchedAt).toISOString() : null, state: economyLive ? 'LIVE' : 'OFFLINE/UNKNOWN' } } };
  }
  async function copyPlan() {
    const plan = getPlan(); if (!plan) return;
    const text = `${plan.title}\n${plan.mode} · Sepolia only · ${plan.timestamp}\n\nPower: P ${number(plan.power.p)}, Q ${number(plan.power.q)}, W ${number(plan.power.w)}\n\nOne-round merge plan:\n${plan.mergePlan.steps.length ? plan.mergePlan.steps.map(s => `${s.step}. 2 × L${s.fromLevel} → 1 × L${s.toLevel}; pair ${number(s.pairPower)} → ${number(s.survivorPower)}; cumulative P gain +${number(s.cumulativeGain)}`).join('\n') : 'No same-level pairs below L10.'}\nFinal: ${plan.mergePlan.finalCounts.map((n, i) => n ? `${n} × L${i + 1}` : '').filter(Boolean).join(', ') || 'Empty'}\nTotal power gain: ${number(plan.mergePlan.gain)} (${number(plan.mergePlan.gainPercent)}%)\n\nExit now: ${number(plan.exitEstimate.now.amount)} SQK; fee ${number(plan.exitEstimate.now.fee)} SQK (${percent(plan.exitEstimate.now.averageFee)}); net ${number(plan.exitEstimate.now.net)} SQK\nAfter midnight: ${plan.exitEstimate.afterMidnight ? `${number(plan.exitEstimate.afterMidnight.fee)} SQK fee; ${number(plan.exitEstimate.afterMidnight.net)} SQK net` : 'Unknown; oldest day exits not entered.'}\n\nFull inputs, formulas and assumptions:\n${JSON.stringify(plan, null, 2)}`;
    try { await navigator.clipboard.writeText(text); setNotice('Plan copied to clipboard.'); setCopyFallback(''); }
    catch { setCopyFallback(text); setNotice('Clipboard unavailable. Select and copy the plan below, or download the JSON.'); }
  }
  function downloadPlan() {
    const plan = getPlan(); if (!plan) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `squeek-plan-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Plan JSON downloaded.');
  }

  return <>
    <a className="skip-link" href="#portfolio">Skip to planner</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#"><span className="brand-icon"><Icon name="merge" size={24} /></span><span>Squeek<span className="brand-sub"> / planner</span></span></a>
      <nav aria-label="Main navigation"><a href="#exit-planner">Exit fees</a><a href="#about">About</a><span className="network-label"><span className="dot" />Sepolia only</span></nav>
    </div></header>
    <main>
      <div className="page-heading"><div><h1>Squeek Exit &amp; Merge Planner</h1><p>Plan your merges. Understand your exit fee.</p></div><a className="docs-link" href={`${docs}/`} target="_blank" rel="noreferrer">Read the docs <Icon name="external" size={16} /></a></div>
      <div className="workspace">
        <div className="main-column">
          <section className="surface portfolio" id="portfolio" aria-labelledby="portfolio-title">
            <div className="section-heading"><h2 id="portfolio-title"><span className="section-number">01</span>Enter your portfolio</h2><span className={`mode ${demo ? 'demo' : ''}`}>{demo ? 'DEMO' : 'Manual'}</span></div>
            <p className="section-intro">Count only your deposited Squeeks.</p>
            <div className="portfolio-actions"><button className="button primary" onClick={loadDemo}>Load demo portfolio <Icon name="arrow" size={18} /></button><button className="button subtle" onClick={clear}>Clear</button></div>
            {demo && <p className="demo-note">DEMO · Sample inputs, including any edits. Clear to start your own plan.</p>}
            <fieldset className="levels"><legend className="sr-only">Deposited Squeek counts by level</legend>{counts.map((value, i) => {
              const invalid = !/^\d+$/.test(value) || Number(value) > 9999;
              return <div className="level-field" key={i}>
                <label htmlFor={`level-${i + 1}`}><span className="level-dot" />Level {i + 1}</label>
                <input id={`level-${i + 1}`} name={`level-${i + 1}`} type="text" inputMode="numeric" autoComplete="off" value={value} aria-invalid={invalid} aria-describedby={invalid ? 'counts-error' : `level-power-${i + 1}`} onChange={e => { const next = [...counts]; next[i] = e.target.value; setCounts(next); setNotice(''); }} />
                <span id={`level-power-${i + 1}`} className="hint">{number(LEVEL_POWER[i], 0)} power</span>
              </div>;
            })}</fieldset>
            {!countsValid && <p id="counts-error" className="field-error" role="alert">Enter whole counts from 0 to 9,999, with no more than 9,999 Squeeks in total.</p>}
            <div className="portfolio-bottom"><Field id="personal-stake" label="Staked $SQK" value={staked} onChange={setStaked} hint="Your deposited token principal." /><Field id="network-power" label="Total network power" value={network} onChange={setNetwork} optional max={Number.MAX_SAFE_INTEGER} hint="For your power share, not an earnings forecast." /></div>
            {network !== '' && (networkPower === null || networkPower === 0 || (power && networkPower < power.w)) && <p className="field-error" role="alert">Network power must be positive and include your total power.</p>}
            <div className="privacy-note"><Icon name="check" size={16} />Calculations stay in your browser. No wallet needed.</div>
          </section>

          <section className="surface" id="merge-planner" aria-labelledby="merge-title">
            <div className="section-heading"><h2 id="merge-title"><span className="section-number">02</span>Plan one merge round</h2><Icon name="merge" /></div>
            <p className="section-intro">Pair the same levels, from low to high.</p>
            <div className="merge-summary"><div><span className="hint">Total power after round</span><strong>{merge ? number(merge.after.w) : 'Unknown'}</strong></div><div className="gain"><span className="hint">Power gained</span><strong>{merge ? `+${number(merge.gainPercent)}%` : 'Unknown'}</strong></div></div>
            {!merge ? <p className="empty-message">Correct your portfolio inputs to build a plan.</p> : !merge.steps.length ? <div className="empty-message"><Icon name="merge" size={32} /><div><strong>No pairs to merge yet</strong><p>Enter two of the same level below Level 10, or load the demo portfolio.</p></div></div> : <>
              <ol className="merge-steps">{(showAll ? merge.steps : merge.steps.slice(0, 6)).map(step => <li key={step.step}>
                <span className="step-index">{step.step}</span><div className="step-content"><div className="step-title"><strong>2 × L{step.fromLevel}</strong><Icon name="arrow" size={16} /><strong>1 × L{step.toLevel}</strong><span className="step-gain">+{number(step.gain, 0)} P</span></div>
                  <div className="step-detail">Pair power {number(step.pairPower, 0)} → {number(step.survivorPower, 0)}<span>Cumulative +{number(step.cumulativeGain, 0)} P</span></div>
                  <span className="hint">{step.fromLevel === 1 ? 'L1 has no cooldown; admin must open merges.' : 'Cooldown unknown. Check both Squeeks in the official app.'}</span>
                </div></li>)}</ol>
              {merge.steps.length > 6 && <button className="button subtle" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer steps' : `Show all ${number(merge.steps.length, 0)} steps`}</button>}
            </>}
            <div className="final-portfolio"><span className="hint">Final deposited portfolio</span><p>{merge?.finalCounts.some(Boolean) ? merge.finalCounts.map((count, i) => count > 0 ? <span className="portfolio-piece" key={i}>{number(count, 0)} × L{i + 1}</span> : null) : 'No deposited Squeeks'}</p>{merge && <span className="hint">Gain: {number(merge.after.p - merge.before.p)} Squeek power + {number(merge.after.q - merge.before.q)} SQK power = {number(merge.gain)} total.</span>}</div>
            <aside className="callout"><Icon name="info" /><p><strong>Plan, then check eligibility.</strong> New survivors wait for another round. Higher levels have cooldowns in completed Squeek blocks, which follow transfers and deposits. Different levels cannot pair; Level 10 cannot merge. The admin must open merges. <External href="https://sepolia.squeekchain.com/">Check the official app</External></p></aside>
          </section>
        </div>

        <aside className="side-column" aria-label="Power and public network context">
          <section className="power-panel" aria-labelledby="power-title"><div className="section-heading"><h2 id="power-title">Your power</h2><span className="power-mark" aria-hidden="true">W</span></div>
            <output className="power-total" aria-label="Total power" aria-live="polite" aria-atomic="true">{power ? number(power.w) : 'Unknown'}</output><span className="power-caption">Total power · P + Q</span>
            <dl className="power-breakdown"><div><dt>Squeek power <span>P</span></dt><dd>{power ? number(power.p) : 'Unknown'}</dd></div><div><dt>$SQK power <span>Q</span></dt><dd>{power ? number(power.q) : 'Unknown'}</dd></div><div><dt>$SQK boost</dt><dd>{power ? `${number(power.boost)}×` : 'Unknown'}</dd></div>{share !== null && <div><dt>Network power share</dt><dd>{percent(share)}</dd></div>}</dl>
            <details className="formula-details"><summary>How power is calculated</summary><p>P = deposited Squeek power<br />Boost = 1 + P / 1,000<br />Q = staked $SQK × boost / 40<br />W = P + Q</p><External href={`${docs}/rewards/staking/`}>Power formula docs</External><p className="hint">Level power = round(1,000 × 2.2^(L − 1)). Rounded levels mean a merge adds about 10% to its pair.</p></details>
          </section>

          <section className="surface feed-panel" aria-labelledby="feed-title"><div className="section-heading"><h2 id="feed-title"><Icon name="wheel" />Wheel feed</h2><span className={`feed-badge ${wheelLive ? 'live' : ''}`}><span className="dot" />{wheelLive ? 'LIVE' : wheel.loading ? 'UNKNOWN' : wheel.data ? 'STALE' : 'OFFLINE'}</span></div>
            <div className="wheel-state"><strong>{wheelLive ? wheel.data!.state : 'Unknown'}</strong><span>{wheelLive ? 'Hardware reading' : 'Wheel feed offline / unknown'}</span></div>
            {!wheelLive && wheel.data && <p className="hint">Last good reading: {wheel.data.state}. Values below are historical.</p>}
            <dl className="feed-stats"><div><dt>RPM</dt><dd>{wheel.data ? number(wheel.data.rpm, 3) : 'Unknown'}</dd></div><div><dt>Projected block</dt><dd>{wheel.data?.blockHeight ? numberFromString(wheel.data.blockHeight) : 'Unknown'}</dd></div></dl>
            <div className="progress-label"><span>Projected block progress</span><strong>{wheel.data?.blockProgress != null ? `${number(wheel.data.blockProgress)}%` : 'Unknown'}</strong></div>
            <div className="progress-track" role="progressbar" aria-label="Projected block progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={wheel.data?.blockProgress ?? undefined} aria-valuetext={wheel.data?.blockProgress != null ? `${number(wheel.data.blockProgress)} percent${wheelLive ? '' : ', last reading'}` : 'Unknown'}><span style={{ width: `${wheel.data?.blockProgress ?? 0}%` }} /></div>
            <p className="hint">Projection is optimistic, not settled.</p>
            <div className="feed-timestamps">{wheel.fetchedAt && <span>Fetched {utc(wheel.fetchedAt)}</span>}{wheel.data && <span>Observed {utc(wheel.data.observedAt)}</span>}{!wheel.fetchedAt && <span>{wheel.loading ? 'Requesting public feed…' : 'No verified reading received.'}</span>}<span>{wheel.error ? `Retrying with backoff${wheel.nextAt ? ` after ${utc(wheel.nextAt)}` : ''}.` : 'Refreshes every 15 seconds.'}</span></div>
            <div className="economy-context"><div><strong>Economy</strong><span className={`feed-badge ${economyLive ? 'live' : ''}`}>{economyLive ? 'LIVE' : economy.loading ? 'UNKNOWN' : economy.data ? 'STALE' : 'OFFLINE'}</span></div>
              <p>Admin merges: <strong>{economyLive && economy.data?.mergesOpen !== null ? economy.data?.mergesOpen ? 'Open' : 'Closed' : 'Unknown'}</strong><br />Staking intake: <strong>{economyLive && economy.data?.stakingPaused !== null ? economy.data?.stakingPaused ? 'Paused' : 'Open' : 'Unknown'}</strong></p>
              <p className="hint">{economy.fetchedAt ? `Fetched ${utc(economy.fetchedAt)}` : economy.loading ? 'Requesting economy feed…' : 'Economy feed offline / unknown.'}</p>
              <button className="button subtle fill-width" disabled={!economyLive || economy.data?.matureStaked == null || demo} onClick={() => { if (economy.data?.matureStaked != null) { setExit(e => ({ ...e, totalStaked: economy.data!.matureStaked!.toFixed(6) })); setExitSource(`API mature stake fetched ${utc(economy.fetchedAt!)} · other inputs manual`); setNotice('Mature network stake loaded. Enter recent exits yourself; the API does not provide the week’s exits.'); } }}>Use live mature stake <Icon name="arrow" size={16} /></button>
              {demo && <p className="hint">Clear DEMO to use live stake.</p>}
            </div>
            <External href={`${docs}/developers/api/`}>Public API docs</External>
          </section>
        </aside>
      </div>

      <section className="surface exit-panel" id="exit-planner" aria-labelledby="exit-title"><div className="section-heading"><h2 id="exit-title"><span className="section-number">03</span>Compare your exit</h2><span className="mode">Estimate</span></div><p className="section-intro">See how your own unstake changes the fee.</p>
        <div className="exit-layout"><div className="exit-inputs"><div className="input-source">{exitSource}</div>
          <Field id="total-staked" label="Total network $SQK staked" value={exit.totalStaked} onChange={v => changeExit('totalStaked', v)} hint="Mature principal only. Exclude stake from this round." />
          <Field id="recent-exits" label="Exits past week ($SQK)" value={exit.recentExits} onChange={v => changeExit('recentExits', v)} hint="Gross exits: today + the previous 6 UTC days." />
          <Field id="exit-amount" label="Amount to unstake ($SQK)" value={exit.amount} onChange={v => changeExit('amount', v)} hint="Independent scenario. Check your mature balance in the app." />
          <Field id="oldest-exits" label="Oldest day exits ($SQK)" value={exit.oldestDayExits} onChange={v => changeExit('oldestDayExits', v)} optional hint={`Exits on ${oldestDate} UTC. Enter 0 if none; leave blank if unknown.`} />
          <button className="button subtle" onClick={() => { setExit({ totalStaked: '95000000', recentExits: '5000000', amount: '1000000', oldestDayExits: '' }); setExitSource('DEMO · documented 1M exit example'); setDemo(true); setNotice('Documented exit example loaded. Planning inputs are labelled DEMO.'); }}>Load worked exit example <Icon name="arrow" size={16} /></button>
        </div><div className="exit-results">
          <div className="comparison-heading"><h3>Now or after midnight?</h3><span>Next UTC midnight in {countdown}</span></div>
          {exitError ? <p className="field-error" role="alert">{exitError}</p> : comparison && <>
            <div className="comparison-table" role="table" aria-label="Exit fee comparison"><div className="comparison-row table-head" role="row"><span role="columnheader">Estimate</span><strong role="columnheader">Now</strong><strong role="columnheader">After midnight</strong></div>
              {[
                ['Start pressure', percent(comparison.now.pressureStart), comparison.afterMidnight ? percent(comparison.afterMidnight.pressureStart) : 'Unknown'],
                ['End pressure', percent(comparison.now.pressureEnd), comparison.afterMidnight ? percent(comparison.afterMidnight.pressureEnd) : 'Unknown'],
                ['Start fee', percent(comparison.now.startFee), comparison.afterMidnight ? percent(comparison.afterMidnight.startFee) : 'Unknown'],
                ['End fee', percent(comparison.now.endFee), comparison.afterMidnight ? percent(comparison.afterMidnight.endFee) : 'Unknown'],
                ['Average fee', percent(comparison.now.averageFee), comparison.afterMidnight ? percent(comparison.afterMidnight.averageFee) : 'Unknown'],
                ['Fee burned · SQK', number(comparison.now.fee), comparison.afterMidnight ? number(comparison.afterMidnight.fee) : 'Unknown'],
                ['Net received · SQK', number(comparison.now.net), comparison.afterMidnight ? number(comparison.afterMidnight.net) : 'Unknown'],
              ].map(([label, a, b]) => <div className={`comparison-row ${label.startsWith('Net') ? 'net-row' : ''}`} role="row" key={label}><span role="rowheader">{label}</span><strong role="cell">{a}</strong><strong role="cell">{b}</strong></div>)}
            </div>
            <div className="timing-note"><Icon name="info" /><p>{!comparison.afterMidnight ? <>Enter the oldest day’s exits to compare waiting. That daily bucket is not supplied by the economy API.</> : comparison.savings! > 0 ? <>Waiting until <strong>{midnight.toISOString().slice(0, 10)} 00:00 UTC</strong> would save about <strong>{number(comparison.savings!)} $SQK</strong> in this scenario.</> : <>The estimated fee stays the same after midnight in this scenario.</>}<span>Assumes no new exits or stakes. This is a comparison, not a forecast.</span></p></div>
          </>}
          <p className="exit-warning"><strong>Splitting an exit does not help.</strong> Your own exit raises the fee as it leaves. The entire fee is burned. Check the on-chain quote before unstaking.</p>
          <details className="exit-formulas"><summary>Fee formula and assumptions</summary><p>D = max(mature staked + recent exits, 21,000,000). Pressure during your exit = (recent exits + amount already exited) / D.</p><p>Marginal fee = min(60%, 2% + 14.5 × pressure²). Pressure uses a fraction (5% = 0.05). The fee is the integral of that rate across the whole amount, including the cap. Integer rounding on-chain can differ.</p><p>The seven-day window uses whole UTC days. At midnight, remove the oldest bucket and recompute D. Newly staked SQK becomes withdrawable from the next ten-minute round.</p><External href={`${docs}/rewards/staking/`}>Exit fee docs</External></details>
        </div></div>
      </section>

      <section className="export-bar" aria-label="Export your plan"><div><h2>Keep your plan</h2><p>Inputs, merge order, exit estimates and formulas.</p></div><div className="export-actions"><button className="button primary" onClick={copyPlan} disabled={!exportValid}><Icon name="copy" size={18} />Copy plan</button><button className="button secondary" onClick={downloadPlan} disabled={!exportValid}><Icon name="download" size={18} />Download plan (.json)</button></div>
        {!exportValid && <p className="field-error">Correct the highlighted inputs to export a complete plan.</p>}
      </section>
      <p className="announcement" role="status" aria-live="polite">{notice}</p>
      {copyFallback && <div className="copy-fallback"><label htmlFor="copy-plan">Select and copy your plan</label><textarea id="copy-plan" ref={copyArea} readOnly value={copyFallback} rows={8} /><button className="button subtle" onClick={() => setCopyFallback('')}>Close copy text</button></div>}

      <section className="about-panel" id="about" aria-labelledby="about-title"><div><h2 id="about-title">A plan before you act</h2><p>Squeek Exit &amp; Merge Planner is a community project for the Squeekchain Buildooooor badge.</p><p>Merge two same-level Squeeks to keep one with more power; the donor is permanently burned. Only deposited Squeeks add power here. Withdrawing Squeeks and claiming rewards are free. Unstaking $SQK has a fee that grows with recent exits.</p></div><div><h3>Community tool. Sepolia only.</h3><p>Not affiliated with SqueekChain. As of November 2026, $SQK has not launched on mainnet. No prices, returns or earnings forecasts. This tool plans; it never connects a wallet or sends a transaction.</p><div className="about-links"><External href={`${docs}/squeeks/power/`}>Squeek power</External><External href={`${docs}/rewards/staking/`}>Staking &amp; exits</External><External href="https://squeekchain.com/genesis/code">Genesis /code</External></div></div></section>
    </main>
    <footer><span>Built through the IdentityMD contributor network.</span><a href="https://imd.fun" target="_blank" rel="noreferrer">IMD <Icon name="external" size={14} /></a><span>Rules verified 8 Nov 2026 · Sepolia testnet</span></footer>
  </>;
}
function numberFromString(value: string) { return BigInt(value).toLocaleString('en-US'); }
createRoot(document.getElementById('root')!).render(<App />);
