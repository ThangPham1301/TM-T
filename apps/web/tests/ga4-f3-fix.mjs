// F3 final check — does a full document load send an extra page_view?
// Headed Chromium on the laptop, real app (localhost:3000), real gtag.js library.
// ALL outbound collection is BLOCKED: nothing is sent to Google; synthetic 204.
// No ga_capture. Uses ?ga_debug=1 so hits can be distinguished by debug_mode.
// Parser merges the request URL query (shared) with each POST body line BEFORE
// reading the event, and supports batch POST and GET. Records only: event, tid,
// cleaned page (pathname), time, navigation phase, _dbg, ep.debug_mode/epn.debug_mode.
// Never logs cookies, client/session IDs, tokens, sensitive URLs, or raw requests.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.GA4_TEST_ORIGIN ?? 'http://localhost:3000';
const PRODUCT = '/products/me-xung-gion';
const CATALOG = '/products';
const MID = 'G-06239FHPPM';
const WAIT_AFTER_ACTION_MS = 15000;
const RUNS_PER_CASE = 3;

const evidenceDir = fileURLToPath(new URL('../../../docs/04_testing/ga4/evidence/f3-fix/', import.meta.url));
mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});

const allRuns = [];
const cases = [];

function parseCollect(req) {
  const u = new URL(req.url());
  const shared = Object.fromEntries(u.searchParams);
  const body = req.postData() ?? '';
  const lines = body.split(/\r?\n/).filter(Boolean).map((x) => Object.fromEntries(new URLSearchParams(x)));
  const eventLines = lines.filter((x) => x.en);
  const merged = eventLines.length ? eventLines.map((e) => ({ ...shared, ...e })) : (shared.en ? [shared] : []);
  return merged.map((e) => ({
    event: e.en ?? null,
    tid: e.tid ?? null,
    page: (() => { try { const dl = e.dl ?? ''; const p = new URL(dl, BASE); return p.pathname; } catch { return null; } })(),
    dbg: e._dbg ?? null,
    debugMode: e['ep.debug_mode'] ?? e['epn.debug_mode'] ?? null,
  }));
}

