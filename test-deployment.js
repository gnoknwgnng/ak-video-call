// Simple deployment test script
const { exec } = require('child_process');

console.log('Testing current deployment...');

// Test the local server
exec('node test-complete.js', (error, stdout, stderr) => {
  if (error) {
    console.log('Error starting test server:', error);
    return;
  }
  
  console.log('Test server output:', stdout);
  console.log('Test server errors:', stderr);
  
  // After a few seconds, test the endpoints
  setTimeout(() => {
    exec('curl -s http://localhost:3001/api/health', (err, stdout, stderr) => {
      if (err) {
        console.log('Health check failed:', err);
        return;
      }
      
      console.log('Health check response:', stdout);
      
      // Stop the test server
      exec('taskkill /f /im node.exe', (killErr) => {
        if (killErr) {
          console.log('Error stopping server:', killErr);
        } else {
          console.log('Test server stopped');
        }
      });
    });
  }, 3000);
});