const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// In-memory storage for local development (when Supabase is not available)
const memoryStorage = {
  from: (table) => ({
    insert: async (data) => {
      if (!this.data) this.data = {};
      if (!this.data[table]) this.data[table] = [];
      this.data[table].push(data);
      return { data: data, error: null };
    },
    select: async (fields) => {
      return {
        data: this.data && this.data[table] ? this.data[table] : [],
        error: null
      };
    },
    update: async (data) => {
      return {
        data: data,
        error: null
      };
    },
    delete: async () => {
      if (this.data && this.data[table]) {
        this.data[table] = [];
      }
      return { data: null, error: null };
    },
    eq: (field, value) => ({
      single: async () => {
        if (!this.data || !this.data[table]) return { data: null, error: null };
        const item = this.data[table].find(item => item[field] === value);
        return { data: item || null, error: null };
      },
      update: async (data) => {
        if (this.data && this.data[table]) {
          this.data[table] = this.data[table].map(item => 
            item[field] === value ? { ...item, ...data } : item
          );
        }
        return { data: data, error: null };
      },
      delete: async () => {
        if (this.data && this.data[table]) {
          this.data[table] = this.data[table].filter(item => item[field] !== value);
        }
        return { data: null, error: null };
      }
    }),
    order: (field, options) => ({
      limit: async (count) => {
        if (!this.data || !this.data[table]) return { data: [], error: null };
        let result = [...this.data[table]];
        if (options.ascending === false) {
          result.sort((a, b) => b[field] - a[field]);
        }
        return { data: result.slice(0, count), error: null };
      }
    })
  })
};

// Supabase configuration
const supabaseUrl = 'https://ptqjnuquemfelgutgilp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cWpudXF1ZW1mZWxndXRnaWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTYxNTgsImV4cCI6MjA3NDczMjE1OH0.nUbAY5kWglAHVxio7uEB_ZzktCaz5tZ93vZic3G2XEU';
let supabase;

// Initialize Supabase client or fallback to in-memory storage
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized');
} catch (error) {
  console.log('Failed to initialize Supabase, using in-memory storage');
  supabase = memoryStorage;
}

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

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // When a user joins, add them to the appropriate queue
  socket.on('join', async (data) => {
    const { gender } = data;
    console.log(`${socket.id} joined as ${gender}`);
    
    // Add user to the queue table in Supabase
    const { error: queueError } = await supabase
      .from('queues')
      .insert([{ socket_id: socket.id, gender, created_at: new Date() }]);
    
    // Store user data
    const { error: userError } = await supabase
      .from('users')
      .insert([{ socket_id: socket.id, gender, partner_id: null, created_at: new Date() }]);
    
    if (queueError) console.error('Error adding to queue:', queueError);
    if (userError) console.error('Error adding user:', userError);
    
    // Try to find a match
    await findMatch();
  });

  // Handle WebRTC signaling
  socket.on('offer', async (data) => {
    const { data: user, error } = await supabase
      .from('users')
      .select('partner_id')
      .eq('socket_id', socket.id)
      .single();
    
    if (!error && user && user.partner_id) {
      io.to(user.partner_id).emit('offer', data);
    }
  });

  socket.on('answer', async (data) => {
    const { data: user, error } = await supabase
      .from('users')
      .select('partner_id')
      .eq('socket_id', socket.id)
      .single();
    
    if (!error && user && user.partner_id) {
      io.to(user.partner_id).emit('answer', data);
    }
  });

  socket.on('ice-candidate', async (data) => {
    const { data: user, error } = await supabase
      .from('users')
      .select('partner_id')
      .eq('socket_id', socket.id)
      .single();
    
    if (!error && user && user.partner_id) {
      io.to(user.partner_id).emit('ice-candidate', data);
    }
  });

  // Handle chat messages
  socket.on('chat-message', async (data) => {
    const { data: user, error } = await supabase
      .from('users')
      .select('partner_id')
      .eq('socket_id', socket.id)
      .single();
    
    if (!error && user && user.partner_id) {
      io.to(user.partner_id).emit('chat-message', data);
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
    const { data: user, error } = await supabase
      .from('users')
      .select('gender')
      .eq('socket_id', socket.id)
      .single();
    
    if (!error && user) {
      const { error: queueError } = await supabase
        .from('queues')
        .insert([{ socket_id: socket.id, gender: user.gender, created_at: new Date() }]);
      
      if (queueError) console.error('Error re-adding to queue:', queueError);
      await findMatch();
    }
  });
});

