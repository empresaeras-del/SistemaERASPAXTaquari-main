const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERR:', err.toString()));
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
  const text = await page.evaluate(() => document.body.innerText);
  console.log("TEXT ON PAGE:", text.substring(0, 1000));
  await browser.close();
})();
