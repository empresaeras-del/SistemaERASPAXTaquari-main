const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  const html = await page.evaluate(() => document.getElementById('root').innerHTML);
  console.log('HTML length:', html.length);
  if (html.length < 500) {
    console.log('HTML content:', html);
  } else {
    console.log('HTML is big, meaning it rendered something.');
  }
  
  await browser.close();
})();
