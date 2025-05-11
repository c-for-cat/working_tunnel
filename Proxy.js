// Subdomain Proxy Service
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = express();

// Parse JSON bodies
app.use(express.json());

// Configuration
const CONFIG = {
  mainPort: 3000,              // Port to listen on
  secretKey: 'change-this-in-production', // Secret key for API access
  domain: 'quizyy.fun',       // Your main domain
  mongoUri: 'mongodb+srv://help:7xIDOD9VVz2t1wUz@cluster0.uenwbbu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
  dbName: 'name'
};

// Connect to MongoDB
mongoose.connect(CONFIG.mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('📊 Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Define Proxy Schema
const proxySchema = new mongoose.Schema({
  proxyCode: { type: String, required: true, unique: true },
  subdomain: { type: String, required: true, unique: true },
  targetHost: { type: String, required: true },
  targetPort: { type: Number, required: true },
  secretCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastAccessed: { type: Date }
});

// Create model
const Proxy = mongoose.model('Proxy', proxySchema);

// In-memory caches for active proxies
const proxyMiddlewares = {};

// Load the custom error page
const errorPagePath = path.join(__dirname, 'error-page.html');
let errorPageHTML = '';

try {
  errorPageHTML = fs.readFileSync(errorPagePath, 'utf8');
} catch (err) {
  console.error('❌ Error loading error page template:', err);
  errorPageHTML = '<html><body><h1>Subdomain Not Configured</h1><p>Please visit <a href="https://quizyy.fun">quizyy.fun</a> or join our <a href="https://discord.gg/UUaNzfZyc6">Discord</a>.</p></body></html>';
}

// API to create a new proxy - support both GET and POST for ease of use
app.route('/create/:ip/:port/:subdomain/:secretCode')
  .get(async (req, res) => {
    const { ip, port, subdomain, secretCode } = req.params;
    
    // Validate secret code
    if (secretCode !== CONFIG.secretKey) {
      return res.status(403).json({ error: 'Invalid secret code' });
    }
    
    // Validate subdomain (alphanumeric only)
    if (!/^[a-z0-9]+$/i.test(subdomain)) {
      return res.status(400).json({ error: 'Subdomain must be alphanumeric' });
    }
    
    try {
      // Check if subdomain is already in use
      const existingProxy = await Proxy.findOne({ subdomain });
      if (existingProxy) {
        return res.status(409).json({ error: 'Subdomain already in use' });
      }
      
      // Generate unique code for this proxy
      const proxyCode = uuidv4();
      // Generate a unique secret code for deletion
      const deleteSecretCode = uuidv4();
      
      // Create new proxy in database
      const newProxy = new Proxy({
        proxyCode,
        subdomain,
        targetHost: ip,
        targetPort: parseInt(port, 10),
        secretCode: deleteSecretCode
      });
      
      await newProxy.save();
      
      console.log(`✅ Created proxy: ${subdomain}.${CONFIG.domain} → ${ip}:${port} (Code: ${proxyCode})`);
      
      res.status(201).json({ 
        success: true, 
        proxyCode,
        secretCode: deleteSecretCode,
        url: `http://${subdomain}.${CONFIG.domain}`
      });
    } catch (error) {
      console.error('❌ Error creating proxy:', error);
      res.status(500).json({ error: 'Failed to create proxy' });
    }
  })
  .post(async (req, res) => {
    const { ip, port, subdomain, secretCode } = req.params;
    
    // Validate secret code
    if (secretCode !== CONFIG.secretKey) {
      return res.status(403).json({ error: 'Invalid secret code' });
    }
    
    // Validate subdomain (alphanumeric only)
    if (!/^[a-z0-9]+$/i.test(subdomain)) {
      return res.status(400).json({ error: 'Subdomain must be alphanumeric' });
    }
    
    try {
      // Check if subdomain is already in use
      const existingProxy = await Proxy.findOne({ subdomain });
      if (existingProxy) {
        return res.status(409).json({ error: 'Subdomain already in use' });
      }
      
      // Generate unique code for this proxy
      const proxyCode = uuidv4();
      // Generate a unique secret code for deletion
      const deleteSecretCode = uuidv4();
      
      // Create new proxy in database
      const newProxy = new Proxy({
        proxyCode,
        subdomain,
        targetHost: ip,
        targetPort: parseInt(port, 10),
        secretCode: deleteSecretCode
      });
      
      await newProxy.save();
      
      console.log(`✅ Created proxy: ${subdomain}.${CONFIG.domain} → ${ip}:${port} (Code: ${proxyCode})`);
      
      res.status(201).json({ 
        success: true, 
        proxyCode,
        secretCode: deleteSecretCode,
        url: `http://${subdomain}.${CONFIG.domain}`
      });
    } catch (error) {
      console.error('❌ Error creating proxy:', error);
      res.status(500).json({ error: 'Failed to create proxy' });
    }
  });

// API to delete a proxy - also support both GET and DELETE for easier use
app.route('/delete/:secretCode')
  .get(async (req, res) => {
    const { secretCode } = req.params;
    
    try {
      // Find proxy by secret code
      const proxy = await Proxy.findOne({ secretCode });
      
      if (!proxy) {
        return res.status(404).json({ error: 'Proxy not found or invalid secret code' });
      }
      
      const { subdomain, proxyCode } = proxy;
      
      // Delete from database
      await Proxy.deleteOne({ secretCode });
      
      // Clean up middleware if it exists
      if (proxyMiddlewares[subdomain]) {
        delete proxyMiddlewares[subdomain];
      }
      
      console.log(`🗑️ Deleted proxy: ${subdomain}.${CONFIG.domain} (Code: ${proxyCode})`);
      
      res.json({ success: true, message: `Proxy ${subdomain}.${CONFIG.domain} deleted` });
    } catch (error) {
      console.error('❌ Error deleting proxy:', error);
      res.status(500).json({ error: 'Failed to delete proxy' });
    }
  })
  .delete(async (req, res) => {
    const { secretCode } = req.params;
    
    try {
      // Find proxy by secret code
      const proxy = await Proxy.findOne({ secretCode });
      
      if (!proxy) {
        return res.status(404).json({ error: 'Proxy not found or invalid secret code' });
      }
      
      const { subdomain, proxyCode } = proxy;
      
      // Delete from database
      await Proxy.deleteOne({ secretCode });
      
      // Clean up middleware if it exists
      if (proxyMiddlewares[subdomain]) {
        delete proxyMiddlewares[subdomain];
      }
      
      console.log(`🗑️ Deleted proxy: ${subdomain}.${CONFIG.domain} (Code: ${proxyCode})`);
      
      res.json({ success: true, message: `Proxy ${subdomain}.${CONFIG.domain} deleted` });
    } catch (error) {
      console.error('❌ Error deleting proxy:', error);
      res.status(500).json({ error: 'Failed to delete proxy' });
    }
  });

// List all active proxies (admin only)
app.get('/list/:secretCode', async (req, res) => {
  const { secretCode } = req.params;
  
  if (secretCode !== CONFIG.secretKey) {
    return res.status(403).json({ error: 'Invalid secret code' });
  }
  
  try {
    const proxies = await Proxy.find({}).select('-secretCode');
    
    const formattedProxies = proxies.map(proxy => ({
      code: proxy.proxyCode,
      subdomain: proxy.subdomain,
      target: `${proxy.targetHost}:${proxy.targetPort}`,
      createdAt: proxy.createdAt,
      lastAccessed: proxy.lastAccessed
    }));
    
    res.json({ proxies: formattedProxies });
  } catch (error) {
    console.error('❌ Error listing proxies:', error);
    res.status(500).json({ error: 'Failed to list proxies' });
  }
});

// Function to create a proxy middleware for a target
function createProxyForTarget(targetHost, targetPort) {
  return createProxyMiddleware({
    target: `http://${targetHost}:${targetPort}`,
  changeOrigin: true,
    ws: true,
    secure: false,
    protocolRewrite: 'http',
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('X-Forwarded-Proto', 'http');
      console.log(`🔄 Proxying request to ${targetHost}:${targetPort}: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Remove content-length to prevent issues with modified responses
    delete proxyRes.headers['content-length'];
    
    // Fix location headers if any
    if (proxyRes.headers.location) {
      proxyRes.headers.location = proxyRes.headers.location.replace('https://', 'http://');
    }
    
    // Ensure content-security-policy doesn't block http content
    if (proxyRes.headers['content-security-policy']) {
      delete proxyRes.headers['content-security-policy'];
    }
    
    // Modify HTML responses to rewrite image URLs
    if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/html')) {
      let body = '';
      const originalWrite = res.write;
      const originalEnd = res.end;
      
      // Capture the response body
      res.write = function(chunk) {
        body += chunk.toString('utf8');
        return true;
      };
      
      // Process and replace the response body on end
      res.end = function(chunk) {
        if (chunk) {
          body += chunk.toString('utf8');
        }
        
          // Replace URLs with local paths
          const targetUrlPattern = new RegExp(`https?://${targetHost}:${targetPort}/uploads/`, 'g');
          body = body.replace(targetUrlPattern, '/uploads/');
        
        // Write the modified response
        originalWrite.call(res, body);
        originalEnd.call(res);
      };
    }
  }
});
}

