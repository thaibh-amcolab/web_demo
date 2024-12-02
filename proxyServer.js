const express = require('express');
// const axios = require('axios');
const puppeteer = require('puppeteer');

const cors = require('cors');

const app = express();
app.use(cors());

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  const deviceType = req.query.device || 'desktop';

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set user agent and viewport based on device type
    if (deviceType === 'mobile') {
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1'
      );
      await page.setViewport({
        width: 375,
        height: 812,
        isMobile: true,
        hasTouch: true,
      });
    } else {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      await page.setViewport({
        width: 1366,
        height: 768,
        isMobile: false,
      });
    }

    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    const content = await page.content();

    // content = content.replace(/href="\/(?!\/)/g, `href="${targetUrl}/`);  // Rewriting relative links (like /page.html)
    // content = content.replace(/src="\/(?!\/)/g, `src="${targetUrl}/`);  // Rewriting relative image/script links

    const jsFiles = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.map(script => script.src);
    });

    await browser.close();
    
    const jsFilePromises = jsFiles.map(async (src) => {
      const response = await fetch(src);
      const jsContent = await response.text();
      return jsContent;
    });

    const jsContents = await Promise.all(jsFilePromises);

    // Inject JavaScript into the page content
    let modifiedContent = content;

    // Inject JS files into the page content (at the end of the body for async execution)
    jsContents.forEach(jsContent => {
      modifiedContent += `<script>${jsContent}</script>`;
    });

    // Send the modified content with injected JavaScript
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.send(modifiedContent);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy error');
  }
});

app.listen(3001, () => console.log('Proxy server running on http://localhost:3001'));
