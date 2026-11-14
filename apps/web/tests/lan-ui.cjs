// Run with Playwright available on NODE_PATH and the web app on localhost:3000.
// All API responses are synthetic; this does not claim live backend acceptance.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../output/playwright');
const categories = [{id:'c1',code:'me-xung',name:'Mè xửng Cố Đô',description:'Mè xửng truyền thống',sortOrder:1,active:true,revision:1,image:'/goi-hue/assets/photo-cat-me-xung.jpg'},{id:'c2',code:'hop-qua',name:'Hộp quà',description:'Gửi người thương',sortOrder:2,active:true,revision:1,image:'/goi-hue/assets/photo-cat-qua-bieu.jpg'}];
const products = Array.from({length:12},(_,i)=>({id:`p${i}`,slug:`mon-qua-${i}`,name:i===0?'Mè xửng giòn Cố Đô':`Thức quà Huế ${i}`,description:'Mạch nha và mè rang, thức quà từ Huế.',category:i<8?'me-xung':'hop-qua',price:45000+i*10000,stock:i===1?0:20,active:true,revision:1,image:'/goi-hue/assets/photo-sp-me-xung-dia.jpg'}));
async function main(){
 fs.mkdirSync(root,{recursive:true});
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 let role='CUSTOMER'; const writes=[]; let fail=false; let empty=false;
 await context.route('**/api/store/**',async route=>{
  const req=route.request(),key=new URL(req.url()).pathname.replace('/api/store/','');
  let body={}; let status=200;
  if(fail&&key==='products'){status=503;body={message:'Máy chủ tạm gián đoạn'};}
  else if(key==='state'){if(role==='GUEST'){status=401;body={message:'Đăng nhập'};}else body={user:{id:'test',name:'Người kiểm thử',role},cartCount:0,orders:[],addresses:[],privacy:[],returns:[],consents:[],policy:{}};}
  else if(key==='products'||key==='admin/products')body=empty?[]:products;
  else if(key.startsWith('products/'))body=products.find(p=>p.slug===key.slice(9))??{};
  else if(key==='categories'||key==='admin/categories')body=categories;
  else if(key==='cart/summary')body={items:[],cartToken:'synthetic-test'};
  else if(key==='shipping')body={baseFee:30000,revision:1};
  else if(req.method()!=='GET'){writes.push(JSON.parse(req.postData()||'{}'));body={id:'saved'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/');
 await page.locator('.lan-product').first().waitFor();
 assert.equal(await page.locator('main>section').count(),6);
 assert.equal(await page.locator('.lan-home-catalog .lan-product').count(),6);
 await page.screenshot({path:path.join(root,'home-desktop.png'),fullPage:true});
 await page.goto('http://127.0.0.1:3000/products');
 await page.locator('.lan-product').first().waitFor();
 assert.equal(await page.locator('.lan-product').count(),9);
 await page.getByRole('button',{name:'Sau →',exact:true}).click();
 assert.equal(await page.locator('.lan-product').count(),3);
 await page.getByRole('searchbox',{name:'Tìm đặc sản'}).fill('me xung');
 assert.equal(await page.locator('.lan-product').count(),1);
 await page.getByRole('button',{name:'Xóa tất cả bộ lọc',exact:true}).click();
 await page.getByRole('combobox',{name:'Sắp xếp'}).selectOption('desc');
 assert.match(await page.locator('.lan-product h3').first().innerText(),/11/);
 await page.screenshot({path:path.join(root,'collection-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(root,'collection-mobile.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:3000/products/mon-qua-0');
 await page.getByRole('button',{name:'Thêm vào giỏ hàng',exact:true}).waitFor();
 await page.getByRole('button',{name:'Tăng số lượng',exact:true}).click();
 await page.getByRole('button',{name:'Thêm vào giỏ hàng',exact:true}).click();
 await page.getByText('Đã lưu thông tin.',{exact:true}).waitFor();
 assert.equal(writes.at(-1).action,'cart-set');assert.equal(writes.at(-1).quantity,2);
 await page.getByRole('tab',{name:'Thông số & Thành phần',exact:true}).click();
 assert.match(await page.getByRole('tabpanel').innerText(),/Đang cập nhật/);
 await page.getByRole('button',{name:'Phóng to ảnh sản phẩm',exact:true}).click();
 await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 assert.equal(await page.locator('dialog[open]').count(),0);
 await page.screenshot({path:path.join(root,'detail-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:path.join(root,'detail-mobile.png'),fullPage:true});
 await page.goto('http://127.0.0.1:3000/products/mon-qua-1');
 await page.getByRole('button',{name:'Tạm hết hàng',exact:true}).waitFor();
 assert(await page.getByRole('button',{name:'Tạm hết hàng',exact:true}).isDisabled());
 fail=true;await page.goto('http://127.0.0.1:3000/products');await page.getByRole('button',{name:'Thử lại',exact:true}).waitFor();
 fail=false;await page.getByRole('button',{name:'Thử lại',exact:true}).click();await page.locator('.lan-product').first().waitFor();
 empty=true;await page.reload();await page.getByText('Chưa có sản phẩm phù hợp.',{exact:true}).waitFor();empty=false;
 assert.deepEqual(errors,[]);console.log('PASS: home, collection pagination/search/sort, 390px overflow, API retry and empty states');
 await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});

