# Phase 2 — Backend Foundation
### FamilyChat Engineering Guide

**Duration:** Weeks 2–4  
**Goal:** Build the complete Node.js server with authentication, database models, and all real-time Socket.IO events.

---

## Folder Structure for This Phase

```
server/
├── .env                ← secret keys (never commit)
├── package.json
├── index.js            ← main server entry point
├── models/
│   ├── User.js         ← user schema
│   └── Message.js      ← message schema
└── routes/
    └── auth.js         ← register & login endpoints
```

---

## Step 1 — Install Dependencies

```bash
cd server
npm init -y
npm install express socket.io mongoose cors dotenv bcryptjs jsonwebtoken
npm install --save-dev nodemon
```

### What each package does

| Package | Purpose |
|---------|---------|
| express | Web server framework |
| socket.io | Real-time WebSocket communication |
| mongoose | Connect and query MongoDB |
| cors | Allow frontend to talk to backend |
| dotenv | Load secrets from .env file |
| bcryptjs | Hash passwords securely |
| jsonwebtoken | Create JWT login tokens |
| nodemon | Auto-restart server on file save |

---

## Step 2 — Update package.json Scripts

Open `server/package.json` and update the `scripts` section:

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  }
}
```

---

## Step 3 — Create Environment File

Create `server/.env`:

```
PORT=3001
MONGODB_URI=your_mongodb_atlas_connection_string_here
JWT_SECRET=make_this_long_and_random_at_least_32_characters
CLIENT_URL=http://localhost:3000
```

> ⚠️ Never commit `.env` to GitHub. It contains your secret keys.  
> The `.gitignore` from Phase 1 already prevents this.

---

## Step 4 — Create Database Models

### server/models/User.js

```javascript
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
```

### server/models/Message.js

```javascript
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  room:     { type: String, required: true },
  author:   { type: String, required: true },
  authorId: { type: String },
  message:  { type: String, required: true },
  time:     { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", MessageSchema);
```

---

## Step 5 — Create Authentication Routes

### server/routes/auth.js

```javascript
const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const User    = require("../models/User");
const router  = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields are required" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = new User({ username, email, password: hashed });
    await user.save();

    const token = jwt.sign(
      { id: user._id, username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, username });
  } catch (err) {
    res.status(400).json({ error: "Username or email already exists" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
```

---

## Step 6 — Create Main Server File

### server/index.js

```javascript
require("dotenv").config();
const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const cors       = require("cors");
const Message    = require("./models/Message");
const authRoutes = require("./routes/auth");

const app    = express();
const server = http.createServer(app);

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// ─── REST Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("FamilyChat server running ✅"));

// ─── Socket.IO (optimised for slow connections) ───────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
  pingTimeout:       60000,  // Wait 60s before disconnecting
  pingInterval:      25000,  // Check connection every 25s
  transports:        ["websocket", "polling"], // Fallback for slow networks
  upgradeTimeout:    30000,
  maxHttpBufferSize: 1e6,    // Max message size 1MB
});

// ─── Socket Events ────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a chat room
  socket.on("join_room", async ({ room, username }) => {
    socket.join(room);
    socket.data.username = username;
    socket.data.room     = room;

    // Send last 20 messages from database
    const history = await Message.find({ room })
      .sort({ time: -1 })
      .limit(20);
    socket.emit("message_history", history.reverse());

    // Tell others in room this user joined
    socket.to(room).emit("user_joined", { username, time: new Date() });
  });

  // Load older messages (when user scrolls to top)
  socket.on("load_more", async ({ room, before }) => {
    const older = await Message.find({
      room,
      time: { $lt: new Date(before) },
    })
      .sort({ time: -1 })
      .limit(20);
    socket.emit("older_messages", older.reverse());
  });

  // Receive and broadcast new message
  socket.on("send_message", async (data) => {
    const msg = new Message({
      room:     data.room,
      author:   data.author,
      authorId: data.authorId,
      message:  data.message,
    });
    await msg.save();

    io.to(data.room).emit("receive_message", {
      ...data,
      _id:  msg._id,
      time: msg.time,
    });
  });

  // Typing indicators
  socket.on("typing", ({ room, username }) =>
    socket.to(room).emit("user_typing", username)
  );
  socket.on("stop_typing", ({ room }) =>
    socket.to(room).emit("user_stop_typing")
  );

  // WebRTC voice/video call signaling
  socket.on("call_offer",    (d) => socket.to(d.to).emit("call_offer",    { ...d, from: socket.id }));
  socket.on("call_answer",   (d) => socket.to(d.to).emit("call_answer",   { ...d, from: socket.id }));
  socket.on("ice_candidate", (d) => socket.to(d.to).emit("ice_candidate", { ...d, from: socket.id }));
  socket.on("end_call",      (d) => socket.to(d.to).emit("call_ended"));

  // User disconnected
  socket.on("disconnect", () => {
    const { username, room } = socket.data;
    if (room) socket.to(room).emit("user_left", { username });
    console.log(`User disconnected: ${socket.id}`);
  });
});

