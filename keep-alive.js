// Keep-alive server for Render deployment
// This lightweight server responds to ping requests from Uptime Robot
// to prevent the application from spinning down due to inactivity

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3001; // Different port than the main app
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'http://localhost:3000';

// Simple server to respond to ping requests
const server = http.createServer((req, res) => {
    // Log the request
    const timestamp = new Date().toISOString();
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[${timestamp}] Ping received from ${clientIP} - ${req.method} ${req.url}`);
    
    // Respond with a simple status page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Subdomain Proxy Service - Status</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #000;
                        color: #00ffff;
                        text-align: center;
                        padding: 50px 20px;
                        margin: 0;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: rgba(0, 0, 0, 0.7);
                        border: 1px solid rgba(0, 255, 255, 0.2);
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 0 30px rgba(0, 255, 255, 0.2);
                    }
                    h1 {
                        color: #00ffff;
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                    .status {
                        display: inline-block;
                        background-color: rgba(0, 255, 255, 0.1);
                        color: #00ffff;
                        padding: 10px 20px;
                        border-radius: 30px;
                        margin: 20px 0;
                        font-weight: bold;
                        border: 1px solid rgba(0, 255, 255, 0.3);
                    }
                    .status::before {
                        content: "•";
                        display: inline-block;
                        margin-right: 8px;
                        font-size: 24px;
                        animation: pulse 1.5s infinite;
                        vertical-align: middle;
                    }
                    @keyframes pulse {
                        0% { opacity: 0.3; }
                        50% { opacity: 1; }
                        100% { opacity: 0.3; }
                    }
                    .timestamp {
                        font-size: 14px;
                        opacity: 0.7;
                        margin-top: 30px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Subdomain Proxy Service</h1>
                    <div class="status">SERVICE ACTIVE</div>
                    <p>The ping keep-alive service is running. The main proxy service is operational.</p>
                    <p class="timestamp">Last ping: ${timestamp}</p>
                </div>
            </body>
        </html>
    `);
});

// Self-ping function to keep the service alive
function pingMainService() {
    http.get(MAIN_SERVICE_URL, (res) => {
        console.log(`[${new Date().toISOString()}] Self-ping to main service: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Self-ping error: ${err.message}`);
    });
}

// Start server
server.listen(PORT, () => {
    console.log(`
    🔄 Keep-alive server started on port ${PORT}
    🕒 Configured to ping main service every ${PING_INTERVAL / 60000} minutes
    ℹ️ Main service URL: ${MAIN_SERVICE_URL}
    `);
    
    // Schedule periodic pings to the main service
    setInterval(pingMainService, PING_INTERVAL);
    
    // Initial ping
    pingMainService();
});

// Log any server errors
server.on('error', (err) => {
    console.error('Server error:', err);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down keep-alive server...');
    server.close(() => {
        console.log('Keep-alive server stopped');
        process.exit(0);
    });
}); 