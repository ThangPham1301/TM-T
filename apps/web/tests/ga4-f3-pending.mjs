// Isolated frontend integration: real Next UI + deterministic intercepted API fixtures.
// This does NOT validate the production database or Google DebugView.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const output=fileURLToPath(new URL('../../../docs/04_testing/ga4/evidence/f3-fix/',import.meta.url));
mkdirSync(output,{recursive:true});
const origin=process.env.GA4_TEST_ORIGIN ?? 'http://localhost:3000';
let browser;
const product={id:'11111111-1111-4111-8111-111111111111',slug:'ga4-test-tea',name:'Trà kiểm thử GA4',category:'tra-cung-dinh',price:50000,basePrice:50000,
  description:'Dữ liệu QA cục bộ',stock:100,active:true,image:'/images/product-placeholder.svg',revision:1,
  pricing:{amount:50000,basePrice:50000,source:'BASE'}};
const offer={id:'22222222-2222-4222-8222-222222222222',revision:1,name:'Ưu đãi QA',scope:'CART',productId:'',productIds:[],productName:'',productSlug:'',
  condition:'QUANTITY',minimum:2,method:'FIXED',value:10000,startsAt:'2020-01-01T00:00:00Z',endsAt:'2099-01-01T00:00:00Z',featured:true,priority:1,message:'Fixture, không phải chiến dịch thật'};
const shipping={id:'shipping',revision:1,enabled:true,baseFee:20000,freeShippingThreshold:0};

async function fixture(type='guest',reloadFailure=false) {
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const events=[],google=[],errors=[],wire=[]; let loads=0;
  await context.exposeBinding('__qaCapture',(_source,event)=>{events.push(event);});
  await context.addInitScript(()=>{
    let ring;
    Object.defineProperty(window,'__goiHueAnalytics',{configurable:true,get(){return ring;},set(value){
      ring=value;const push=value.push.bind(value);value.push=(...items)=>{for(const item of items) void window.__qaCapture(item);return push(...items);};
    }});
  });
  let quantity=0,operation=0,order=null,posted=false;
  function measurement(method) {
    const discount=quantity>=2?10000:0,subtotal=quantity*50000;
    return {schemaVersion:1,currency:'VND',subtotal,discountAmount:discount,netSubtotal:subtotal-discount,shippingFee:20000,total:subtotal-discount+20000,
      ...(discount?{discount:{id:offer.id,revision:1,name:offer.name}}:{}),
      ...(method?{transactionId:'GH-QATEST01',paymentMethod:method}:{}),
      items:quantity?[{productId:product.id,name:product.name,categoryCode:product.category,quantity,unitPrice:50000,priceSource:'BASE',lineDiscountAmount:discount,lineNetTotal:subtotal-discount}]:[]};
  }
  function summary() {
    const m=measurement();return {...m,measurement:m,cartToken:'a'.repeat(64),quoteToken:'b'.repeat(64),priceToken:'c'.repeat(64),shipping,
      items:quantity?[{id:'line',productId:product.id,name:product.name,category:product.category,price:50000,currentPrice:50000,pricing:product.pricing,currentPricing:product.pricing,
        quantity,stock:100,available:true,priceChanged:false,image:product.image,revision:1}]:[]};
  }
  await context.route('**/api/store/**',async route=>{
    const path=new URL(route.request().url()).pathname.replace('/api/store/','');
    let body={},status=200;
    if(path==='state') {
      if(type==='guest') {status=401;body={message:'Guest fixture'};}
      else if(posted&&reloadFailure) {status=500;body={message:'Synthetic reload failure'};}
      else body={user:{id:'user',name:'QA account',role:'CUSTOMER'},addresses:[],orders:order?[order]:[],privacy:[],returns:[],consents:[],policy:{id:'policy'},cartCount:quantity};
    } else if(path==='products') body=[product];
    else if(path===`products/${product.slug}`) body=product;
    else if(path==='categories') body=[{id:'category',code:product.category,name:'Trà Huế',active:true}];
    else if(path==='pricing') body={asOf:new Date().toISOString(),prices:{[product.id]:product.pricing},hasScheduledPrices:false};
    else if(path==='discounts') body={offers:[offer],asOf:new Date().toISOString()};
    else if(path==='shipping') body=shipping;
    else if(path.endsWith('cart/summary')) body=summary();
    else if(path==='guest/commerce'||path==='commerce') {
      const input=route.request().postDataJSON();
      if(input.action==='cart-set'||input.action==='cart-clear') {
        const previous=quantity;quantity=input.action==='cart-clear'?0:input.quantity;
        body={...product,productId:product.id,quantity,measurementMutation:{schemaVersion:1,operationId:`operation-${++operation}`,changes:[{
          productId:product.id,name:product.name,categoryCode:product.category,previousQuantity:previous,newQuantity:quantity,effectiveUnitPrice:50000,priceSource:'BASE'}]}};
      } else if(input.action==='checkout') {
        const m=measurement(input.paymentMethod||'COD');
        order={id:'order-qa',number:m.transactionId,createdAt:new Date().toISOString(),status:'PLACED',paymentMethod:m.paymentMethod,paymentStatus:'UNPAID',
          subtotal:m.subtotal,discountAmount:m.discountAmount,shippingFee:20000,total:m.total,measurement:m,
          // Deliberately outside the safe DTO: these must not appear in captured analytics.
          phone:'0900000000',address:'PRIVATE_SYNTHETIC_ADDRESS',recipient:'PRIVATE_SYNTHETIC_RECIPIENT',lookupCode:'PRIVATE_LOOKUP_CODE',
          items:[{productId:product.id,name:product.name,quantity,price:50000,image:product.image}],history:[],revision:1,
          ...(m.paymentMethod==='VIETQR'?{payment:{method:'VIETQR',status:'PENDING',payload:'SYNTHETIC_QA_QR',expiresAt:'2099-01-01T00:00:00Z'}}:{})};
        quantity=0;posted=true;body=order;
      } else body={ok:true};
    } else if(path.startsWith('guest/orders/')) body=order??{};
    else body=[];
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin===origin)return route.fallback();
    if(u.hostname==='www.googletagmanager.com'&&u.pathname==='/gtag/js'){if(++loads===1)return route.abort('blockedbyclient');return route.continue();}
    if(u.pathname.endsWith('/collect')) {
      const shared=Object.fromEntries(u.searchParams);
      const lines=(req.postData()??'').split(/\r?\n/).filter(Boolean).map(x=>Object.fromEntries(new URLSearchParams(x)));
      const bodyEvents=lines.filter(x=>x.en);
      for(const e of (bodyEvents.length?bodyEvents.map(e=>({...shared,...e})):shared.en?[shared]:[]))wire.push({event:e.en,tid:e.tid,debug:e['ep.debug_mode']??e['epn.debug_mode']??e._dbg,value:e['epn.value'],currency:e.cu,shipping:e['epn.shipping'],transactionId:e['ep.transaction_id'],items:Object.keys(e).filter(k=>/^pr\d+$/.test(k)).map(k=>e[k])});
    }
    return route.fulfill({status:204,body:''});
  });
  return {context,page,events,google,errors,wire};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=10000) {const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}