// Function to match users
async function findMatch() {
  // Get all users in queues
  const { data: queues, error: queueError } = await supabase
    .from('queues')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (queueError) {
    console.error('Error fetching queues:', queueError);
    return;
  }
  
  // Group users by gender
  const maleQueue = queues.filter(q => q.gender === 'male');
  const femaleQueue = queues.filter(q => q.gender === 'female');
  const otherQueue = queues.filter(q => q.gender === 'other');
  
  // Try to match male with female
  if (maleQueue.length > 0 && femaleQueue.length > 0) {
    const maleUser = maleQueue[0];
    const femaleUser = femaleQueue[0];
    
    // Set partners
    await supabase
      .from('users')
      .update({ partner_id: femaleUser.socket_id })
      .eq('socket_id', maleUser.socket_id);
    
    await supabase
      .from('users')
      .update({ partner_id: maleUser.socket_id })
      .eq('socket_id', femaleUser.socket_id);
    
    // Remove from queues
    await supabase
      .from('queues')
      .delete()
      .eq('socket_id', maleUser.socket_id);
    
    await supabase
      .from('queues')
      .delete()
      .eq('socket_id', femaleUser.socket_id);
    
    // Notify both users
    io.to(maleUser.socket_id).emit('matched', { partnerGender: 'female' });
    io.to(femaleUser.socket_id).emit('matched', { partnerGender: 'male' });
    
    console.log(`Matched ${maleUser.socket_id} with ${femaleUser.socket_id}`);
    return;
  }
  
  // Try to match others with anyone
  if (otherQueue.length > 0) {
    const otherUser = otherQueue[0];
    
    if (maleQueue.length > 0) {
      const maleUser = maleQueue[0];
      
      // Set partners
      await supabase
        .from('users')
        .update({ partner_id: maleUser.socket_id })
        .eq('socket_id', otherUser.socket_id);
      
      await supabase
        .from('users')
        .update({ partner_id: otherUser.socket_id })
        .eq('socket_id', maleUser.socket_id);
      
      // Remove from queues
      await supabase
        .from('queues')
        .delete()
        .eq('socket_id', otherUser.socket_id);
      
      await supabase
        .from('queues')
        .delete()
        .eq('socket_id', maleUser.socket_id);
      
      // Notify both users
      io.to(otherUser.socket_id).emit('matched', { partnerGender: 'male' });
      io.to(maleUser.socket_id).emit('matched', { partnerGender: 'other' });
      
      console.log(`Matched ${otherUser.socket_id} with ${maleUser.socket_id}`);
      return;
    }
    
    if (femaleQueue.length > 0) {
      const femaleUser = femaleQueue[0];
      
      // Set partners
      await supabase
        .from('users')
        .update({ partner_id: femaleUser.socket_id })
        .eq('socket_id', otherUser.socket_id);
      
      await supabase
        .from('users')
        .update({ partner_id: otherUser.socket_id })
        .eq('socket_id', femaleUser.socket_id);
      
      // Remove from queues
      await supabase
        .from('queues')
        .delete()
        .eq('socket_id', otherUser.socket_id);
      
      await supabase
        .from('queues')
        .delete()
        .eq('socket_id', femaleUser.socket_id);
      
      // Notify both users
      io.to(otherUser.socket_id).emit('matched', { partnerGender: 'female' });
      io.to(femaleUser.socket_id).emit('matched', { partnerGender: 'other' });
      
      console.log(`Matched ${otherUser.socket_id} with ${femaleUser.socket_id}`);
      return;
    }
  }
  
  // Try to match others with other if no opposite gender available
  if (otherQueue.length > 1) {
    const firstOtherUser = otherQueue[0];
    const secondOtherUser = otherQueue[1];
    
    // Set partners
    await supabase
      .from('users')
      .update({ partner_id: secondOtherUser.socket_id })
      .eq('socket_id', firstOtherUser.socket_id);
    
    await supabase
      .from('users')
      .update({ partner_id: firstOtherUser.socket_id })
      .eq('socket_id', secondOtherUser.socket_id);
    
    // Remove from queues
    await supabase
      .from('queues')
      .delete()
      .eq('socket_id', firstOtherUser.socket_id);
    
    await supabase
      .from('queues')
      .delete()
      .eq('socket_id', secondOtherUser.socket_id);
    
    // Notify both users
    io.to(firstOtherUser.socket_id).emit('matched', { partnerGender: 'other' });
    io.to(secondOtherUser.socket_id).emit('matched', { partnerGender: 'other' });
    
    console.log(`Matched ${firstOtherUser.socket_id} with ${secondOtherUser.socket_id}`);
  }
}

// Function to handle user disconnection
async function disconnectUser(socketId) {
  // Get user data
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('partner_id')
    .eq('socket_id', socketId)
    .single();
  
  // If user was in a call, notify their partner
  if (!userError && user && user.partner_id) {
    // Set partner's partner to null
    await supabase
      .from('users')
      .update({ partner_id: null })
      .eq('socket_id', user.partner_id);
    
    // Notify partner that connection was lost
    io.to(user.partner_id).emit('partner-disconnected');
  }
  
  // Remove user from queues and users table
  await supabase
    .from('queues')
    .delete()
    .eq('socket_id', socketId);
  
  await supabase
    .from('users')
    .delete()
    .eq('socket_id', socketId);
}

// Start server when run directly
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});