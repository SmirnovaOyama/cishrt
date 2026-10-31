// Renders og.html to public/og.png at 1200 by 630, then the cis edition's copy,
// which differs only in its address, to public/og-cis.png.
// Run with Playwright available, e.g.: npx -p playwright node design/og/render.cjs
const path = require('path');
const { chromium } = require('playwright');

const out = name => path.join(__dirname, '../../public', name);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.goto('file://' + path.join(__dirname, 'og.html'));
    await page.evaluate('document.fonts.ready');
    await page.screenshot({ path: out('og.png') });
    await page.evaluate("document.querySelector('.site').textContent = 'cishrt.mahiro.uk'");
    await page.screenshot({ path: out('og-cis.png') });
    await browser.close();
})();
