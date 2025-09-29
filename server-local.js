const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const redis = require('redis');

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

// Redis client for local development
const redisClient = {
  connected: true,
  async lpush(key, value) {
    if (!this.data) this.data = {};
    if (!this.data[key]) this.data[key] = [];
    this.data[key].unshift(value);
    return this.data[key].length;
  },
  async rpop(key) {
    if (!this.data) this.data = {};
    if (!this.data[key] || this.data[key].length === 0) return null;
    return this.data[key].pop();
  },
  async hset(key, field, value) {
    if (!this.data) this.data = {};
    if (!this.data[key]) this.data[key] = {};
    this.data[key][field] = value;
    return 1;
  },
  async hget(key, field) {
    if (!this.data || !this.data[key]) return null;
    return this.data[key][field];
  },
  async hdel(key, field) {
    if (!this.data || !this.data[key]) return 0;
    if (this.data[key][field] !== undefined) {
      delete this.data[key][field];
      return 1;
    }
    return 0;
  },
  async del(key) {
    if (!this.data) return 0;
    if (this.data[key] !== undefined) {
      delete this.data[key];
      return 1;
    }
    return 0;
  }
};

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // When a user joins, add them to the appropriate queue
  socket.on('join', async (data) => {
    const { gender } = data;
    console.log(`${socket.id} joined as ${gender}`);
    
    // Add user to the appropriate queue in Redis
    const queueKey = `queue:${gender}`;
    await redisClient.lpush(queueKey, socket.id);
    
    // Store user data
    const userKey = `user:${socket.id}`;
    await redisClient.hset(userKey, 'gender', gender);
    await redisClient.hset(userKey, 'partner', 'null');
    
    // Try to find a match
    await findMatch();
  });

  // Handle WebRTC signaling
  socket.on('offer', async (data) => {
    const userKey = `user:${socket.id}`;
    const partnerId = await redisClient.hget(userKey, 'partner');
    if (partnerId && partnerId !== 'null') {
      io.to(partnerId).emit('offer', data);
    }
  });

  socket.on('answer', async (data) => {
    const userKey = `user:${socket.id}`;
    const partnerId = await redisClient.hget(userKey, 'partner');
    if (partnerId && partnerId !== 'null') {
      io.to(partnerId).emit('answer', data);
    }
  });

  socket.on('ice-candidate', async (data) => {
    const userKey = `user:${socket.id}`;
    const partnerId = await redisClient.hget(userKey, 'partner');
    if (partnerId && partnerId !== 'null') {
      io.to(partnerId).emit('ice-candidate', data);
    }
  });

  // Handle chat messages
  socket.on('chat-message', async (data) => {
    const userKey = `user:${socket.id}`;
    const partnerId = await redisClient.hget(userKey, 'partner');
    if (partnerId && partnerId !== 'null') {
      io.to(partnerId).emit('chat-message', data);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    await disconnectUser(socket.id);
  });

  // Handle user manually disconnecting
  socket.on('disconnect-call', async () => {
    await disconnectUser(socket.id);
    // Re-add user to queue
    const userKey = `user:${socket.id}`;
    const gender = await redisClient.hget(userKey, 'gender');
    if (gender) {
      const queueKey = `queue:${gender}`;
      await redisClient.lpush(queueKey, socket.id);
      await findMatch();
    }
  });
});

// Function to match users
async function findMatch() {
  // Try to match male with female
  const maleId = await redisClient.rpop('queue:male');
  const femaleId = await redisClient.rpop('queue:female');
  
  if (maleId && femaleId) {
    // Set partners
    await redisClient.hset(`user:${maleId}`, 'partner', femaleId);
    await redisClient.hset(`user:${femaleId}`, 'partner', maleId);
    
    // Notify both users
    io.to(maleId).emit('matched', { partnerGender: 'female' });
    io.to(femaleId).emit('matched', { partnerGender: 'male' });
    
    console.log(`Matched ${maleId} with ${femaleId}`);
    return;
  }
  
  // Put back unmatched users
  if (maleId) await redisClient.lpush('queue:male', maleId);
  if (femaleId) await redisClient.lpush('queue:female', femaleId);
  
  // Try to match others with anyone
  const otherId = await redisClient.rpop('queue:other');
  if (otherId) {
    const maleId = await redisClient.rpop('queue:male');
    if (maleId) {
      await redisClient.hset(`user:${otherId}`, 'partner', maleId);
      await redisClient.hset(`user:${maleId}`, 'partner', otherId);
      
      io.to(otherId).emit('matched', { partnerGender: 'male' });
      io.to(maleId).emit('matched', { partnerGender: 'other' });
      
      console.log(`Matched ${otherId} with ${maleId}`);
      return;
    }
    
    const femaleId = await redisClient.rpop('queue:female');
    if (femaleId) {
      await redisClient.hset(`user:${otherId}`, 'partner', femaleId);
      await redisClient.hset(`user:${femaleId}`, 'partner', otherId);
      
      io.to(otherId).emit('matched', { partnerGender: 'female' });
      io.to(femaleId).emit('matched', { partnerGender: 'other' });
      
      console.log(`Matched ${otherId} with ${femaleId}`);
      return;
    }
    
    // Put back unmatched other user
    await redisClient.lpush('queue:other', otherId);
  }
  
  // Try to match others with other if no opposite gender available
  const firstOtherId = await redisClient.rpop('queue:other');
  const secondOtherId = await redisClient.rpop('queue:other');
  
  if (firstOtherId && secondOtherId) {
    await redisClient.hset(`user:${firstOtherId}`, 'partner', secondOtherId);
    await redisClient.hset(`user:${secondOtherId}`, 'partner', firstOtherId);
    
    io.to(firstOtherId).emit('matched', { partnerGender: 'other' });
    io.to(secondOtherId).emit('matched', { partnerGender: 'other' });
    
    console.log(`Matched ${firstOtherId} with ${secondOtherId}`);
  } else {
    // Put back unmatched other users
    if (firstOtherId) await redisClient.lpush('queue:other', firstOtherId);
    if (secondOtherId) await redisClient.lpush('queue:other', secondOtherId);
  }
}

// Function to handle user disconnection
async function disconnectUser(socketId) {
  const userKey = `user:${socketId}`;
  const gender = await redisClient.hget(userKey, 'gender');
  const partnerId = await redisClient.hget(userKey, 'partner');
  
  // If user was in a call, notify their partner
  if (partnerId && partnerId !== 'null') {
    // Set partner's partner to null
    await redisClient.hset(`user:${partnerId}`, 'partner', 'null');
    // Notify partner that connection was lost
    io.to(partnerId).emit('partner-disconnected');
  }
  
  // Remove user from queues if they were waiting
  // Note: In a production environment, you would implement a more robust
  // queue removal mechanism, as removing from the middle of a Redis list
  // is not straightforward. For simplicity, we'll just remove from queues
  // when matching (which we already do).
  
  // Remove user data
  await redisClient.del(userKey);
}

// Start server when run directly
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});