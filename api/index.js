const express = require('express');
const http = require('http');
const path = require('path');
const { initSocket } = require('./socket');

// Create express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
let io;
initSocket(server).then(initializedIo => {
  io = initializedIo;
}).catch(err => {
  console.error('Failed to initialize Socket.IO:', err);
});

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
    // Note: In a real serverless environment, these would be empty
    // because each function invocation has its own memory space
  });
});

// Export the server for Vercel
module.exports = (req, res) => {
  return new Promise((resolve, reject) => {
    // Handle the request
    server.emit('request', req, res);
    
    // Listen for the response to be finished
    res.on('finish', resolve);
    res.on('error', reject);
  });
};