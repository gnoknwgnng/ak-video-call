const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Create express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"],
  allowEIO3: true
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Queues for male and female users
let maleQueue = [];
let femaleQueue = [];
let otherQueue = [];

// Store active connections
let connections = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // When a user joins, add them to the appropriate queue
  socket.on('join', (data) => {
    const { gender } = data;
    console.log(`${socket.id} joined as ${gender}`);
    
    // Add user to the appropriate queue
    if (gender === 'male') {
      maleQueue.push(socket.id);
    } else if (gender === 'female') {
      femaleQueue.push(socket.id);
    } else {
      otherQueue.push(socket.id);
    }
    
    // Store user data
    connections.set(socket.id, { gender, partner: null });
    
    // Try to find a match
    findMatch();
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const partnerId = connections.get(socket.id)?.partner;
    if (partnerId) {
      io.to(partnerId).emit('offer', data);
    }
  });

  socket.on('answer', (data) => {
    const partnerId = connections.get(socket.id)?.partner;
    if (partnerId) {
      io.to(partnerId).emit('answer', data);
    }
  });

  socket.on('ice-candidate', (data) => {
    const partnerId = connections.get(socket.id)?.partner;
    if (partnerId) {
      io.to(partnerId).emit('ice-candidate', data);
    }
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const partnerId = connections.get(socket.id)?.partner;
    if (partnerId) {
      io.to(partnerId).emit('chat-message', data);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    disconnectUser(socket.id);
  });

  // Handle user manually disconnecting
  socket.on('disconnect-call', () => {
    disconnectUser(socket.id);
    // Re-add user to queue
    const userData = connections.get(socket.id);
    if (userData) {
      if (userData.gender === 'male') {
        maleQueue.push(socket.id);
      } else if (userData.gender === 'female') {
        femaleQueue.push(socket.id);
      } else {
        otherQueue.push(socket.id);
      }
      findMatch();
    }
  });
});

// Function to match users
function findMatch() {
  // Try to match male with female
  if (maleQueue.length > 0 && femaleQueue.length > 0) {
    const maleId = maleQueue.shift();
    const femaleId = femaleQueue.shift();
    
    // Set partners
    connections.get(maleId).partner = femaleId;
    connections.get(femaleId).partner = maleId;
    
    // Notify both users
    io.to(maleId).emit('matched', { partnerGender: 'female' });
    io.to(femaleId).emit('matched', { partnerGender: 'male' });
    
    console.log(`Matched ${maleId} with ${femaleId}`);
    return;
  }
  
  // Try to match others with anyone
  if (otherQueue.length > 0) {
    if (maleQueue.length > 0) {
      const otherId = otherQueue.shift();
      const maleId = maleQueue.shift();
      
      connections.get(otherId).partner = maleId;
      connections.get(maleId).partner = otherId;
      
      io.to(otherId).emit('matched', { partnerGender: 'male' });
      io.to(maleId).emit('matched', { partnerGender: 'other' });
      
      console.log(`Matched ${otherId} with ${maleId}`);
      return;
    }
    
    if (femaleQueue.length > 0) {
      const otherId = otherQueue.shift();
      const femaleId = femaleQueue.shift();
      
      connections.get(otherId).partner = femaleId;
      connections.get(femaleId).partner = otherId;
      
      io.to(otherId).emit('matched', { partnerGender: 'female' });
      io.to(femaleId).emit('matched', { partnerGender: 'other' });
      
      console.log(`Matched ${otherId} with ${femaleId}`);
      return;
    }
  }
  
  // Try to match others with other if no opposite gender available
  if (otherQueue.length > 1) {
    const firstOtherId = otherQueue.shift();
    const secondOtherId = otherQueue.shift();
    
    connections.get(firstOtherId).partner = secondOtherId;
    connections.get(secondOtherId).partner = firstOtherId;
    
    io.to(firstOtherId).emit('matched', { partnerGender: 'other' });
    io.to(secondOtherId).emit('matched', { partnerGender: 'other' });
    
    console.log(`Matched ${firstOtherId} with ${secondOtherId}`);
  }
}

// Function to handle user disconnection
function disconnectUser(socketId) {
  const userData = connections.get(socketId);
  if (!userData) return;
  
  // If user was in a call, notify their partner
  if (userData.partner) {
    const partnerData = connections.get(userData.partner);
    if (partnerData) {
      // Set partner's partner to null
      partnerData.partner = null;
      // Notify partner that connection was lost
      io.to(userData.partner).emit('partner-disconnected');
    }
  }
  
  // Remove user from queues if they were waiting
  maleQueue = maleQueue.filter(id => id !== socketId);
  femaleQueue = femaleQueue.filter(id => id !== socketId);
  otherQueue = otherQueue.filter(id => id !== socketId);
  
  // Remove user from connections
  connections.delete(socketId);
}

// Start server when run directly
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});