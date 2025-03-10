const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://100.27.187.96:5001',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api' // No rewrite needed, just to be explicit
      },
      onProxyRes: function(proxyRes, req, res) {
        // Log the response status to help debug
        console.log('ProxyRes:', req.method, req.path, proxyRes.statusCode);
      },
      onError: function(err, req, res) {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ 
          error: 'Proxy error connecting to API server: ' + err.message 
        }));
      }
    })
  );
};