// ─── Connect to MongoDB then start server ─────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected ✅");
    server.listen(process.env.PORT || 3001, () =>
      console.log(`Server running on port ${process.env.PORT || 3001} ✅`)
    );
  })
  .catch((err) => console.error("MongoDB connection error:", err));
```

---

## Step 7 — Test the Backend

```bash
cd server
npm run dev
```

Expected output:
```
MongoDB connected ✅
Server running on port 3001 ✅
```

### Test the API with curl or Postman

**Register a user:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"TestUser","email":"test@test.com","password":"123456"}'
```

Expected response:
```json
{ "token": "eyJhbGci...", "username": "TestUser" }
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
```

---

## Socket.IO Events Reference

| Event (client → server) | Payload | Description |
|---|---|---|
| `join_room` | `{ room, username }` | Join a chat room |
| `send_message` | `{ room, author, message }` | Send a message |
| `load_more` | `{ room, before }` | Load older messages |
| `typing` | `{ room, username }` | User started typing |
| `stop_typing` | `{ room }` | User stopped typing |
| `call_offer` | `{ to, offer }` | Start a WebRTC call |
| `call_answer` | `{ to, answer }` | Answer a call |
| `ice_candidate` | `{ to, candidate }` | WebRTC ICE candidate |
| `end_call` | `{ to }` | End a call |

| Event (server → client) | Payload | Description |
|---|---|---|
| `message_history` | `[messages]` | Last 20 messages on join |
| `older_messages` | `[messages]` | Older messages on scroll |
| `receive_message` | `message` | New message broadcast |
| `user_joined` | `{ username }` | Someone joined the room |
| `user_left` | `{ username }` | Someone left the room |
| `user_typing` | `username` | Someone is typing |
| `user_stop_typing` | — | Someone stopped typing |
| `call_offer` | `{ from, offer }` | Incoming call |
| `call_answer` | `{ from, answer }` | Call answered |
| `ice_candidate` | `{ candidate }` | ICE candidate received |
| `call_ended` | — | Call was ended |

---

## Phase 2 Checklist

- [ ] All npm packages installed
- [ ] `.env` file created with correct values
- [ ] `models/User.js` created
- [ ] `models/Message.js` created
- [ ] `routes/auth.js` created with register and login
- [ ] `index.js` created with full server setup
- [ ] `npm run dev` starts without errors
- [ ] MongoDB connected message shows
- [ ] Register API tested and returns token
- [ ] Login API tested and returns token

---

## Push to GitHub

```bash
cd ..  # go to root family-chat folder
git add .
git commit -m "Phase 2: backend foundation complete"
git push origin main
```

---

## What's Next

Move to **Phase 3 — Frontend Core Chat UI** to build the React app with login, chat rooms, and real-time messaging.
