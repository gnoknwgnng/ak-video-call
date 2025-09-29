const http = require('http');
const socketIo = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

// Supabase client (in production, use environment variables)
let supabase;

// Initialize Supabase client
function initSupabase() {
  try {
    // Use environment variables in production, fallback to hardcoded values for testing
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ptqjnuquemfelgutgilp.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cWpudXF1ZW1mZWxndXRnaWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTYxNTgsImV4cCI6MjA3NDczMjE1OH0.nUbAY5kWglAHVxio7uEB_ZzktCaz5tZ93vZic3G2XEU';
    
    console.log('Initializing Supabase with URL:', supabaseUrl);
    
    if (supabaseUrl && supabaseAnonKey) {
      // Production - use Supabase with your credentials
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('Supabase client created successfully');
    } else {
      console.log('Using in-memory storage as fallback');
      // Development - use in-memory storage
      supabase = {
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
    }
    
    return supabase;
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Initialize Supabase
let supabaseClient;
try {
  supabaseClient = initSupabase();
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  throw error;
}

// Function to handle Socket.IO connections
async function initSocket(server) {
  console.log('Initializing Socket.IO server...');
  
  try {
    const io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ["websocket", "polling"],
      allowEIO3: true,
      path: "/socket.io/"
    });
    
    console.log('Socket.IO server created successfully');

    io.on('connection', async (socket) => {
      console.log('User connected:', socket.id);

      // When a user joins, add them to the appropriate queue
      socket.on('join', async (data) => {
        try {
          const { gender } = data;
          console.log(`${socket.id} joined as ${gender}`);
          
          // Add user to the queue table in Supabase
          const { data: queueData, error: queueError } = await supabaseClient
            .from('queues')
            .insert([{ socket_id: socket.id, gender, created_at: new Date() }]);
          
          if (queueError) {
            console.error('Error adding to queue:', queueError);
            // Send error to client
            socket.emit('error', { message: 'Failed to join queue', error: queueError.message });
            return;
          }
          
          console.log('Successfully added to queue:', queueData);
          
          // Store user data
          const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .insert([{ socket_id: socket.id, gender, partner_id: null, created_at: new Date() }]);
          
          if (userError) {
            console.error('Error adding user:', userError);
            // Send error to client
            socket.emit('error', { message: 'Failed to register user', error: userError.message });
            return;
          }
          
          console.log('Successfully registered user:', userData);
          
          // Try to find a match
          await findMatch(io);
        } catch (err) {
          console.error('Unexpected error in join handler:', err);
          console.error('Stack trace:', err.stack);
          socket.emit('error', { message: 'Unexpected error occurred', error: err.message });
        }
      });

      // Handle WebRTC signaling
      socket.on('offer', async (data) => {
        try {
          const { data: user, error } = await supabaseClient
            .from('users')
            .select('partner_id')
            .eq('socket_id', socket.id)
            .single();
          
          if (!error && user && user.partner_id) {
            io.to(user.partner_id).emit('offer', data);
          }
        } catch (err) {
          console.error('Error in offer handler:', err);
        }
      });

      socket.on('answer', async (data) => {
        try {
          const { data: user, error } = await supabaseClient
            .from('users')
            .select('partner_id')
            .eq('socket_id', socket.id)
            .single();
          
          if (!error && user && user.partner_id) {
            io.to(user.partner_id).emit('answer', data);
          }
        } catch (err) {
          console.error('Error in answer handler:', err);
        }
      });

      socket.on('ice-candidate', async (data) => {
        try {
          const { data: user, error } = await supabaseClient
            .from('users')
            .select('partner_id')
            .eq('socket_id', socket.id)
            .single();
          
          if (!error && user && user.partner_id) {
            io.to(user.partner_id).emit('ice-candidate', data);
          }
        } catch (err) {
          console.error('Error in ice-candidate handler:', err);
        }
      });

      // Handle chat messages
      socket.on('chat-message', async (data) => {
        try {
          const { data: user, error } = await supabaseClient
            .from('users')
            .select('partner_id')
            .eq('socket_id', socket.id)
            .single();
          
          if (!error && user && user.partner_id) {
            io.to(user.partner_id).emit('chat-message', data);
          }
        } catch (err) {
          console.error('Error in chat-message handler:', err);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        await disconnectUser(socket.id, io);
      });

      // Handle user manually disconnecting
      socket.on('disconnect-call', async () => {
        try {
          await disconnectUser(socket.id, io);
          // Re-add user to queue
          const { data: user, error } = await supabaseClient
            .from('users')
            .select('gender')
            .eq('socket_id', socket.id)
            .single();
          
          if (!error && user) {
            const { error: queueError } = await supabaseClient
              .from('queues')
              .insert([{ socket_id: socket.id, gender: user.gender, created_at: new Date() }]);
            
            if (queueError) console.error('Error re-adding to queue:', queueError);
            await findMatch(io);
          }
        } catch (err) {
          console.error('Error in disconnect-call handler:', err);
        }
      });
    });

    // Function to match users
    async function findMatch(io) {
      try {
        // Get all users in queues
        const { data: queues, error: queueError } = await supabaseClient
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
          await supabaseClient
            .from('users')
            .update({ partner_id: femaleUser.socket_id })
            .eq('socket_id', maleUser.socket_id);
          
          await supabaseClient
            .from('users')
            .update({ partner_id: maleUser.socket_id })
            .eq('socket_id', femaleUser.socket_id);
          
          // Remove from queues
          await supabaseClient
            .from('queues')
            .delete()
            .eq('socket_id', maleUser.socket_id);
          
          await supabaseClient
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
            await supabaseClient
              .from('users')
              .update({ partner_id: maleUser.socket_id })
              .eq('socket_id', otherUser.socket_id);
            
            await supabaseClient
              .from('users')
              .update({ partner_id: otherUser.socket_id })
              .eq('socket_id', maleUser.socket_id);
            
            // Remove from queues
            await supabaseClient
              .from('queues')
              .delete()
              .eq('socket_id', otherUser.socket_id);
            
            await supabaseClient
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
            await supabaseClient
              .from('users')
              .update({ partner_id: femaleUser.socket_id })
              .eq('socket_id', otherUser.socket_id);
            
            await supabaseClient
              .from('users')
              .update({ partner_id: otherUser.socket_id })
              .eq('socket_id', femaleUser.socket_id);
            
            // Remove from queues
            await supabaseClient
              .from('queues')
              .delete()
              .eq('socket_id', otherUser.socket_id);
            
            await supabaseClient
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
          await supabaseClient
            .from('users')
            .update({ partner_id: secondOtherUser.socket_id })
            .eq('socket_id', firstOtherUser.socket_id);
          
          await supabaseClient
            .from('users')
            .update({ partner_id: firstOtherUser.socket_id })
            .eq('socket_id', secondOtherUser.socket_id);
          
          // Remove from queues
          await supabaseClient
            .from('queues')
            .delete()
            .eq('socket_id', firstOtherUser.socket_id);
          
          await supabaseClient
            .from('queues')
            .delete()
            .eq('socket_id', secondOtherUser.socket_id);
          
          // Notify both users
          io.to(firstOtherUser.socket_id).emit('matched', { partnerGender: 'other' });
          io.to(secondOtherUser.socket_id).emit('matched', { partnerGender: 'other' });
          
          console.log(`Matched ${firstOtherUser.socket_id} with ${secondOtherUser.socket_id}`);
        }
      } catch (error) {
        console.error('Error in findMatch:', error);
      }
    }

    // Function to handle user disconnection
    async function disconnectUser(socketId, io) {
      try {
        // Get user data
        const { data: user, error: userError } = await supabaseClient
          .from('users')
          .select('partner_id')
          .eq('socket_id', socketId)
          .single();
        
        // If user was in a call, notify their partner
        if (!userError && user && user.partner_id) {
          // Set partner's partner to null
          await supabaseClient
            .from('users')
            .update({ partner_id: null })
            .eq('socket_id', user.partner_id);
          
          // Notify partner that connection was lost
          io.to(user.partner_id).emit('partner-disconnected');
        }
        
        // Remove user from queues and users table
        await supabaseClient
          .from('queues')
          .delete()
          .eq('socket_id', socketId);
        
        await supabaseClient
          .from('users')
          .delete()
          .eq('socket_id', socketId);
      } catch (error) {
        console.error('Error in disconnectUser:', error);
      }
    }

    console.log('Socket.IO event handlers registered');
    return io;
  } catch (error) {
    console.error('Error initializing Socket.IO:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

module.exports = { initSocket };