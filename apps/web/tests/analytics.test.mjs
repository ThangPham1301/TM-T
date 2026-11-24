import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

async function sourceModule(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}
function moduleUrl(source) {
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  return 'data:text/javascript;base64,'+Buffer.from(output).toString('base64');
}
async function runtimeModule() {
  const policy=moduleUrl(readFileSync(new URL('../src/lib/analytics-policy.ts',import.meta.url),'utf8'));
  const commerce=moduleUrl(readFileSync(new URL('../src/lib/analytics-commerce.ts',import.meta.url),'utf8'));
  const source=readFileSync(new URL('../src/lib/analytics.ts',import.meta.url),'utf8')
    .replace('"./analytics-policy"',JSON.stringify(policy)).replace('"./analytics-commerce"',JSON.stringify(commerce));
  return import(moduleUrl(source+`\n// instance ${Math.random()}`));
}
function browserGlobals() {
  const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();
  globalThis.location=new URL('http://localhost/checkout');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{doNotTrack:'0'}});
  globalThis.document={referrer:'',head:{appendChild(){}},createElement:()=>({})};
  const calls=[];globalThis.window={location:globalThis.location,gtag:(...args)=>calls.push(args)};
  process.env.NEXT_PUBLIC_GA_ENABLED='true';process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID='G-QATEST';
  return calls;
}
const { measurementItems, mutationEvents, quoteParams } = await sourceModule('../src/lib/analytics-commerce.ts');
const { cleanAnalyticsUrl, measuredPath, pageKey, safeSearchTerm } = await sourceModule('../src/lib/analytics-policy.ts');
const snapshot = () => ({ schemaVersion:1,currency:'VND',transactionId:'GH-TEST0001',paymentMethod:'COD',subtotal:150000,discountAmount:10000,
  netSubtotal:140000,shippingFee:20000,total:160000,discount:{id:'offer-test',revision:1,name:'Test offer'},
  items:[{productId:'product-1',name:'Tea',categoryCode:'tra-cung-dinh',quantity:3,unitPrice:50000,priceSource:'BASE',lineDiscountAmount:10000,lineNetTotal:140000}] });

test('manual-pageview and privacy defaults are queued before tag initialization and loading', async () => {
  const calls=browserGlobals();
  location.search='?ga_debug=1';
  let loaded=0;
  document.head.appendChild=()=>{
    loaded++;
    assert.equal(calls[0][0],'set');
    assert.deepEqual(calls[0][1],{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,debug_mode:true});
    assert.equal(calls[1][0],'js');
    assert.equal(calls[2][0],'config');
  };
  const runtime=await runtimeModule();
  runtime.trackEvent('page_view',{page_title:'Checkout'});
  runtime.trackEvent('page_view',{page_title:'Checkout again'});
  assert.equal(loaded,1);
  assert.equal(calls.filter(x=>x[0]==='config').length,1);
  assert.equal(calls.filter(x=>x[0]==='event'&&x[1]==='page_view').length,2);
});

