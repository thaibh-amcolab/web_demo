const express = require('express');
const crypto = require('crypto');

const authConfig = {
  serviceName: 'proxy-service',
  secret: 'service-secret',
  apiKeys: {
    'python-service1': 'python1-api-key',
    'python-service2': 'python2-api-key',
    'ruby-service': 'ruby-api-key',
    'youtube-service': 'youtube-api-key',
    'nodejs-service': 'nodejs-api-key',
    'proxy-service': 'proxy-api-key',
  }
};

// Middleware for authentication
function authenticate(req, res, next) {
  const { serviceName, signature } = req.query;
  if (!serviceName || !signature) {
    return res.status(401).json({ error: 'Missing service-name or signature' });
  }

  const apiKey = authConfig.apiKeys[serviceName];
  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid service-name' });
  }

  const expectedSignature = crypto
    .createHash('sha256')
    .update(`${serviceName}${apiKey}${authConfig.secret}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: `Invalid signature, ${serviceName}, ${apiKey}, ${authConfig.secret}, ${signature}, ${expectedSignature}` });
  }

  next();
}

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
  
  // console.log('Incoming request:', {
  //   url: req.originalUrl,
  //   method: req.method,
  //   headers: req.headers
  // });

  next();
});

var contentData = new Map();

async function getData(url, deviceType = 'desktop')  {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);

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
      const createMessageHandler = () => {
        // Configuration object for more flexible settings
        const CONFIG = {
          SCROLL_DELAY: 1000,
          ZOOM_SCALE: 1.3,
          ZOOM_OUT_SCALE: 0.7,
          TRANSITION_DURATION: '0.3s'
        };
    
        // Utility functions
        const safeQuerySelector = (selector) => {
          try {
            return document.querySelector(selector);
          } catch (error) {
            console.error('Selector error:', error);
            return null;
          }
        };
    
        const calculateElementOrigin = (element) => {
          const rect = element.getBoundingClientRect();
          const documentHeight = document.documentElement.scrollHeight;
          const documentWidth = document.documentElement.scrollWidth;
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    
          const elementTop = rect.top + scrollTop;
          const elementLeft = rect.left + scrollLeft;
    
          return {
            originX: (elementLeft / documentWidth) * 100,
            originY: (elementTop / documentHeight) * 100,
            details: { documentHeight, documentWidth, scrollTop, scrollLeft }
          };
        };
    
        const sendMessageToParent = (type, data = {}) => {
          window.parent.postMessage({ type, ...data }, '*');
        };
    
        const resetBodyStyles = () => {
          document.body.style.cssText = `
            transition: transform ${CONFIG.TRANSITION_DURATION} ease;
            transform: scale(1);
            width: 100%;
            height: 100%;
          `;
        };
    
        const smoothScrollToElement = async (element) => {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            top: 0 
          });
          await new Promise(resolve => setTimeout(resolve, CONFIG.SCROLL_DELAY));
        };
    
        // Main event handler
        const handleMessage = async (event) => {
          try {
            // Reset styles at the start of any operation
            resetBodyStyles();
            await new Promise(resolve => setTimeout(resolve, CONFIG.SCROLL_DELAY));
    
            const { type, selector } = event.data;
    
            switch (type) {
              case 'scrollToElement': {
                const element = safeQuerySelector(selector);
                
                if (element) {
                  await smoothScrollToElement(element);
                  sendMessageToParent('scrollComplete', { selector });
                } else {
                  sendMessageToParent('scrollFailed', { selector });
                }
                break;
              }
    
              case 'ZoomIn': {
                const element = safeQuerySelector(selector);
                
                if (element) {
                  // Scroll to element
                  await smoothScrollToElement(element);
    
                  // Calculate precise origin
                  const { originX, originY, details } = calculateElementOrigin(element);
                  
                  console.log('Precise Zoom Origin:', { originX, originY, ...details });
    
                  // Apply zoom
                  document.body.style.cssText = `
                    transition: transform ${CONFIG.TRANSITION_DURATION} ease;
                    transform-origin: ${originX}% ${originY}%;
                    transform: scale(${CONFIG.ZOOM_SCALE});
                    width: 100%;
                    height: 100%;
                  `;
    
                  await new Promise(resolve => setTimeout(resolve, 300));
                  sendMessageToParent('zoomComplete', { selector });
                } else {
                  sendMessageToParent('zoomFailed', { selector });
                }
                break;
              }

              case 'ZoomOut': {
                const element = safeQuerySelector(selector);
                
                if (element) {
                  // Scroll to element
                  await smoothScrollToElement(element);
    
                  // Calculate precise origin
                  const { originX, originY, details } = calculateElementOrigin(element);
                  
                  console.log('Precise Zoom Origin:', { originX, originY, ...details });
    
                  // Apply zoom
                  document.body.style.cssText = `
                    transition: transform ${CONFIG.TRANSITION_DURATION} ease;
                    transform-origin: ${originX}% ${originY}%;
                    transform: scale(${CONFIG.ZOOM_OUT_SCALE});
                    width: 100%;
                    height: 100%;
                  `;
    
                  await new Promise(resolve => setTimeout(resolve, 300));
                  sendMessageToParent('zoomOutComplete', { selector });
                } else {
                  sendMessageToParent('zoomOutFailed', { selector });
                }
                break;
              }
    
              default:
                console.warn('Unknown message type:', type);
            }
          } catch (error) {
            console.error('Message handling error:', error);
            sendMessageToParent('zoomError', { 
              error: error.toString(), 
              selector: event.data.selector 
            });
          }
        };
    
        // Add event listener
        window.addEventListener('message', handleMessage, false);
      };
    
      // Create and inject the script
      const script = document.createElement('script');
      script.textContent = `(${createMessageHandler.toString()})()`;
      document.body.appendChild(script);
    });
  

    const content = await page.content();
    contentData.set(url, content);

    await browser.close();
    
    return content;
  } catch (error) {
    console.error(`Navigation failed: ${error.message}`);
  }
}


app.get('/content', authenticate, async (req, res) => {
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

app.get('/proxy', authenticate, async (req, res) => {
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
    }, 0);
  }
});

app.get('/', async (req, res) => {
  // firestatic => return web/index.html;
  // params : livetreamRoomId
  //call to ruby de lay du lieu moi nhat 
  // nhan du lieu {"livestreamRoomId" : "1", "backgroundMusic": ""}
  // return /index.html?keySchedule=schedule_youtube&liveStreamRoomId=45
});

app.listen(3001, () => console.log('Proxy server running on http://localhost:3001'));