// Direct handler for images to bypass proxy security issues
app.get('/uploads/:imageFile', async (req, res) => {
  // Extract the subdomain from the host header
  const host = req.headers.host;
  const subdomain = host.split('.')[0];
  
  try {
    // Find the proxy configuration for this subdomain
    const proxyConfig = await Proxy.findOne({ subdomain });
    
    if (!proxyConfig) {
      return res.status(404).send('Subdomain not configured');
    }
    
    // Update last accessed time
    await Proxy.updateOne({ subdomain }, { lastAccessed: new Date() });
    
    const { targetHost, targetPort } = proxyConfig;
    const imageFile = req.params.imageFile;
    const imageUrl = `http://${targetHost}:${targetPort}/uploads/${imageFile}`;
    
    console.log(`🖼️ Fetching image directly: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`❌ Image fetch error: ${response.status} ${response.statusText}`);
      return res.status(response.status).send('Image not found');
    }
    
    // Get the image data and content type
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type');
    
    // Send the image back to the client
    res.set('Content-Type', contentType || 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('❌ Image fetch error:', error.message);
    res.status(500).send('Error fetching image');
  }
});

// Main request handler that routes based on subdomain
app.use(async (req, res, next) => {
  const host = req.headers.host;
  
  // Check if this is a direct request to the main domain
  if (!host.includes('.') || host === CONFIG.domain || host === `localhost:${CONFIG.mainPort}`) {
    return next();
  }
  
  // Extract the subdomain
  const subdomain = host.split('.')[0];
  
  try {
    // Find the proxy configuration for this subdomain from database
    const proxyConfig = await Proxy.findOne({ subdomain });
    
    if (!proxyConfig) {
      // Send our custom error page instead of simple text
      res.status(404).send(errorPageHTML);
      return;
    }
    
    // Update last accessed time
    await Proxy.updateOne({ subdomain }, { lastAccessed: new Date() });
    
    // Create or reuse the proxy middleware for this target
    if (!proxyMiddlewares[subdomain]) {
      proxyMiddlewares[subdomain] = createProxyForTarget(
        proxyConfig.targetHost, 
        proxyConfig.targetPort
      );
    }
    
    // Use the proxy middleware
    proxyMiddlewares[subdomain](req, res, next);
  } catch (error) {
    console.error('❌ Error routing request:', error);
    res.status(500).send('Internal server error');
  }
});

// Default route for the main domain
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Subdomain Proxy Service</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .box { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Subdomain Proxy Service</h1>
        <div class="box">
          <p>Use the API to create and manage subdomain proxies.</p>
          <p>Your proxies will be available at: <code>yoursubdomain.${CONFIG.domain}</code></p>
        </div>
      </body>
    </html>
  `);
});

// Start the server
const server = http.createServer(app);
server.listen(CONFIG.mainPort, () => {
  console.log(`
  🚀 Subdomain Proxy Service started!
  ⬇️ Listening on: http://localhost:${CONFIG.mainPort}
  ℹ️ API endpoints:
     - Create: /create/:ip/:port/:subdomain/${CONFIG.secretKey}
     - Delete: /delete/:secretCode
     - List: /list/${CONFIG.secretKey}
  ℹ️ Use Ctrl+C to stop
  `);
});

// Handle errors
process.on('uncaughtException', error => {
  console.error('❌ Error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${CONFIG.mainPort} is already in use. Try another port.`);
  }
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down proxy service...');
  mongoose.connection.close().then(() => {
    console.log('📊 MongoDB connection closed');
  process.exit(0);
  });
});