test('GA4 defaults on for the project stream and explicit opt-out or invalid ID still disables it',async()=>{
  const calls=browserGlobals();
  delete process.env.NEXT_PUBLIC_GA_ENABLED;delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const runtime=await runtimeModule();
  assert.equal(runtime.trackEvent('page_view',{page_title:'Default configuration'}),true);
  assert.equal(calls.find(x=>x[0]==='config')[1],'G-06239FHPPM');
  assert.equal(calls.find(x=>x[0]==='set')[1].send_page_view,false);
  const count=calls.length;
  process.env.NEXT_PUBLIC_GA_ENABLED='false';
  assert.equal(runtime.trackEvent('view_story',{story_id:'tea'}),false);
  process.env.NEXT_PUBLIC_GA_ENABLED='true';process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID='';
  assert.equal(runtime.trackEvent('view_story',{story_id:'tea'}),false);
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID='invalid';
  assert.equal(runtime.trackEvent('view_story',{story_id:'tea'}),false);
  assert.equal(calls.length,count);
});
test('whole-VND split preserves quantities, merchandise and discount totals', () => {
  const items = measurementItems(snapshot());
  assert.equal(items.length,2);
  assert.equal(items.reduce((n,i)=>n+i.quantity,0),3);
  assert.equal(items.reduce((n,i)=>n+i.price*i.quantity,0),140000);
  assert.equal(items.reduce((n,i)=>n+i.discount*i.quantity,0),10000);
  assert.equal(items[0].item_id,items[1].item_id);
});
test('purchase uses net total, shipping separately and same identity for guest/account', () => {
  for (const type of ['guest','account']) {
    const [event] = mutationEvents('checkout',{measurement:snapshot(),phone:'DO_NOT_COPY'},type,'checkout');
    assert.equal(event.params.value,140000); assert.equal(event.params.shipping,20000);
    assert.equal(event.params.transaction_id,'GH-TEST0001'); assert.equal(event.params.checkout_type,type);
    assert.equal(event.dedup,'purchase:GH-TEST0001'); assert.ok(!JSON.stringify(event).includes('DO_NOT_COPY'));
  }
});
test('cart quantities are deltas, deletion and no-op are handled', () => {
  const change={productId:'p',name:'Tea',categoryCode:'tra',previousQuantity:2,newQuantity:5,effectiveUnitPrice:50000,priceSource:'BASE'};
  const result={measurementMutation:{schemaVersion:1,operationId:'op',changes:[change]}};
  assert.equal(mutationEvents('cart-set',result,'guest','assistant')[0].params.items[0].quantity,3);
  change.newQuantity=0; assert.equal(mutationEvents('cart-set',result,'guest','cart')[0].name,'remove_from_cart');
  change.newQuantity=2; assert.deepEqual(mutationEvents('cart-set',result,'guest','cart'),[]);
  assert.deepEqual(mutationEvents('cart-refresh',result,'guest','cart'),[]);
});
test('invalid or historical snapshots never fabricate a purchase', () => {
  assert.throws(()=>mutationEvents('checkout',{},'guest','checkout'));
  const s=snapshot(); s.total=150000; assert.throws(()=>measurementItems(s));
  const s2=snapshot(); delete s2.discount; assert.throws(()=>quoteParams(s2));
  const s3=snapshot(); s3.items[0].quantity=0; assert.throws(()=>measurementItems(s3));
});

