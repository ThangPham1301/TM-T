// Isolated frontend integration: real Next UI + deterministic intercepted API fixtures.
// This does NOT validate the production database or Google DebugView.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const cwd=fileURLToPath(new URL('..',import.meta.url));
const output=fileURLToPath(new URL('../../../docs/04_testing/ga4/evidence/',import.meta.url));
mkdirSync(output,{recursive:true});
const probe=createServer(); await new Promise(r=>probe.listen(0,'127.0.0.1',r));
const port=probe.address().port; await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{
  cwd, windowsHide:true, env:{...process.env,NEXT_PUBLIC_GA_ENABLED:'true',NEXT_PUBLIC_GA_MEASUREMENT_ID:'G-QATEST',
    NEXT_PUBLIC_AI_CHAT_ENABLED:'false',NEXT_PUBLIC_RECOMMENDATIONS_ENABLED:'false',API_UPSTREAM_URL:'http://127.0.0.1:9/api/v1'}
});
let logs=''; server.stdout.on('data',s=>logs+=s); server.stderr.on('data',s=>logs+=s);
const checks=[]; let browser;
const pass=name=>{checks.push(name);console.log('PASS '+name);};
const product={id:'11111111-1111-4111-8111-111111111111',slug:'ga4-test-tea',name:'Trà kiểm thử GA4',category:'tra-cung-dinh',price:50000,basePrice:50000,
  description:'Dữ liệu QA cục bộ',stock:100,active:true,image:'/images/product-placeholder.svg',revision:1,
  pricing:{amount:50000,basePrice:50000,source:'BASE'}};
const offer={id:'22222222-2222-4222-8222-222222222222',revision:1,name:'Ưu đãi QA',scope:'CART',productId:'',productIds:[],productName:'',productSlug:'',
  condition:'QUANTITY',minimum:2,method:'FIXED',value:10000,startsAt:'2020-01-01T00:00:00Z',endsAt:'2099-01-01T00:00:00Z',featured:true,priority:1,message:'Fixture, không phải chiến dịch thật'};
const shipping={id:'shipping',revision:1,enabled:true,baseFee:20000,freeShippingThreshold:0};

