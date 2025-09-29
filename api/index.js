const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
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

// Test Supabase connection endpoint
app.get('/api/test-supabase', async (req, res) => {
  try {
    console.log('Testing Supabase connection...');
    
    // Use environment variables
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ptqjnuquemfelgutgilp.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cWpudXF1ZW1mZWxndXRnaWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTYxNTgsImV4cCI6MjA3NDczMjE1OH0.nUbAY5kWglAHVxio7uEB_ZzktCaz5tZ93vZic3G2XEU';
    
    console.log('Supabase URL:', supabaseUrl);
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test connection by fetching a small amount of data
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase test error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error
      });
    }
    
    console.log('Supabase test successful');
    res.json({
      success: true,
      message: 'Supabase connection successful',
      data: data
    });
  } catch (error) {
    console.error('Supabase test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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