test('atomic reorder queues only safe net deltas and replay does not duplicate them',async()=>{
  const calls=browserGlobals();
  globalThis.location=new URL('http://localhost/account/orders');window.location=location;
  const runtime=await runtimeModule();
  const result={measurementMutation:{schemaVersion:1,operationId:'reorder-op',changes:[
    {productId:'tea',name:'Tea',categoryCode:'tra',previousQuantity:1,newQuantity:3,effectiveUnitPrice:60000,priceSource:'SCHEDULE'},
    {productId:'old',name:'Old tea',categoryCode:'tra',previousQuantity:2,newQuantity:0,effectiveUnitPrice:50000,priceSource:'BASE'}
  ]},sourceOrderId:'DO_NOT_COPY',recipient:{phone:'DO_NOT_COPY'}};
  runtime.dispatchCommerce('reorder',result,'account','reorder');
  assert.equal(calls.length,0,'private route sends no tag/event');
  globalThis.location=new URL('http://localhost/checkout?reorder=DO_NOT_COPY');window.location=location;
  runtime.flushPendingCommerce();runtime.flushPendingCommerce();
  runtime.dispatchCommerce('reorder',result,'account','reorder');
  const events=calls.filter(x=>x[0]==='event');
  assert.deepEqual(events.map(x=>x[1]),['add_to_cart','remove_from_cart']);
  assert.equal(events[0][2].items[0].quantity,2);
  assert.equal(events[0][2].items[0].price_source,'SCHEDULE');
  assert.ok(events.every(x=>x[2].source_surface==='reorder'));
  assert.ok(!JSON.stringify(events).includes('DO_NOT_COPY'));
});
test('effective non-BASE price does not get another offer reduction', () => {
  const s=snapshot(); s.discountAmount=0;s.subtotal=135000;s.netSubtotal=135000;s.total=155000;delete s.discount;
  Object.assign(s.items[0],{unitPrice:45000,priceSource:'SCHEDULE',lineDiscountAmount:0,lineNetTotal:135000});
  assert.equal(measurementItems(s)[0].price,45000); assert.equal(measurementItems(s)[0].discount,0);
  assert.equal(quoteParams(s).has_auto_discount,'no');
});
test('raw search/order/token/hash never enter analytics URLs; controlled UTM retained', () => {
  const clean=cleanAnalyticsUrl('https://goihue.io.vn/products?q=private%40example.com&don=GH-SECRET&token=secret&utm_source=tiktok&utm_campaign=goihue_20261123#phone');
  assert.equal(clean,'https://goihue.io.vn/products?utm_source=tiktok&utm_campaign=goihue_20261123');
  assert.equal(cleanAnalyticsUrl('https://goihue.io.vn/account/orders?order=secret'),'https://goihue.io.vn/');
  assert.equal(pageKey(clean),'/products');
});
test('private routes and sensitive search strings are rejected', () => {
  for (const p of ['/admin','/account/orders','/tra-cuu-don-hang','/login']) assert.equal(measuredPath(p),false);
  assert.equal(measuredPath('/products/tea'),true);
  assert.equal(safeSearchTerm('private@example.com'),undefined);
  assert.equal(safeSearchTerm('0901234567'),undefined);
  assert.equal(safeSearchTerm('  trà   sen '),'trà sen');
});
test('runtime success is recorded once, before callbacks, without losing confirmed dedup on later events',async()=>{
  const calls=browserGlobals(),runtime=await runtimeModule();
  const result={measurement:snapshot()};
  runtime.dispatchCommerce('checkout',result,'guest','checkout');
  runtime.dispatchCommerce('checkout',result,'guest','checkout');
  let purchases=calls.filter(a=>a[0]==='event'&&a[1]==='purchase');assert.equal(purchases.length,1);
  assert.equal(JSON.parse(sessionStorage.getItem('goihue:ga4:pending:v1')).length,1);
  purchases[0][2].event_callback();
  assert.equal(JSON.parse(sessionStorage.getItem('goihue:ga4:pending:v1')).length,0);
  runtime.trackEvent('view_story',{story_id:'tea'},'another-event');
  const afterReload=await runtimeModule();afterReload.dispatchCommerce('checkout',result,'guest','checkout');
  purchases=calls.filter(a=>a[0]==='event'&&a[1]==='purchase');assert.equal(purchases.length,1);
});
test('unprocessed purchase survives document replacement and is retried with the same transaction',async()=>{
  const calls=browserGlobals(),first=await runtimeModule();first.dispatchCommerce('checkout',{measurement:snapshot()},'guest','checkout');
  const restored=await runtimeModule();restored.flushPendingCommerce();
  const purchases=calls.filter(a=>a[0]==='event'&&a[1]==='purchase');assert.equal(purchases.length,2);
  assert.equal(purchases[0][2].transaction_id,purchases[1][2].transaction_id);
  purchases[1][2].event_callback();assert.equal(JSON.parse(sessionStorage.getItem('goihue:ga4:pending:v1')).length,0);
});
test('runtime rejects raw response fields/PII and never sends while disabled or on private routes',async()=>{
  const calls=browserGlobals(),runtime=await runtimeModule();
  assert.equal(runtime.trackEvent('purchase',{phone:'0901234567'}),false);
  assert.equal(runtime.trackEvent('search',{search_term:'person@example.invalid'}),false);
  assert.equal(runtime.trackEvent('view_item',{items:[{item_id:'p',item_name:'person@example.invalid',item_category:'tea',price:1,quantity:1}]}),false);
  assert.equal(calls.length,0);
  process.env.NEXT_PUBLIC_GA_ENABLED='false';assert.equal(runtime.trackEvent('view_story',{story_id:'tea'}),false);
  process.env.NEXT_PUBLIC_GA_ENABLED='true';globalThis.location=new URL('http://localhost/account/orders?order=secret');window.location=location;
  assert.equal(runtime.trackEvent('view_story',{story_id:'tea'}),false);assert.equal(calls.length,0);
});
