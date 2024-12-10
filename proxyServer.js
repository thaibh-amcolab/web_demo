const express = require('express');
// const axios = require('axios');
const puppeteer = require('puppeteer');

const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*', // Be more specific in production
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'X-Frame-Options', 'Content-Security-Policy']
}));

app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  
  // Additional headers to ensure iframe compatibility
  res.header('X-Frame-Options', 'ALLOWALL');
  res.header('Content-Security-Policy', 'frame-ancestors *');
  
  console.log('Incoming request:', {
    url: req.originalUrl,
    method: req.method,
    headers: req.headers
  });

  next();
});

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

    await page.evaluate(() => {
      // Add a script tag to the page that will handle postMessage events
      const script = document.createElement('script');
      script.textContent = `
        window.addEventListener('message', (event) => {
          try {
            if (event.data.type === 'scrollToElement') {
              const element = document.querySelector(event.data.selector);
              if (element) {
                element.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                });
                
                // Confirm scroll to parent window
                window.parent.postMessage({
                  type: 'scrollComplete',
                  selector: event.data.selector
                }, '*');
              } else {
                // Element not found
                window.parent.postMessage({
                  type: 'scrollFailed',
                  selector: event.data.selector
                }, '*');
              }
            }
          } catch (error) {
            // Send error back to parent
            window.parent.postMessage({
              type: 'scrollError',
              error: error.toString(),
              selector: event.data.selector
            }, '*');
          }
        }, false);
      `;
      
      // Append the script to the document
      document.documentElement.appendChild(script);
    });

    const content = await page.content();
    contentData.set(url, content);

    await browser.close();
    
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
    setTimeout(() => {
      contentData.delete(targetUrl);
    }, 60000);
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