async function runCase(caseName, actions) {
  const caseRuns = [];
  for (let run = 1; run <= RUNS_PER_CASE; run++) {
    const context = await browser.newContext();
    const hits = [];
    const consoleErrors = [];
    const blockedUrls = [];
    const startedAt = new Date().toISOString();
    await context.route('**/*', async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      const isLocal = u.origin === BASE;
      const isGtagLib = u.hostname === 'www.googletagmanager.com' && u.pathname === '/gtag/js';
      const isCollect = u.hostname.endsWith('google-analytics.com') || u.pathname.endsWith('/collect') || u.pathname.endsWith('/g/collect');
      if (isLocal || isGtagLib) return route.continue();
      // Block everything else: no request leaves this machine to Google or any
      // other third party. Log only host+path (no query, no cookies).
      blockedUrls.push(`${u.hostname}${u.pathname}`);
      if (isCollect) {
        for (const h of parseCollect(req)) hits.push({ ...h, at: new Date().toISOString(), phase: currentPhase });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
    let currentPhase = 'setup';
    const note = (phase) => { currentPhase = phase; };
    const wait = (ms) => page.waitForTimeout(ms);
    const startedLocal = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    try {
      await actions(page, note, wait);
    } catch (e) {
      consoleErrors.push(`action error: ${String(e).slice(0, 300)}`);
    }
    const pageViews = hits.filter((h) => h.event === 'page_view');
    caseRuns.push({ case: caseName, run, startedAt, startedLocal, pageViews, allHits: hits, consoleErrors: consoleErrors.slice(0, 10), blockedThirdParty: [...new Set(blockedUrls)].slice(0, 20) });
    console.log(JSON.stringify({ case: caseName, run, pageViewCount: pageViews.length, pageViews }));
    await context.close();
  }
  allRuns.push(...caseRuns);
  return caseRuns;
}

const withDebug = (path) => `${BASE}${path}?ga_debug=1`;

// Case A: open a public product URL directly.
cases.push(runCase('A-direct-open', async (page, note, wait) => {
  note('direct-open');
  await page.goto(withDebug(PRODUCT), { waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
}));

// Case B: full reload of the same document.
cases.push(runCase('B-reload', async (page, note, wait) => {
  note('initial-load');
  await page.goto(withDebug(PRODUCT), { waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
  note('reload-1');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
}));

// Case C: from catalog, click a product via SPA.
cases.push(runCase('C-spa-click', async (page, note, wait) => {
  note('catalog-load');
  await page.goto(withDebug(CATALOG), { waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
  const link = page.locator(`a[href="${PRODUCT}"]`).first();
  await link.waitFor({ timeout: 15000 });
  note('spa-click-to-product');
  await link.click();
  await wait(WAIT_AFTER_ACTION_MS);
}));

// Case D: back then forward between opened pages.
cases.push(runCase('D-back-forward', async (page, note, wait) => {
  note('catalog-load');
  await page.goto(withDebug(CATALOG), { waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
  const link = page.locator(`a[href="${PRODUCT}"]`).first();
  await link.waitFor({ timeout: 15000 });
  note('spa-click-to-product');
  await link.click();
  await wait(WAIT_AFTER_ACTION_MS);
  note('back-to-catalog');
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
  note('forward-to-product');
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
}));

// Case E: focus / rerender / data refresh, URL unchanged.
cases.push(runCase('E-focus-rerender', async (page, note, wait) => {
  note('product-load');
  await page.goto(withDebug(PRODUCT), { waitUntil: 'domcontentloaded' });
  await wait(WAIT_AFTER_ACTION_MS);
  note('focus-rerender');
  await page.mouse.click(400, 300);
  await page.evaluate(() => { window.blur(); window.focus(); });
  // Click a non-link tab/button on the product page if one exists (rerender, no URL change).
  const tab = page.locator('button[role="tab"], [role="tab"]').first();
  if (await tab.count()) { try { await tab.click({ timeout: 5000 }); } catch { /* no tab to click */ } }
  await wait(WAIT_AFTER_ACTION_MS);
}));

await Promise.all(cases);
await browser.close();

const summary = {};
for (const r of allRuns) {
  summary[r.case] = summary[r.case] ?? [];
  const byPhase = {};
  for (const h of r.pageViews) { byPhase[h.phase] = (byPhase[h.phase] ?? 0) + 1; }
  summary[r.case].push({ run: r.run, totalPageViews: r.pageViews.length, byPhase });
}
writeFileSync(evidenceDir + `matrix-${process.env.GA4_TEST_LABEL ?? 'dev'}.json`, JSON.stringify({
  date: '2026-11-24',
  scope: 'F3 page_view count on the wire; real gtag.js library loaded; ALL collection blocked (synthetic 204), NOT sent to Google; headed Chromium on laptop; ?ga_debug=1; no ga_capture',
  measurementId: MID,
  waitAfterActionMs: WAIT_AFTER_ACTION_MS,
  runsPerCase: RUNS_PER_CASE,
  summary,
  runs: allRuns,
}, null, 2));
console.log('SUMMARY ' + JSON.stringify(summary, null, 2));

for (const run of allRuns) {
  assert.equal(run.consoleErrors.filter(x=>x.startsWith('action error:') || x.startsWith('pageerror:')).length, 0, `${run.case} actions`);
  const expected = {'A-direct-open':1,'B-reload':2,'C-spa-click':2,'D-back-forward':4,'E-focus-rerender':1}[run.case];
  assert.equal(run.pageViews.length, expected, `${run.case} run ${run.run}: pageview count`);
  for (const h of run.allHits) {
    assert.equal(h.tid, MID, 'destination');
    assert.ok(h.debugMode === 'true' || h.debugMode === '1' || h.dbg === '1', `debug missing: ${h.event}`);
  }
  const byPhase=Object.values(run.pageViews.reduce((m,h)=>(m[h.phase]=(m[h.phase]??0)+1,m),{}));
  assert.ok(byPhase.every(n=>n===1), 'one view per navigation');
  if (['A-direct-open','B-reload','E-focus-rerender'].includes(run.case)) assert.ok(run.allHits.some(h=>h.event==='view_item'),'view_item still sent');
}
console.log('PASS all 15 runs: exact pageviews, destination, debug and item event presence');
