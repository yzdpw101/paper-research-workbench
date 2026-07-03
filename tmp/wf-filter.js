const CHECKS=['2023','2024','2025'];
await page.goto('https://s.wanfangdata.com.cn/thesis?q=%E7%A8%80%E5%B8%83%E9%98%B5%E5%88%97',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(3000);
const allLabels=await page.locator('label.ivu-checkbox-wrapper').all();
let toggled=0;
for(const label of allLabels){
  const w=label.locator('.words'); if(await w.count()===0) continue;
  const val=(await w.first().textContent())?.trim()||'';
  const isChecked=await label.evaluate(el=>el.className.includes('ivu-checkbox-wrapper-checked'));
  for(const c of CHECKS){ if((val.includes(c)||val===c)&&!isChecked){ await label.evaluate(el=>el.click()); toggled++; break; } }
}
await page.waitForTimeout(500);
const btn=page.locator('span.fixed-btn-submit:has-text(\"确定\")');
if(await btn.count()>0){ await btn.first().click(); await page.waitForTimeout(2000); }
return {toggled};
