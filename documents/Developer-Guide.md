# FamilyChat — Developer Guide
### Complete Technical Reference

**Stack:** React + Node.js + Socket.IO + MongoDB Atlas  
**Language:** JavaScript (JSX frontend, Node.js backend)  
**Deployment:** Vercel (frontend) + Render (backend)  
**Cost:** $0/month

---

## Before You Build

Read [Implementation-Hardening-Plan.md](./Implementation-Hardening-Plan.md) before implementing the phase guides. It closes important gaps around authenticated sockets, invite-only registration, room membership, offline message acknowledgements, WebRTC targeting, Vite setup, and free-tier deployment expectations.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Full Folder Structure](#folder-structure)
4. [Environment Variables](#environment-variables)
5. [All npm Packages](#npm-packages)
6. [API Reference](#api-reference)
7. [Socket.IO Events Reference](#socketio-events)
8. [Database Schemas](#database-schemas)
9. [Authentication Flow](#authentication-flow)
10. [WebRTC Call Flow](#webrtc-call-flow)
11. [Slow-Connection Features](#slow-connection-features)
12. [Git Workflow](#git-workflow)
13. [Local Development Commands](#local-development)
14. [Deployment Reference](#deployment-reference)
15. [Common Errors & Fixes](#common-errors)
16. [Glossary](#glossary)

---

## 1. Project Overview {#project-overview}

FamilyChat is a private real-time chat application built for family use. It supports:

- Text messaging in multiple rooms
- Typing indicators and presence (join/leave notifications)
- Offline message queuing (messages saved when disconnected, sent on reconnect)
- Voice and video calls using WebRTC
- Automatic video quality adjustment based on connection speed
- Works on slow connections (2G/3G compatible)

All infrastructure runs on free tiers of cloud services.

---

## 2. Architecture {#architecture}

### System diagram

```
Browser (React)
  │
  ├─── HTTP (axios) ──────────────────► Express API
  │                                       │
  └─── WebSocket (Socket.IO) ─────────► Socket.IO Server
                                          │
                                       Mongoose
                                          │
                                       MongoDB Atlas
                                       (cloud database)

For calls:
Browser A ──── signaling via Socket.IO ───► Browser B
Browser A ◄───────── direct WebRTC ────────► Browser B
         (audio/video bypass the server)
```

### Request lifecycle

```
1. User types message → React state update
2. socket.emit("send_message", data)
3. Server receives → saves to MongoDB
4. io.to(room).emit("receive_message", data)
5. All clients in room → React state update → re-render
```

---

## 3. Full Folder Structure {#folder-structure}

```
family-chat/
│
├── .gitignore
├── README.md
│
├── server/
│   ├── .env                           ← secret keys (never commit)
│   ├── package.json
│   ├── index.js                       ← server entry point
│   ├── models/
│   │   ├── User.js                    ← user DB schema
│   │   └── Message.js                 ← message DB schema
│   └── routes/
│       └── auth.js                    ← /api/auth/register, /api/auth/login
│
└── client/
    ├── .env                           ← REACT_APP_SERVER_URL
    ├── package.json
    ├── public/
    │   └── index.html                 ← HTML shell (rarely edited)
    └── src/
        ├── App.jsx                    ← routes, lazy loading
        ├── index.js                   ← React entry point
        ├── context/
        │   └── AuthContext.jsx        ← login state management
        ├── hooks/
        │   └── useConnectionQuality.js ← network speed detection
        └── components/
            ├── Login.jsx              ← login form
            ├── Register.jsx           ← registration form
            ├── ChatRoom.jsx           ← main chat UI
            └── VideoCall.jsx          ← WebRTC video/voice calls
```

---

## 4. Environment Variables {#environment-variables}

### server/.env (local development)
```
PORT=3001
MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/familychat
JWT_SECRET=your_random_secret_at_least_32_chars
CLIENT_URL=http://localhost:3000
```

### client/.env (local development)
```
REACT_APP_SERVER_URL=http://localhost:3001
```

### Production (set in Render and Vercel dashboards)
```
# Render — server environment variables
MONGODB_URI  = mongodb+srv://user:password@cluster.xxxxx.mongodb.net/familychat
JWT_SECRET   = your_random_secret
CLIENT_URL   = https://your-app.vercel.app
PORT         = 3001

# Vercel — client environment variables
REACT_APP_SERVER_URL = https://your-server.onrender.com
```

> **Note:** `REACT_APP_` prefix is required by Create React App for all frontend env vars.

---

## 5. All npm Packages {#npm-packages}

### Backend (server/package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4 | HTTP server and REST API |
| socket.io | ^4 | WebSocket server |
| mongoose | ^7 | MongoDB object modeling |
| cors | ^2 | Cross-origin request headers |
| dotenv | ^16 | Load .env file |
| bcryptjs | ^2 | Hash and verify passwords |
| jsonwebtoken | ^9 | Create and verify JWT tokens |
| nodemon | ^3 | Dev: restart server on save |

Install all:
```bash
cd server
npm install express socket.io mongoose cors dotenv bcryptjs jsonwebtoken
npm install --save-dev nodemon
```

### Frontend (client/package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18 | UI framework |
| react-dom | ^18 | Render React to DOM |
| react-router-dom | ^6 | Client-side routing |
| socket.io-client | ^4 | Connect to Socket.IO server |
| axios | ^1 | HTTP requests |

Install all:
```bash
cd client
npx create-react-app .
npm install socket.io-client axios react-router-dom
```

---

## 6. API Reference {#api-reference}

Base URL: `http://localhost:3001` (local) or your Render URL (production)

### POST /api/auth/register

Register a new user.

**Request body:**
```json
{
  "username": "Mum",
  "email": "mum@example.com",
  "password": "secretpassword"
}
```

**Success response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "Mum"
}
```

**Error response (400):**
```json
{ "error": "Username or email already exists" }
```

---

### POST /api/auth/login

Login an existing user.

**Request body:**
```json
{
  "email": "mum@example.com",
  "password": "secretpassword"
}
```

**Success response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "Mum"
}
```

**Error responses (400):**
```json
{ "error": "User not found" }
{ "error": "Wrong password" }
```

---

### GET /

Health check endpoint.

**Response:** `FamilyChat server running ✅`

---

## 7. Socket.IO Events Reference {#socketio-events}

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ room: string, username: string }` | Join a chat room, receive last 20 messages |
| `send_message` | `{ room, author, message, time }` | Send a new message |
| `load_more` | `{ room: string, before: Date }` | Load 20 messages older than `before` |
| `typing` | `{ room: string, username: string }` | User started typing |
| `stop_typing` | `{ room: string }` | User stopped typing |
| `call_offer` | `{ to: socketId, offer: RTCOffer }` | Initiate a WebRTC call |
| `call_answer` | `{ to: socketId, answer: RTCAnswer }` | Answer a WebRTC call |
| `ice_candidate` | `{ to: socketId, candidate: RTCIceCandidate }` | Send ICE candidate |
| `end_call` | `{ to: socketId }` | Hang up |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message_history` | `Message[]` | Last 20 messages sent on join |
| `older_messages` | `Message[]` | Older messages for pagination |
| `receive_message` | `Message` | New message broadcast to room |
| `user_joined` | `{ username: string, time: Date }` | User joined the room |
| `user_left` | `{ username: string }` | User disconnected |
| `user_typing` | `username: string` | Someone is typing |
| `user_stop_typing` | — | Someone stopped typing |
| `call_offer` | `{ from: socketId, offer: RTCOffer }` | Incoming call |
| `call_answer` | `{ from: socketId, answer: RTCAnswer }` | Call answered |
| `ice_candidate` | `{ from: socketId, candidate: RTCIceCandidate }` | ICE candidate |
| `call_ended` | — | The other person hung up |

---

## 8. Database Schemas {#database-schemas}

### User

```javascript
{
  _id:       ObjectId,          // auto-generated
  username:  String (unique),   // display name
  email:     String (unique),   // login email
  password:  String,            // bcrypt hash — never plain text
  createdAt: Date               // account creation time
}
```

### Message

```javascript
{
  _id:      ObjectId,   // auto-generated
  room:     String,     // room name e.g. "general"
  author:   String,     // username of sender
  authorId: String,     // socket ID of sender
  message:  String,     // message content
  time:     Date        // when message was sent
}
```

---

## 9. Authentication Flow {#authentication-flow}

```
1. User submits register form
        ↓
2. POST /api/auth/register
        ↓
3. Server hashes password with bcrypt (cost factor 10)
        ↓
4. User saved to MongoDB
        ↓
5. Server signs JWT: { id, username } + JWT_SECRET → token (7 day expiry)
        ↓
6. Token returned to client
        ↓
7. Client saves token in localStorage
        ↓
8. AuthContext stores { token, username } in React state
        ↓
9. PrivateRoute allows access to /chat
        ↓
10. On refresh: token loaded from localStorage → user stays logged in
        ↓
11. On logout: localStorage cleared → user redirected to /login
```

**JWT token contains:**
```json
{
  "id": "mongodb_user_id",
  "username": "Mum",
  "iat": 1234567890,
  "exp": 1235172690
}
```

---

## 10. WebRTC Call Flow {#webrtc-call-flow}

```
User A (caller)                 Server              User B (receiver)
     │                            │                       │
     │── call_offer ─────────────►│                       │
     │   { to: B, offer }         │── call_offer ────────►│
     │                            │   { from: A, offer }  │
     │                            │                       │ creates answer
     │                            │◄─ call_answer ────────│
     │◄─ call_answer ─────────────│   { from: B, answer } │
     │                            │                       │
     │── ice_candidate ───────────►│── ice_candidate ─────►│
     │◄─ ice_candidate ───────────◄│◄─ ice_candidate ──────│
     │                            │                       │
     │◄══════ direct peer connection established ═════════►│
     │         (audio/video bypasses server)               │
```

### Video quality auto-switch flow

```
Call starts
  → useConnectionQuality measures speed
  → picks quality preset (low/medium/high)
  → getStream() opens camera at that resolution

Every 30 seconds:
  → speed re-measured
  → if quality changed:
      → stop old video track
      → open camera at new resolution
      → RTCRtpSender.replaceTrack(newTrack)
      → call continues, no interruption
      → show notification toast
```

---

## 11. Slow-Connection Features {#slow-connection-features}

| Feature | Implementation | File |
|---------|---------------|------|
| Socket.IO polling fallback | `transports: ["websocket", "polling"]` | server/index.js + ChatRoom.jsx |
| Extended ping timeout | `pingTimeout: 60000` | server/index.js |
| Auto-reconnect | `reconnectionAttempts: 10` | ChatRoom.jsx |
| Connection status bar | `socket.on("connect"/"disconnect")` | ChatRoom.jsx |
| Offline message queue | `messageQueueRef` + flush on reconnect | ChatRoom.jsx |
| Pending message UI | `msg.pending` flag + opacity + ⏳ | ChatRoom.jsx |
| Paginated messages | `limit(20)` + `load_more` event | server/index.js |
| Scroll-to-top loading | `handleScroll` + `onScroll` | ChatRoom.jsx |
| Lazy loading | `React.lazy()` + `Suspense` | App.jsx |
| Video quality detection | `useConnectionQuality` hook | hooks/useConnectionQuality.js |
| Mid-call quality switch | `RTCRtpSender.replaceTrack()` | VideoCall.jsx |
| Default to low quality | `useState("low")` | VideoCall.jsx |

---

## 12. Git Workflow {#git-workflow}

### Initial setup
```bash
git clone https://github.com/YOUR_USERNAME/family-chat.git
cd family-chat
```

### Daily workflow
```bash
# Check what changed
git status

# Stage all changes
git add .

# Commit with a clear message
git commit -m "add feature: typing indicator"

# Push to GitHub (triggers auto-deploy)
git push origin main
```

### Good commit messages
```
feat: add video call component
fix: message not sending when offline
chore: update packages
docs: update README
refactor: simplify ChatRoom socket setup
```

### Undo last commit (if not pushed)
```bash
git reset --soft HEAD~1
```

---

## 13. Local Development Commands {#local-development}

### Start everything
```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm start
```

### Access the app
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Backend health check: http://localhost:3001/

### Test API with curl
```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"Test","email":"test@test.com","password":"123456"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
```

### Install packages from scratch
```bash
# Backend
cd server && npm install

# Frontend
cd client && npm install
```

---

## 14. Deployment Reference {#deployment-reference}

### Render (backend)

| Setting | Value |
|---------|-------|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Node version | 18+ |
| Plan | Free |

Auto-deploys when you push to `main` branch on GitHub.

Free tier sleeps after 15 min inactivity — use UptimeRobot to prevent.

### Vercel (frontend)

| Setting | Value |
|---------|-------|
| Root Directory | `client` |
| Framework | Create React App |
| Build Command | `npm run build` |
| Output Directory | `build` |
| Plan | Free (Hobby) |

Auto-deploys when you push to `main` branch on GitHub.

### MongoDB Atlas

| Setting | Value |
|---------|-------|
| Cluster tier | M0 (Free) |
| Storage | 512 MB |
| Connections | Up to 500 |

No auto-sleep — always available.

---

## 15. Common Errors & Fixes {#common-errors}

### Backend errors

**`MongooseServerSelectionError: Could not connect to any servers`**  
→ Check MONGODB_URI is correct in .env  
→ Check MongoDB Atlas Network Access allows 0.0.0.0/0  
→ Check database user password is correct in connection string  

**`Error: secretOrPrivateKey must have a value`**  
→ JWT_SECRET is not set in .env  
→ Make sure .env file exists and has JWT_SECRET=  

**`Cross-Origin Request Blocked`**  
→ CLIENT_URL in server .env doesn't match the frontend URL exactly  
→ Check for trailing slash — `http://localhost:3000` not `http://localhost:3000/`  

**`Cannot GET /`**  
→ Server is not running — run `npm run dev` in server folder  

---

### Frontend errors

**`WebSocket connection failed`**  
→ Backend server is not running  
→ REACT_APP_SERVER_URL in client .env is wrong  
→ After changing .env, restart `npm start`  

**`Cannot read properties of undefined (reading 'username')`**  
→ User not logged in but accessing protected component  
→ Clear localStorage and try again: `localStorage.clear()`  

**`Module not found: Can't resolve 'socket.io-client'`**  
→ Run `npm install` in the client folder  

**`NotAllowedError: Permission denied` (video call)**  
→ Browser blocked camera/microphone  
→ Click the lock icon in address bar → Allow camera and microphone  

**`.env variables not loading (show as undefined)`**  
→ Variable must start with `REACT_APP_`  
→ Restart `npm start` after changing .env  

---

### Deployment errors

**Render build fails: `Cannot find module`**  
→ Root directory is wrong — must be `server`  
→ Check that server/package.json exists  

**Vercel build fails: `Module not found`**  
→ Root directory is wrong — must be `client`  
→ Run `npm install` locally and check client/package.json  

**App loads but login fails (production)**  
→ `REACT_APP_SERVER_URL` in Vercel points to wrong backend URL  
→ `CLIENT_URL` in Render doesn't match Vercel URL  

---

## 16. Glossary {#glossary}

| Term | Meaning |
|------|---------|
| **WebSocket** | A persistent two-way connection between browser and server. Unlike HTTP (request/response), WebSocket keeps the connection open so the server can push data instantly. |
| **Socket.IO** | A library that wraps WebSockets and adds features like rooms, reconnection, and fallback to HTTP polling. |
| **REST API** | Standard HTTP endpoints (POST, GET, etc.) used for things like login and register that don't need real-time. |
| **JWT** | JSON Web Token. A signed string that proves who you are. Stored in localStorage, sent with requests. |
| **bcrypt** | A hashing algorithm for passwords. Converts "mypassword" into "$$2b$10$xxxx...". Can never be reversed. |
| **WebRTC** | Web Real-Time Communication. Browser API for direct peer-to-peer audio/video without a server. |
| **STUN** | A server that helps devices discover their public IP address (needed for WebRTC). Google provides one free. |
| **TURN** | A relay server for WebRTC when direct connections fail. Metered.ca provides 50GB/month free. |
| **ICE** | Interactive Connectivity Establishment. The process WebRTC uses to find the best network path between peers. |
| **Peer connection** | The direct WebRTC connection between two browsers. |
| **Mongoose** | A Node.js library that makes it easy to define schemas and query MongoDB. |
| **Schema** | The structure/shape of a database record. Like a template. |
| **Context API** | React's built-in system for sharing state (like login info) across all components without passing props. |
| **Lazy loading** | Only loading a component's code when it's actually needed, instead of all upfront. |
| **CORS** | Cross-Origin Resource Sharing. A security rule that controls which domains can call your API. |
| **Environment variable** | A setting stored outside your code (in .env file) so secrets don't end up in GitHub. |
| **Polling** | A fallback transport where Socket.IO sends regular HTTP requests instead of a persistent WebSocket. Works on more networks. |
| **ICE candidate** | A possible network path (IP address + port) that WebRTC tries to use for the direct connection. |

---

*FamilyChat Developer Guide — JavaScript, built with love*  
*GitHub → Vercel + Render → $0/month*
