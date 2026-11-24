import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const origin=process.env.GA4_TEST_ORIGIN??'http://127.0.0.1:3106';
const output=fileURLToPath(new URL('../../../docs/04_testing/ga4/evidence/f3-fix/',import.meta.url));
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:false,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const results=[];
try {
 await Promise.all(['normal','delayed-debug','blocked-tag'].map(async mode=>{
  const context=await browser.newContext(), hits=[],errors=[];
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===origin)return route.continue();
   if(u.hostname==='www.googletagmanager.com'&&u.pathname==='/gtag/js') {
    if(mode==='blocked-tag')return route.abort('blockedbyclient');
    if(mode==='delayed-debug')await new Promise(r=>setTimeout(r,8000));
    return route.continue();
   }
   if(u.pathname.endsWith('/collect')) {
    const shared=Object.fromEntries(u.searchParams),lines=(req.postData()??'').split(/\r?\n/).filter(Boolean).map(x=>Object.fromEntries(new URLSearchParams(x)));
    const body=lines.filter(x=>x.en);
    for(const e of (body.length?body.map(e=>({...shared,...e})):shared.en?[shared]:[]))hits.push({event:e.en,tid:e.tid,debug:e['ep.debug_mode']??e['epn.debug_mode']??e._dbg??null,page:new URL(e.dl,origin).pathname});
   }
   return route.fulfill({status:204,body:''});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/products'+(mode==='normal'?'':'?ga_debug=1'));
  await page.locator('a[href="/products/me-xung-gion"]').first().click();
  await page.getByRole('heading',{name:'Mè Xửng Giòn Cố Đô',exact:true}).waitFor();
  await page.waitForTimeout(mode==='delayed-debug'?25000:18000);
  const views=hits.filter(h=>h.event==='page_view');
  assert.deepEqual(errors,[]);
  assert.equal(views.length,mode==='blocked-tag'?0:2,mode+' pageviews');
  if(mode!=='blocked-tag') {
   assert.deepEqual(views.map(h=>h.page),['/products','/products/me-xung-gion']);
   assert.ok(hits.some(h=>h.event==='view_item'));
   for(const h of hits){assert.equal(h.tid,'G-06239FHPPM');if(mode==='normal')assert.equal(h.debug,null);else assert.ok(['true','1'].includes(h.debug));}
  }
  results.push({mode,status:'PASS',hits,errors});console.log('PASS '+mode);
  await context.close();
 }));
} finally {
 writeFileSync(output+'loader-regression.json',JSON.stringify({scope:'real built app and real gtag; all collection intercepted; no Google ingestion',results},null,2));
 await browser.close();
}
