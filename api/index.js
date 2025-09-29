const express = require('express');
const http = require('http');
const path = require('path');
const { initSocket } = require('./socket');

// Create a single app instance and server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO once
let io;
let socketInitialized = false;

async function initializeSocket() {
  if (!socketInitialized) {
    try {
      io = await initSocket(server);
      socketInitialized = true;
      console.log('Socket.IO initialized');
    } catch (err) {
      console.error('Failed to initialize Socket.IO:', err);
    }
  }
  return io;
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    message: 'Debug information',
    socketInitialized: socketInitialized
  });
});

// Export the server for Vercel
module.exports = async (req, res) => {
  // Initialize Socket.IO if not already done
  await initializeSocket();
  
  return new Promise((resolve, reject) => {
    // Handle the request
    server.emit('request', req, res);
    
    // Listen for the response to be finished
    res.on('finish', resolve);
    res.on('error', reject);
  });
};