async function fixture(type='guest',reloadFailure=false) {
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const events=[],google=[],errors=[];
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
  context.on('request',r=>{if(/google-analytics|googletagmanager/.test(r.url()))google.push(r.url());});
  return {context,page,events,google,errors};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=10000) {const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
try {
  await until(()=>logs.includes('Ready')&&server.exitCode===null,'Next fixture server',60000);
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
  {
    const f=await fixture();const {page,events}=f;
    await page.goto(`${origin}/products?ga_capture=1&utm_source=tiktok&utm_campaign=qa_local&q=PRIVATE%40example.invalid`);
    await page.getByRole('button',{name:'Từ khóa: PRIVATE@example.invalid ×'}).click();
    const card=page.locator('article.lan-product').first();await card.waitFor();await card.scrollIntoViewIfNeeded();
    await until(()=>events.some(e=>e.name==='view_item_list'),'catalog exposure');
    const n=events.filter(e=>e.name==='view_item_list').length;await page.waitForTimeout(2200);
    assert.equal(events.filter(e=>e.name==='view_item_list').length,n);
    assert.ok(!JSON.stringify(events).includes('PRIVATE@'));assert.ok(events.some(e=>e.params.page_location.includes('utm_source=tiktok')));
    await card.getByRole('link',{name:'Chọn mua →'}).click();
    await until(()=>events.some(e=>e.name==='view_item'),'detail event');
    assert.equal(events.filter(e=>e.name==='select_item').length,1);
    await page.locator('#product-quantity').fill('2');
    await page.getByRole('button',{name:'Thêm vào giỏ hàng',exact:true}).click();
    await until(()=>events.filter(e=>e.name==='add_to_cart').length===1,'first cart delta');
    await page.locator('#product-quantity').fill('3');
    await page.getByRole('button',{name:'Thêm vào giỏ hàng',exact:true}).click();
    await until(()=>events.filter(e=>e.name==='add_to_cart').length===2,'second cart delta');
    assert.deepEqual(events.filter(e=>e.name==='add_to_cart').map(e=>e.params.items[0].quantity),[2,3]);
    await page.locator('.lan-tab-content').scrollIntoViewIfNeeded();
    await until(()=>events.some(e=>e.name==='view_story'&&e.params.story_surface==='product_detail'),'default product story exposure');
    const storyViews=events.filter(e=>e.name==='view_story'&&e.params.story_surface==='product_detail').length;
    await page.getByRole('tab',{name:'Thông số & Thành phần'}).click();
    await page.getByRole('tab',{name:'Câu chuyện phong vị'}).click();
    await page.waitForTimeout(1300);
    assert.equal(events.filter(e=>e.name==='view_story'&&e.params.story_surface==='product_detail').length,storyViews);
    pass('real catalog/detail UI: visible list, one selection, clean UTM URL, deltas 2 then 3, story tab remount does not duplicate');
    await page.screenshot({path:output+'product-ui.png'});
    assert.equal(f.google.length,0);assert.deepEqual(f.errors,[]);await f.context.close();
  }
  for(const type of ['guest','account'])for(const method of ['COD','VIETQR']) {
    const reloadFailure=type==='account'&&method==='COD';
    const f=await fixture(type,reloadFailure);const {page,events}=f;
    await page.goto(`${origin}/products/${product.slug}?ga_capture=1`);
    const chosenQuantity=type==='guest'&&method==='COD'?3:1;
    if(chosenQuantity===3)await page.locator('#product-quantity').fill('3');
    const buy=page.getByRole('button',{name:/Mua ngay/i});await buy.waitFor();
    await buy.click();await page.waitForURL('**/checkout');
    await until(()=>events.some(e=>e.name==='begin_checkout'),'checkout event');
    assert.equal(events.filter(e=>e.name==='add_to_cart').length,1);
    assert.equal(events.find(e=>e.name==='add_to_cart').params.items[0].quantity,chosenQuantity);
    if(type==='guest'&&method==='COD') {
      await page.waitForTimeout(16000);
      assert.equal(events.filter(e=>e.name==='begin_checkout').length,1);
    }
    await page.locator('input[name="recipient"]').fill('PRIVATE_SYNTHETIC_RECIPIENT');
    await page.locator('input[name="phone"]').fill('0900000000');
    await page.locator('textarea[name="address"]').fill('PRIVATE_SYNTHETIC_ADDRESS');
    if(method==='VIETQR')await page.getByRole('radio',{name:/VietQR/}).check();
    await page.getByRole('button',{name:method==='COD'?'Xác nhận đặt hàng':/Đặt hàng & mở VietQR/}).click();
    await until(()=>events.some(e=>e.name==='purchase'),'purchase dispatch');
    const purchases=events.filter(e=>e.name==='purchase');assert.equal(purchases.length,1);
    assert.equal(purchases[0].params.value,chosenQuantity===3?140000:50000);assert.equal(purchases[0].params.shipping,20000);
    assert.equal(purchases[0].params.items.reduce((n,i)=>n+i.price*i.quantity,0),purchases[0].params.value);
    if(chosenQuantity===3) {
      assert.equal(purchases[0].params.offer_id,offer.id);
      assert.equal(purchases[0].params.items.reduce((n,i)=>n+i.discount*i.quantity,0),10000);
    }
    assert.equal(purchases[0].params.payment_method,method);assert.equal(purchases[0].params.checkout_type,type);
    assert.ok(!/PRIVATE_|0900000000/.test(JSON.stringify(events)));
    if(type==='guest') {
      await page.waitForURL('**/tra-cuu-don-hang?**');
      assert.equal(await page.evaluate(()=>Boolean(window.__goiHueAnalytics)),false);
      await page.reload();await page.waitForTimeout(500);assert.equal(events.filter(e=>e.name==='purchase').length,1);
    }
    if(reloadFailure)assert.ok(events.some(e=>e.name==='purchase'));
    assert.equal(f.google.length,0);assert.deepEqual(f.errors,[]);
    pass(`${type}/${method}: real UI creates one safe purchase${reloadFailure?' before synthetic state-reload failure':''}`);
    await f.context.close();
  }
  {
    const f=await fixture();const {page,events}=f;
    await page.goto(`${origin}/?ga_capture=1`);
    await until(()=>events.some(e=>e.name==='view_offer'),'expanded offer');
    const initial=events.filter(e=>e.name==='view_offer'&&e.params.offer_surface==='floating_offer').length;
    await page.waitForTimeout(2200);assert.equal(events.filter(e=>e.name==='view_offer'&&e.params.offer_surface==='floating_offer').length,initial);
    await page.getByRole('button',{name:'Thu gọn ưu đãi'}).click();
    await page.getByRole('heading',{name:'Mè xửng và ngọn lửa liu riu',exact:true}).scrollIntoViewIfNeeded();
    await until(()=>events.some(e=>e.name==='view_story'&&e.params.story_id==='me-xung-keo-hue'),'home story');
    assert.equal(events.filter(e=>e.name==='view_story'&&e.params.story_id==='qua-bieu').length,0);
    await page.getByRole('button',{name:'Xem câu chuyện Quà biếu'}).click();
    await page.locator('#heritage-gift-story h2').scrollIntoViewIfNeeded();
    await until(()=>events.some(e=>e.name==='view_story'&&e.params.story_id==='qua-bieu'),'expanded gift story');
    assert.equal(f.google.length,0);assert.deepEqual(f.errors,[]);
    pass('real content UI: offer countdown does not duplicate; hidden gift story waits for expand and visibility');
    await page.screenshot({path:output+'story-ui.png'});await f.context.close();
  }
  writeFileSync(output+'browser-results.json',JSON.stringify({scope:'frontend with intercepted synthetic API, no Google requests, not live backend/GA4',origin,serverRunning:false,checks,status:'PASS'},null,2));
} catch(error) {
  writeFileSync(output+'browser-results.json',JSON.stringify({scope:'synthetic frontend fixtures',checks,status:'FAIL',error:String(error),serverLog:logs.slice(-3000)},null,2));
  throw error;
} finally {
  if(browser)await browser.close();
  if(server.pid&&server.exitCode===null) {
    if(process.platform==='win32') {try{execFileSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});}catch{server.kill();}}
    else server.kill();
  }
}
