const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:3000/faturamentos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Find "Nova Remessa" button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Nova Remessa'));
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  const html = await page.content();
  if (html.includes('Nova Remessa de Faturamento')) {
     console.log("SUCCESS");
  } else {
     console.log("FAILED");
  }
  await browser.close();
})();
