// Complete test of the application setup
const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { initSocket } = require('./api/socket');

async function testCompleteSetup() {
  console.log('Testing complete application setup...');
  
  try {
    // Create express app
    const app = express();
    const server = http.createServer(app);
    
    // Middleware
    app.use(express.json());
    app.use('/static', express.static(path.join(__dirname, 'public')));
    
    // API Routes (matching Vercel setup)
    app.get('/api/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString()
      });
    });
    
    app.get('/api/debug', (req, res) => {
      res.json({
        message: 'Debug information',
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
    app.use(express.static(path.join(__dirname, 'public')));
    
    // Serve the main page for all other routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // Initialize Socket.IO
    console.log('Initializing Socket.IO...');
    const io = await initSocket(server);
    console.log('Socket.IO initialized successfully');
    
    // Start server
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      console.log(`Visit http://localhost:${PORT} to test`);
      console.log(`Test endpoints:`);
      console.log(`  http://localhost:${PORT}/api/health`);
      console.log(`  http://localhost:${PORT}/debug.html`);
    });
    
  } catch (error) {
    console.error('Setup test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testCompleteSetup();