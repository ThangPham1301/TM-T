// price_source wire check — capture view_item item parameters on the wire.
// Blocked collection (synthetic 204); nothing is sent to Google.
// Parses the GA4 item fields (pr1) and the item-scoped custom param k0price_source.
// Records only: event, item_id, item_category, price, quantity, price_source.
// Never logs client/session IDs, cookies, tokens, or raw requests.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.GA4_TEST_ORIGIN ?? 'http://localhost:3000';
const evidenceDir = fileURLToPath(new URL('../../../docs/04_testing/ga4/evidence/f3-fix/', import.meta.url));
mkdirSync(evidenceDir, { recursive: true });

// Product slugs to check: BASE (me-xung-gion) and SCHEDULE fixture (banh-dau-xanh-trai-cay, if rule still active).
const targets = [
  { label: 'BASE', path: '/products/me-xung-gion' },
  { label: 'SCHEDULE?', path: '/products/banh-dau-xanh-trai-cay' },
];

const browser = await chromium.launch({
  headless: false,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});

function parseItemFields(merged) {
  // GA4 item params: pr1 = item fields joined by ~ ; item-scoped custom params
  // appear as k0<name>~v0<value> pairs inside the same pr field.
  const items = [];
  for (const key of Object.keys(merged)) {
    if (!/^pr\d+$/.test(key)) continue;
    const parts = String(merged[key]).split('~');
    const item = { prField: key };
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.startsWith('id')) item.item_id = p.slice(2);
      else if (p.startsWith('nm')) item.item_name = p.slice(2);
      else if (p.startsWith('ca')) item.item_category = p.slice(2);
      else if (p.startsWith('pr')) item.price = p.slice(2);
      else if (p.startsWith('qt')) item.quantity = p.slice(2);
      else if (p.startsWith('k0')) {
        const name = p.slice(2);
        const val = parts[i + 1] && parts[i + 1].startsWith('v0') ? parts[i + 1].slice(2) : null;
        if (name === 'price_source') item.price_source = val;
        else item[`custom_${name}`] = val;
        i++;
      }
    }
    items.push(item);
  }
  return items;
}

const out = [];
for (const t of targets) {
  const context = await browser.newContext();
  const viewItems = [];
  const consoleErrors = [];
  await context.route('**/*', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const isLocal = u.origin === BASE;
    const isGtagLib = u.hostname === 'www.googletagmanager.com' && u.pathname === '/gtag/js';
    if (isLocal || isGtagLib) return route.continue();
    const isCollect = u.hostname.endsWith('google-analytics.com') || u.pathname.endsWith('/collect') || u.pathname.endsWith('/g/collect');
    if (isCollect) {
      const shared = Object.fromEntries(u.searchParams);
      const body = req.postData() ?? '';
      const lines = body.split(/\r?\n/).filter(Boolean).map((x) => Object.fromEntries(new URLSearchParams(x)));
      const eventLines = lines.filter((x) => x.en);
      const merged = eventLines.length ? eventLines.map((e) => ({ ...shared, ...e })) : (shared.en ? [shared] : []);
      for (const e of merged) {
        if (e.en === 'view_item') {
          viewItems.push({ event: 'view_item', debugMode: e['ep.debug_mode'] ?? e['epn.debug_mode'] ?? null, items: parseItemFields(e), at: new Date().toISOString() });
        }
      }
    }
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}${t.path}?ga_debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(15000);
  out.push({ target: t.label, path: t.path, viewItems, consoleErrors: consoleErrors.slice(0, 5) });
  console.log(JSON.stringify({ target: t.label, viewItems }));
  await context.close();
}
await browser.close();
writeFileSync(evidenceDir + 'price-source-after-fix.json', JSON.stringify({
  date: '2026-11-24',
  scope: 'price_source at item level on the wire; real gtag.js library; ALL collection blocked (synthetic 204), NOT sent to Google; headed Chromium; ?ga_debug=1; view_item only',
  results: out,
}, null, 2));
console.log('DONE');

for(const row of out){
 const item=row.viewItems[0]?.items[0];
 if(!item || row.viewItems.length!==1 || item.price_source!==(row.target==='BASE'?'BASE':'SCHEDULE') || Number(item.price)!==(row.target==='BASE'?65000:130000))throw Error('price source regression: '+row.target);
}
console.log('PASS BASE and SCHEDULE item source and price');
