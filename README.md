# FamilyChat — Private Family Messaging App

A secure, real-time chat application built for families using React, Node.js, Socket.IO, and WebRTC.

## Features

- 💬 Real-time text messaging in multiple rooms
- 📱 Responsive Messenger-style UI (desktop & mobile)
- 🔐 JWT-authenticated sockets, invite-only registration
- 📞 One-to-one WebRTC video/voice calls
- 🎥 Automatic video quality adjustment based on connection speed
- 📴 Offline message queue with localStorage persistence
- ✍️ Typing indicators and online user presence
- 📜 Message pagination and history

## Tech Stack

**Backend:** Node.js + Express + Socket.IO + MongoDB Atlas  
**Frontend:** React 18 + Vite + React Router  
**Deployment:** Render (backend) + Vercel (frontend)  
**Cost:** $0/month (free tiers)

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (free tier: https://www.mongodb.com/cloud/atlas)
- Git

### 1. Setup MongoDB Atlas

1. Create a cluster at https://www.mongodb.com/cloud/atlas
2. Create a database user with a password
3. Whitelist all IPs (0.0.0.0/0) in Network Access
4. Copy your connection string: `mongodb+srv://user:password@cluster.xxxxx.mongodb.net/familychat`

### 2. Setup Environment Variables

**Server (`server/.env`)**
```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```
PORT=3001
MONGODB_URI=mongodb+srv://user:password@cluster.xxxxx.mongodb.net/familychat
JWT_SECRET=your_random_secret_at_least_32_chars
CLIENT_URL=http://localhost:3000
FAMILY_INVITE_CODE=change_this_private_code
```

**Client (`client/.env`)**
```bash
cp client/.env.example client/.env
```

Edit `client/.env`:
```
VITE_SERVER_URL=http://localhost:3001
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

> **Note:** Leave TURN fields empty for now. Add TURN credentials later for production reliability.

### 3. Install Dependencies

**Backend**
```bash
cd server
npm install
```

**Frontend**
```bash
cd client
npm install
```

### 4. Run Locally

**Terminal 1 — Backend**
```bash
cd server
npm run dev
```

Expected output: `Server running on port 3001`

**Terminal 2 — Frontend**
```bash
cd client
npm run dev
```

Expected output: Frontend opens at http://localhost:5173

### 5. Test the App

1. Open two browser windows (or use private browsing)
2. Go to http://localhost:5173
3. Create two accounts with the same invite code (e.g., `change_this_private_code`)
4. Switch rooms and send messages
5. Try calling another user

## Project Structure

```
FamilyChatApp/
├── server/
│   ├── models/        ← User, Message schemas
│   ├── middleware/    ← JWT authentication
│   ├── routes/        ← Auth endpoints
│   └── index.js       ← Server entry point
└── client/
    └── src/
        ├── components/  ← UI components
        ├── context/     ← AuthContext
        ├── hooks/       ← useConnectionQuality
        └── App.jsx      ← Routes
```

## Security Features

✅ **Socket.IO JWT Authentication** — Every socket connection verified  
✅ **Invite-Only Registration** — Shared invite code required to join  
✅ **Input Validation** — All user inputs validated server-side  
✅ **Password Hashing** — bcrypt with cost factor 10  
✅ **Rate Limiting** — 20 requests per 15 minutes on auth endpoints  
✅ **Message Deduplication** — Prevents duplicate messages on reconnect  
✅ **CORS & Helmet** — Security headers and origin validation  

## Room Management

Three fixed rooms:
- **#general** — Family announcements
- **#family** — Main chat room
- **#random** — Off-topic discussions

## Deployment

### Deploy Backend (Render)

1. Push to GitHub: `git push origin main`
2. Go to https://render.com and sign up
3. Create new Web Service, connect your GitHub repo
4. Set:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables (PORT, MONGODB_URI, JWT_SECRET, CLIENT_URL, FAMILY_INVITE_CODE)
6. Deploy

### Deploy Frontend (Vercel)

1. Go to https://vercel.com and sign up
2. Import your GitHub repo
3. Set:
   - Framework: Other
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variable: `VITE_SERVER_URL=https://your-render-app.onrender.com`
5. Deploy

## Troubleshooting

**"WebSocket connection failed"**
→ Backend is not running or VITE_SERVER_URL is wrong

**"Invalid invite code"**
→ Check that invite code matches FAMILY_INVITE_CODE in server/.env

**"Can't access camera/microphone"**
→ Browser blocked permissions. Click the lock icon in the address bar.

**"Video calls don't work on mobile"**
→ Add TURN credentials to environment variables (see Deployment section)

## Next Steps

- [ ] Add TURN server for mobile support (https://metered.ca)
- [ ] Implement message reactions/replies
- [ ] Add read receipts
- [ ] Enable image sharing
- [ ] Add admin controls for user management
- [ ] Set up proper logging and monitoring

## License

Private project for family use.