try {
 browser=await chromium.launch({headless:false,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
 const f=await fixture(),{page,events}=f;
 await page.goto(`${origin}/products/${product.slug}?ga_debug=1`);
 await page.getByRole('button',{name:/Mua ngay/i}).click();await page.waitForURL('**/checkout');
 await until(()=>events.some(e=>e.name==='begin_checkout'),'checkout event');
 await page.locator('input[name="recipient"]').fill('PRIVATE_SYNTHETIC_RECIPIENT');
 await page.locator('input[name="phone"]').fill('0900000000');
 await page.locator('textarea[name="address"]').fill('PRIVATE_SYNTHETIC_ADDRESS');
 await page.getByRole('button',{name:'Xác nhận đặt hàng',exact:true}).click();
 await page.waitForURL('**/tra-cuu-don-hang?**');
 assert.equal(events.filter(e=>e.name==='purchase').length,1);
 assert.equal(f.wire.length,0,'tag was blocked before order, no immediate wire');
 await page.goto(`${origin}/products?ga_debug=1`);
 await until(()=>f.wire.some(e=>e.event==='purchase'),'pending purchase replay on public return',30000);
 await page.reload();await page.waitForTimeout(18000);
 const purchases=f.wire.filter(e=>e.event==='purchase');
 assert.equal(purchases.length,1);assert.equal(purchases[0].transactionId,'GH-QATEST01');
 assert.equal(Number(purchases[0].value),50000);assert.deepEqual(f.errors,[]);
 writeFileSync(output+'pending-wire-results.json',JSON.stringify({status:'PASS',scope:'synthetic order, first tag blocked, replay on public return; ALL collection intercepted, no Google ingestion',wire:f.wire},null,2));
 console.log('PASS blocked-at-order purchase replayed once on public return; reload did not repeat');
 await f.context.close();
} finally {if(browser)await browser.close();}
