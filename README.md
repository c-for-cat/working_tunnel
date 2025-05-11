# Subdomain Proxy Service

A production-ready service that dynamically creates and manages subdomain proxies.

## Features

- Create and manage subdomain proxies with simple API calls
- MongoDB persistence for proxy configurations
- Custom error page for non-configured subdomains
- Keep-alive mechanism for Render deployments

## Deployment on Render

### 1. Create a new Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure your service with these settings:
   - **Name**: subdomain-proxy (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:all`
   - **Plan**: Select an appropriate plan (at least the paid tier for production use)

### 2. Set Environment Variables

Add these environment variables in the Render dashboard:

- `PORT`: The port for your main service (usually auto-assigned by Render)
- `MAIN_SERVICE_URL`: The full URL to your deployed service (e.g., https://your-service-name.onrender.com)

### 3. Set Up DNS

For your domain (e.g., quizyy.fun), add these DNS records:

1. Add a wildcard CNAME record:
   - Type: CNAME
   - Host: `*`
   - Value: `your-service-name.onrender.com`

2. (Optional) Add an A or CNAME record for the root domain if needed.

### 4. Configure Uptime Robot

1. Create an account on [Uptime Robot](https://uptimerobot.com/)
2. Add a new monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: Subdomain Proxy Keep-Alive
   - URL: https://your-service-name.onrender.com
   - Monitoring Interval: 5 minutes

## Using the Proxy Service

### Create a new subdomain proxy:

```
GET /create/target-ip/target-port/subdomain/your-secret-key
```

Example:
```
GET https://your-service-name.onrender.com/create/192.168.1.100/8080/web/your-secret-key
```

### Delete a subdomain proxy:

```
GET /delete/secret-code
```

### List all proxies (admin only):

```
GET /list/your-secret-key
```

## Local Development

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Run the keep-alive service: `npm run keep-alive`
4. Run both together: `npm run start:all` 