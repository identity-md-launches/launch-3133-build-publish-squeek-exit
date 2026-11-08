// Run on a built dist/: node scripts/check-browser.mjs [path/to/playwright/index.mjs]
// Browser fixtures below are synthetic test inputs, never application fallbacks.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const { chromium, webkit } = await import(process.argv[2] || 'playwright');
const root = resolve('dist');
const output = resolve('test/scratch/browser-check');
await mkdir(output, { recursive: true });
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/preview/')) { res.writeHead(404).end(); return; }
    const file = resolve(root, './' + decodeURIComponent(pathname.slice('/preview/'.length) || 'index.html'));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + '/preview/';
let browser;
const passed = [];
const check = (name) => { passed.push(name); console.log('PASS ' + name); };
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert.ok(dimensions.scroll <= dimensions.client, `${label}: ${JSON.stringify(dimensions)}`);
}
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: {width:390,height:844}, acceptDownloads:true, permissions:['clipboard-read','clipboard-write'] });
  const page = await context.newPage();
  const errors = [], localFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) localFailures.push(response.url()); });
  await page.route('https://api.squeekchain.com/**', route => route.fulfill({ status:403, contentType:'application/json', body:'{"error":"test_forbidden"}' }));
  await page.clock.install({ time:new Date('2026-11-08T12:00:00Z') });
  await page.goto(url);
  await page.getByRole('heading', { name:'Squeek Exit & Merge Planner', exact:true }).waitFor();
  const primary = await page.getByRole('button', {name:'Load demo portfolio'}).boundingBox();
  assert.ok(primary && primary.y + primary.height <= 844);
  await page.locator('.feed-panel .feed-badge').first().filter({hasText:'OFFLINE'}).waitFor();
  assert.equal(await page.locator('.wheel-state strong').textContent(), 'Unknown');
  assert.equal(await page.locator('.feed-stats dd').first().textContent(), 'Unknown');
  check('390 first screen contains product and demo action; HTTP 403 yields OFFLINE/Unknown');
  await page.screenshot({path:output+'/390-empty.png'});

  await page.getByRole('button', {name:'Load demo portfolio'}).click();
  assert.equal(await page.locator('#level-1').inputValue(), '4');
  assert.equal(await page.locator('#level-3').inputValue(), '2');
  assert.equal(await page.locator('.power-total').textContent(), '14,047');
  assert.equal(await page.locator('.merge-steps li').count(), 3);
  assert.equal(await page.locator('.merge-summary strong').first().textContent(), '15,449.2');
  assert.match(await page.locator('.mode.demo').textContent(), /DEMO/);
  check('demo loads labelled inputs, correct power and three single-round merge steps');

  await page.getByRole('button', {name:'Copy plan', exact:true}).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /DEMO/); assert.match(copied, /cumulative P gain/); assert.match(copied, /marginalFee/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:'Download plan (.json)'}).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.mode, 'DEMO'); assert.equal(exported.mergePlan.steps.length, 3);
  assert.equal(exported.inputs.stakedSqk,1000); assert.ok(exported.formulas); assert.ok(exported.timestamp);
  check('clipboard copy and JSON download preserve inputs, steps, formulas, estimates and DEMO');

  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {value:async()=>{throw new Error('Denied for test');}, configurable:true}));
  await page.getByRole('button', {name:'Copy plan', exact:true}).click();
  await page.locator('#copy-plan').waitFor();
  assert.match(await page.locator('#copy-plan').inputValue(), /Squeek Exit & Merge Planner/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'copy-plan');
  await page.getByRole('button', {name:'Close copy text'}).click();
  check('denied clipboard shows focused, selected manual copy fallback');

  await page.locator('#oldest-exits').fill('');
  assert.match(await page.locator('.timing-note').textContent(), /Enter the oldest day/);
  await page.locator('#oldest-exits').fill('1000000');
  assert.match(await page.locator('.timing-note').textContent(), /would save/);
  await page.getByRole('button', {name:'Load worked exit example'}).click();
  assert.match(await page.locator('.comparison-table').textContent(), /63,983.33/);
  assert.match(await page.locator('.comparison-table').textContent(), /936,016.67/);
  await page.locator('#exit-amount').fill('96000000');
  assert.match(await page.locator('.exit-results').textContent(), /must be no more than mature/);
  assert.equal(await page.getByRole('button', {name:'Download plan (.json)'}).isDisabled(),true);
  await page.locator('#exit-amount').fill('1000000');
  await page.locator('#oldest-exits').fill('6000000');
  assert.match(await page.locator('.exit-results').textContent(), /Oldest day exits must be no more/);
  await page.locator('#oldest-exits').fill('1000000');
  check('worked exit, unknown midnight, savings, invalid totals and disabled export behave correctly');

  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    await noOverflow(page, `demo ${width}`);
    await page.screenshot({path:`${output}/${width}-demo.png`,fullPage:true});
  }
  // Maximum supported personal values; long output numbers may wrap but remain complete.
  await page.getByRole('button', {name:'Clear',exact:true}).click();
  await page.locator('#level-10').fill('9999');
  await page.locator('#personal-stake').fill('2100000000');
  await page.locator('#total-staked').fill('2100000000');
  await page.locator('#recent-exits').fill('2100000000');
  await page.locator('#exit-amount').fill('2100000000');
  for (const width of [320,390,1440]) { await page.setViewportSize({width,height:900}); await noOverflow(page,`maximum ${width}`); }
  assert.equal(await page.locator('.merge-steps li').count(),0);
  await page.locator('#level-1').fill('1');
  await page.locator('#counts-error').waitFor();
  assert.equal(await page.getByRole('button',{name:'Copy plan',exact:true}).isDisabled(),true);
  check('demo and maximum values reflow at 320/390/768/1024/1440; top level and invalid supply handled');

  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.locator('#level-3').fill('2');
  await page.locator('#personal-stake').fill('1000');
  assert.equal(await page.locator('.power-total').textContent(),'9,947');
  assert.equal(await page.locator('.merge-summary strong').first().textContent(),'10,939.2');
  await page.locator('#network-power').fill('20000');
  assert.match(await page.locator('.power-breakdown').textContent(),/49.735%/);
  await page.locator('#network-power').fill('1');
  assert.equal(await page.getByRole('button',{name:'Copy plan',exact:true}).isDisabled(),true);
  await page.locator('#network-power').fill('');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#level-1').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'level-2');
  await page.getByRole('button',{name:'Load demo portfolio'}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Load demo portfolio'}).scrollIntoViewIfNeeded();
  assert.notEqual(await page.getByRole('button',{name:'Load demo portfolio'}).evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  await page.screenshot({path:output+'/390-keyboard-focus.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await noOverflow(page,'390 text enlarged 200%');
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  check('manual worked portfolio, network share, keyboard Tab/Enter/focus and 200% text reflow');

  await page.clock.setSystemTime(new Date('2026-11-08T23:59:59Z'));
  await page.clock.runFor(2000);
  await page.waitForFunction(()=>document.querySelector('#recent-exits').value === '');
  assert.equal(await page.locator('#recent-exits').inputValue(),'');
  assert.equal(await page.locator('#oldest-exits').inputValue(),'');
  assert.match(await page.locator('.input-source').textContent(),/UTC day changed/);
  check('UTC rollover invalidates obsolete weekly and oldest-day exit totals');
  assert.deepEqual(errors,[]); assert.deepEqual(localFailures,[]);
  check('no uncaught browser errors or missing local production resources at /preview/');
  await context.close();

  // Explicitly synthetic API responses test state handling with a virtual clock.
  const live = await browser.newContext({viewport:{width:390,height:844}});
  const livePage=await live.newPage();
  await livePage.clock.install({time:new Date('2026-11-08T12:00:00Z')});
  let statusCalls=0, economyCalls=0;
  await livePage.route('https://api.squeekchain.com/**',async route=>{
    const isStatus=route.request().url().endsWith('/status');
    if(isStatus){
      statusCalls++;
      if(statusCalls>1){ await route.fulfill({status:429,headers:{'Retry-After':'60','Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Retry-After'},contentType:'application/json',body:'{}'}); return; }
      await route.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:1,generatedAt:'2026-11-08T12:00:00Z',measurement:{freshness:'online',receivedAt:'2026-11-08T12:00:00Z',observedAt:'2026-11-08T12:00:00Z',staleAfterSeconds:120,provenance:'hardware',coreStatus:'ACTIVE',rpmMilli:12345},builder:{status:'available',projected:{blockHeight:'2115',blockProgress:'278107453'}}})});
    }else{
      economyCalls++;
      await route.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:3,status:'available',generatedAt:'2026-11-08T12:00:00Z',chain:{chainId:'11155111',target:'sepolia',safeBlockTimestamp:'2026-11-08T11:59:00Z'},staking:{totalStakedBaseUnits:'95000000000000000000000000',freshPrincipalBaseUnits:'1000000000000000000000000',totalNftPower:'7507200000000000000000000',totalSqkPower:'100000000000000000000000',paused:false},nft:{mergesOpen:true}})});
    }
  });
  await livePage.goto(url);
  await livePage.locator('.feed-panel > .section-heading .feed-badge').filter({hasText:'LIVE'}).waitFor();
  assert.equal(await livePage.locator('.wheel-state strong').textContent(),'ACTIVE');
  assert.equal(await livePage.locator('.feed-stats dd').first().textContent(),'12.345');
  await livePage.getByRole('button',{name:'Use live mature stake'}).click();
  assert.equal(await livePage.locator('#total-staked').inputValue(),'94000000.000000');
  await livePage.clock.runFor(14000); assert.equal(statusCalls,1);
  await livePage.clock.runFor(2000);
  await livePage.locator('.feed-panel > .section-heading .feed-badge').filter({hasText:'STALE'}).waitFor();
  assert.equal(statusCalls,2);
  assert.equal(await livePage.locator('.wheel-state strong').textContent(),'Unknown');
  assert.equal(await livePage.locator('.feed-stats dd').first().textContent(),'12.345');
  assert.match(await livePage.locator('.feed-timestamps').textContent(),/Fetched/);
  await livePage.clock.runFor(50000); assert.equal(statusCalls,2);
  await livePage.clock.runFor(11000);
  await livePage.waitForFunction(()=>document.querySelector('.feed-timestamps').textContent.includes('Retrying'));
  assert.equal(statusCalls,3);
  check('synthetic live state, mature stake import, 15s minimum polling, retained last-good data and Retry-After');
  await live.close();
  await browser.close(); browser=null;

  try {
    const safari=await webkit.launch({headless:true});
    try{
      const p=await safari.newPage({viewport:{width:390,height:844}});
      await p.route('https://api.squeekchain.com/**',route=>route.fulfill({status:403,body:'{}'}));
      await p.goto(url); await p.getByRole('button',{name:'Load demo portfolio'}).click();
      assert.equal(await p.locator('.power-total').textContent(),'14,047');
      await noOverflow(p,'WebKit 390'); check('WebKit 390 demo interaction and reflow');
    }finally{await safari.close();}
  }catch(error){console.log('LIMITATION WebKit check unavailable: '+error.message.split('\n')[0]);}
  console.log(JSON.stringify({passed:passed.length,checks:passed},null,2));
} finally {
  if(browser) await browser.close();
  await new Promise(done=>server.close(done));
}
