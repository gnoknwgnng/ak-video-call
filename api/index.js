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
      console.log('Initializing Socket.IO...');
      io = await initSocket(server);
      socketInitialized = true;
      console.log('Socket.IO initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Socket.IO:', err);
      console.error('Stack trace:', err.stack);
    }
  }
  return io;
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// CORS middleware for API routes
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  next();
});

// API Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketInitialized: socketInitialized
  });
});

app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Debug information',
    socketInitialized: socketInitialized,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'
    }
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve the main page for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Export the server for Vercel
module.exports = async (req, res) => {
  try {
    console.log('Vercel function invoked:', req.url);
    
    // Initialize Socket.IO if not already done
    await initializeSocket();
    
    return new Promise((resolve, reject) => {
      // Handle the request
      server.emit('request', req, res);
      
      // Listen for the response to be finished
      res.on('finish', () => {
        console.log('Request finished');
        resolve();
      });
      
      res.on('error', (err) => {
        console.error('Response error:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Vercel function error:', error);
    console.error('Stack trace:', error.stack);
    
    // Send error response
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};