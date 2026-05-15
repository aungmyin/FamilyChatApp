const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const Message = require('./models/Message');

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many requests, please try again later',
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Health check
app.get('/', (req, res) => {
  res.send('FamilyChat server running ✅');
});

// Auth routes
app.use('/api/auth', authLimiter, authRoutes);

// Socket.IO authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = {
      id: user.id,
      username: user.username,
    };

    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// Rooms configuration
const ROOMS = ['general', 'family', 'random'];
const onlineUsers = new Map(); // userId -> { socketId, username }
const userCalls = new Map(); // userId -> targetUserId (track active calls)

// Helper function to broadcast online users to a room
const broadcastOnlineUsers = (room) => {
  const roomUsers = Array.from(onlineUsers.entries()).map(([userId, user]) => ({
    userId,
    username: user.username,
    socketId: user.socketId,
  }));
  io.to(room).emit('online_users', roomUsers);
};

io.on('connection', (socket) => {
  const userId = socket.data.user.id.toString();
  const username = socket.data.user.username;

  console.log(`User ${username} connected: ${socket.id}`);

  // Add user to online users
  onlineUsers.set(userId, { socketId: socket.id, username });

  socket.on('join_room', async ({ room }) => {
    try {
      if (!ROOMS.includes(room)) {
        return socket.emit('error', { message: 'Invalid room' });
      }

      // Leave previous room
      if (socket.data.room) {
        socket.leave(socket.data.room);
      }

      socket.join(room);
      socket.data.room = room;

      // Send last 20 messages
      const messages = await Message.find({ room })
        .sort({ time: -1 })
        .limit(20)
        .lean()
        .exec();

      socket.emit('message_history', messages.reverse());

      // Broadcast that user joined
      socket.to(room).emit('user_joined', {
        username,
        time: new Date(),
      });

      // Broadcast online users
      broadcastOnlineUsers(room);
    } catch (error) {
      console.error('join_room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('send_message', async ({ room, message: messageText }) => {
    try {
      if (!ROOMS.includes(room) || !messageText) {
        return socket.emit('error', { message: 'Invalid message' });
      }

      const trimmedMessage = messageText.trim();
      if (trimmedMessage.length < 1 || trimmedMessage.length > 2000) {
        return socket.emit('error', { message: 'Message must be 1-2000 characters' });
      }

      const messageDoc = new Message({
        room,
        author: username,
        authorId: userId,
        message: trimmedMessage,
        time: new Date(),
      });

      await messageDoc.save();

      // Emit acknowledgement to sender
      socket.emit('message_ack', { id: messageDoc._id });

      // Broadcast to room
      io.to(room).emit('receive_message', {
        id: messageDoc._id,
        room: room,
        author: username,
        message: trimmedMessage,
        time: messageDoc.time,
      });

      // Notify all users of new message in this room (for unread badges)
      io.emit('room_has_message', { room });
    } catch (error) {
      console.error('send_message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('load_more', async ({ room, before }) => {
    try {
      if (!ROOMS.includes(room)) {
        return socket.emit('error', { message: 'Invalid room' });
      }

      const messages = await Message.find({ room, time: { $lt: new Date(before) } })
        .sort({ time: -1 })
        .limit(20)
        .lean()
        .exec();

      socket.emit('older_messages', messages.reverse());
    } catch (error) {
      console.error('load_more error:', error);
      socket.emit('error', { message: 'Failed to load messages' });
    }
  });

  socket.on('typing', ({ room }) => {
    if (ROOMS.includes(room)) {
      socket.to(room).emit('user_typing', username);
    }
  });

  socket.on('stop_typing', ({ room }) => {
    if (ROOMS.includes(room)) {
      socket.to(room).emit('user_stop_typing', username);
    }
  });

  // WebRTC call signaling
  socket.on('call_request', ({ to }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      const isTargetInCall = Array.from(userCalls.values()).includes(to);
      if (isTargetInCall) {
        socket.emit('call_busy', { to });
      } else {
        targetSocket.emit('call_request', { from: socket.id, caller: username });
      }
    }
  });

  socket.on('call_accept', ({ to }) => {
    userCalls.set(userId, to);
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('call_accept', { from: socket.id });
    }
  });

  socket.on('call_decline', ({ to }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('call_decline', { from: socket.id });
    }
  });

  socket.on('call_cancel', ({ to }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('call_cancel', { from: socket.id });
    }
  });

  socket.on('call_offer', ({ to, offer }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('call_offer', { from: socket.id, username: socket.data.user.username, offer });
    }
  });

  socket.on('call_answer', ({ to, answer }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('call_answer', { from: socket.id, username: socket.data.user.username, answer });
    }
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('ice_candidate', { from: socket.id, candidate });
    }
  });

  socket.on('end_call', ({ to }) => {
    userCalls.delete(userId);
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('end_call', { from: socket.id });
    }
  });

  socket.on('call_ended', ({ targetUsername }) => {
    if (socket.data.room) {
      socket.to(socket.data.room).emit('call_ended', { targetUsername });
    }
  });

  // Direct Messages
  socket.on('send_dm', async ({ recipientId, message, clientMessageId }) => {
    try {
      if (!recipientId || !message.trim()) return;

      const recipient = onlineUsers.get(recipientId);
      const conversationId = [userId, recipientId].sort().join('_');

      // Save to DB
      const msg = new Message({
        room: `dm_${conversationId}`,
        author: username,
        authorId: userId,
        message: message.trim(),
        clientMessageId,
        isDM: true,
      });
      await msg.save();

      // Ack to sender
      socket.emit('dm_ack', { id: msg._id, clientMessageId });

      // Send to recipient if online
      if (recipient) {
        io.to(recipient.socketId).emit('receive_dm', {
          id: msg._id,
          conversationId,
          author: username,
          authorId: userId,
          message: msg.message,
          time: msg.time,
        });

        // Notification badge
        io.to(recipient.socketId).emit('dm_notification', {
          fromUsername: username,
          conversationId,
        });
      }
    } catch (err) {
      console.error('send_dm error:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('load_dm_history', async ({ conversationId }) => {
    try {
      const messages = await Message.find({ room: `dm_${conversationId}`, isDM: true })
        .sort({ time: -1 })
        .limit(20)
        .lean()
        .exec();
      socket.emit('dm_history', messages.reverse());
    } catch (err) {
      console.error('load_dm_history error:', err);
    }
  });

  socket.on('load_more_dm', async ({ conversationId, before }) => {
    try {
      const messages = await Message.find({
        room: `dm_${conversationId}`,
        isDM: true,
        time: { $lt: new Date(before) },
      })
        .sort({ time: -1 })
        .limit(20)
        .lean()
        .exec();
      socket.emit('dm_older_messages', messages.reverse());
    } catch (err) {
      console.error('load_more_dm error:', err);
    }
  });

  socket.on('dm_typing', ({ recipientId }) => {
    const recipient = onlineUsers.get(recipientId);
    if (recipient) {
      io.to(recipient.socketId).emit('dm_user_typing', username);
    }
  });

  socket.on('dm_stop_typing', ({ recipientId }) => {
    const recipient = onlineUsers.get(recipientId);
    if (recipient) {
      io.to(recipient.socketId).emit('dm_user_stop_typing', username);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User ${username} disconnected: ${socket.id}`);

    onlineUsers.delete(userId);
    userCalls.delete(userId);

    if (socket.data.room) {
      socket.to(socket.data.room).emit('user_left', { username });
      broadcastOnlineUsers(socket.data.room);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const newPort = PORT + 1;
    console.log(`Port ${PORT} in use, trying ${newPort}...`);
    server.listen(newPort, () => {
      console.log(`Server running on port ${newPort}`);
    });
  }
});
