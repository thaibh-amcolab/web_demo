const express = require('express');
// const axios = require('axios');
const puppeteer = require('puppeteer');

const cors = require('cors');

const app = express();
app.use(cors());

var contentData = new Map();

async function getData(url, deviceType = 'desktop')  {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set user agent and viewport based on device type
    if (deviceType === 'vertical') {
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

    await page.goto(url, { waitUntil: 'networkidle2' });

    const content = await page.content();
    contentData.set(url, content);

    // content = content.replace(/href="\/(?!\/)/g, `href="${targetUrl}/`);  // Rewriting relative links (like /page.html)
    // content = content.replace(/src="\/(?!\/)/g, `src="${targetUrl}/`);  // Rewriting relative image/script links

    // const jsFiles = await page.evaluate(() => {
    //   const scripts = Array.from(document.querySelectorAll('script[src]'));
    //   return scripts.map(script => script.src);
    // });

    await browser.close();
    
    // let modifiedContent = content;

    // jsFiles.forEach((src) => {
    //   modifiedContent += `<script src="${src}" async defer></script>`;
    // });

    // Send the modified content with injected JavaScript
    return content;
} catch (e) {
  console.log(e);
  throw e;
}
}


app.get('/content',  async (req, res) => {
  const targetUrl = req.query.url;
  const deviceType = req.query.device || 'horizontal';

  try {
    const content = await getData(targetUrl, deviceType);
    contentData.set(targetUrl, content);
    res.send(200).send('Content fetched successfully.');
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy error');
  }
});

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  const deviceType = req.query.device || 'horizontal';

  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');

  try {
    if (contentData.has(targetUrl)) {
      res.send(contentData.get(targetUrl));
    } else {
      const data = await getData(targetUrl, deviceType);
      contentData.set(targetUrl, data);
      res.send(data);
    }

  } catch(e) {
    const data = await getData(targetUrl, deviceType);
    contentData.set(targetUrl, data);
    res.send(data);
  } finally {
    contentData.delete(targetUrl); // Clear only after successful sending
  }
});

// app.get('/proxy', async (req, res) => {
//   const targetUrl = req.query.url;
//   const deviceType = req.query.device || 'desktop';

//   try {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();

//     // Set user agent and viewport based on device type
//     if (deviceType === 'mobile') {
//       await page.setUserAgent(
//         'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1'
//       );
//       await page.setViewport({
//         width: 375,
//         height: 812,
//         isMobile: true,
//         hasTouch: true,
//       });
//     } else {
//       await page.setUserAgent(
//         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
//       );
//       await page.setViewport({
//         width: 1366,
//         height: 768,
//         isMobile: false,
//       });
//     }

//     await page.goto(targetUrl, { waitUntil: 'networkidle2' });

//     const content = await page.content();

//     await browser.close();
    

//     // Send the modified content with injected JavaScript
//     res.removeHeader('X-Frame-Options');
//     res.removeHeader('Content-Security-Policy');
//     res.send(content);
//   } catch (error) {
//     console.error('Proxy error:', error);
//     res.status(500).send('Proxy error');
//   }
// });

app.get('/', async (req, res) => {
  // firestatic => return web/index.html;
  // params : livetreamRoomId
  //call to ruby de lay du lieu moi nhat 
  // nhan du lieu {"livestreamRoomId" : "1", "backgroundMusic": ""}
  // return /index.html?keySchedule=schedule_youtube&liveStreamRoomId=45
});

app.listen(3001, () => console.log('Proxy server running on http://localhost:3001'));
