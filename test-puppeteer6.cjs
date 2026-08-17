const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3000/configuracoes', { waitUntil: 'networkidle0' });
  const html = await page.evaluate(() => document.getElementById('root').innerHTML);
  console.log('HTML length:', html.length);
  if (html.length < 500) {
    console.log('HTML content:', html);
  }
  
  await browser.close();
})();
