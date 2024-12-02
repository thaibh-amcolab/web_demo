const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const { createProxyMiddleware } = require('http-proxy-middleware');

const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(
  '/proxy',
  createProxyMiddleware({
    target: 'https://dev.to/',
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
    onProxyReq: (proxyReq) => {
      proxyReq.removeHeader('X-Frame-Options');
    },
  })
);


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
