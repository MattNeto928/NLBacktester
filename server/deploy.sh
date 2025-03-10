#!/bin/bash

# Stop the existing server process (if using PM2)
echo "Stopping existing server process..."
pm2 stop all || true

# Install any new dependencies
echo "Installing dependencies..."
npm install

# Start the server with PM2
echo "Starting server with PM2..."
pm2 start index.js --name "nltradetest"

# Display server status
echo "Server status:"
pm2 status

echo "Deployment completed. Server should be running on 0.0.0.0:5001"
echo "Check logs with: pm2 logs nltradetest"