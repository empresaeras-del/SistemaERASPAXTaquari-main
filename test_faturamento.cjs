const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:3000/faturamentos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  if (html.includes('Carregando remessas')) {
    console.log("App is stuck on loading.");
  } else if (html.includes('Nova Remessa')) {
    console.log("App loaded Faturamentos Page successfully.");
  } else {
    console.log("App loaded something else.");
  }
  
  await browser.close();
})();
