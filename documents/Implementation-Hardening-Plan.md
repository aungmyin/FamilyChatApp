# FamilyChat — Implementation Hardening Plan
### Corrections to apply before building the app

**Purpose:** Keep the original phase guides useful while closing the security, reliability, WebRTC, and deployment gaps that would matter in a real family chat app.

---

## How to Use This Document

Read this before starting Phase 2. The phase docs are a good learning roadmap, but their code snippets should be treated as starter examples. The items below should be folded into the implementation as you build.

Recommended priority:

1. Apply **Required Before MVP** changes before any live deployment.
2. Add **Strongly Recommended** changes before family members depend on the app.
3. Treat **Later Enhancements** as the post-MVP backlog.

---

## Required Before MVP

### 1. Authenticate Socket.IO Connections

The current docs create JWTs during login, but Socket.IO events trust client-provided values like `username`, `author`, and `room`. That allows impersonation from a modified browser client.

Update the server so every socket authenticates with the JWT during connection:

```javascript
const jwt = require("jsonwebtoken");

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = {
      id: user.id,
      username: user.username,
    };

    next();
  } catch {
    next(new Error("Invalid token"));
  }
});
```

Update the client socket connection:

```javascript
const socket = io(process.env.REACT_APP_SERVER_URL, {
  auth: { token: localStorage.getItem("token") },
  reconnection: true,
  transports: ["websocket", "polling"],
});
```

After this, the server should derive `author` and `authorId` from `socket.data.user`, not from client payloads.

---

### 2. Make Registration Invite-Only

This is a private family app, so open registration is the wrong default. Add an invite code requirement or an admin-created allowlist.

Simple MVP option:

```env
FAMILY_INVITE_CODE=change_this_private_code
```

Register endpoint expectation:

```json
{
  "username": "Mum",
  "email": "mum@example.com",
  "password": "secretpassword",
  "inviteCode": "family-code"
}
```

Server rule:

```javascript
if (inviteCode !== process.env.FAMILY_INVITE_CODE) {
  return res.status(403).json({ error: "Invalid invite code" });
}
```

Later, replace the shared code with per-user invite links.

---

### 3. Validate and Limit All Inputs

Add server-side checks before saving users or messages.

Minimum rules:

| Field | Rule |
|---|---|
| `username` | 2-30 characters, trim whitespace |
| `email` | Normalize lowercase and validate format |
| `password` | Minimum 8 characters |
| `room` | Must be one of the configured rooms |
| `message` | 1-2000 characters after trim |

Recommended packages:

```bash
cd server
npm install express-rate-limit helmet validator
```

Also add basic security middleware:

```javascript
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

app.use(helmet());

app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
}));
```

---

### 4. Fix Room Membership

The Phase 3 client emits `join_room` both inside `switchRoom()` and in the `useEffect`, and the server does not explicitly leave the previous room. That can leave one socket joined to multiple rooms.

Server-side rule:

```javascript
socket.on("join_room", async ({ room }) => {
  if (!ROOMS.includes(room)) return;

  if (socket.data.room) {
    socket.leave(socket.data.room);
  }

  socket.join(room);
  socket.data.room = room;
});
```

Client-side rule:

- `switchRoom(newRoom)` should only call `setRoom(newRoom)`.
- The `useEffect([room])` should be the single place that emits `join_room`.

---

### 5. Add Message IDs and Delivery Acknowledgements

The current offline queue is memory-only and can duplicate messages on reconnect. Add a client-generated `clientMessageId` and acknowledge saved messages from the server.

Client payload:

```javascript
const data = {
  clientMessageId: crypto.randomUUID(),
  room,
  message: message.trim(),
};
```

Message schema addition:

```javascript
clientMessageId: { type: String, index: true },
authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
```

Server behavior:

- Ignore duplicate `clientMessageId` values for the same `authorId`.
- Save the message with the authenticated user identity.
- Emit `message_ack` to the sender.
- Broadcast `receive_message` to the room.

---

### 6. Persist the Offline Queue

For MVP, use `localStorage`. For a stronger version, use IndexedDB.

Minimum behavior:

- Save pending messages locally as soon as the user sends while offline.
- Restore pending messages after refresh.
- Remove a pending message only after `message_ack`.
- Keep a visible pending/failed state.

This prevents losing messages when the browser refreshes during a bad connection.

---

## Strongly Recommended

### 7. Track Online Users for Calls

The Phase 4 docs use a placeholder target like `family-member-socket-id`. Real calls need an online user list.

Server data structure:

```javascript
const onlineUsers = new Map(); // userId -> { socketId, username }
```

On socket connect:

- Add the authenticated user to `onlineUsers`.
- Emit `online_users` to relevant rooms.

On disconnect:

- Remove the user.
- Emit the updated list.

Client UI:

- Show online family members.
- Put a call button beside each online user.
- Use the selected user socket ID as the WebRTC signaling target.

---

### 8. Add Proper Call States

The WebRTC component should support:

- Incoming call prompt with Accept and Decline.
- Cancel outgoing call.
- Busy state if the target is already in a call.
- Timeout if unanswered.
- Cleanup on disconnect or navigation.

Socket events to add:

| Event | Purpose |
|---|---|
| `call_request` | Caller asks receiver to start a call |
| `call_accept` | Receiver accepts |
| `call_decline` | Receiver declines |
| `call_busy` | Receiver is unavailable |
| `call_cancel` | Caller cancels before answer |

Then use `call_offer`, `call_answer`, and `ice_candidate` only after both sides agree to connect.

---

### 9. Configure TURN Before Family Testing

STUN-only calls often work on home WiFi, but mobile networks and strict NATs can fail. Add TURN credentials before asking family members to test video calls.

Store TURN config in environment variables:

```env
REACT_APP_TURN_URL=turn:relay.example.com:443
REACT_APP_TURN_USERNAME=your_username
REACT_APP_TURN_CREDENTIAL=your_credential
```

Do not hard-code TURN credentials in committed source.

---

### 10. Replace Create React App with Vite

Create React App is deprecated. Use Vite for the frontend unless you deliberately choose a framework like Next.js.

Updated Phase 3 setup:

```bash
cd client
npm create vite@latest . -- --template react
npm install
npm install socket.io-client axios react-router-dom
```

Environment variable names change from `REACT_APP_*` to `VITE_*`:

```env
VITE_SERVER_URL=http://localhost:3001
```

Client code then reads:

```javascript
import.meta.env.VITE_SERVER_URL
```

If the project stays on Create React App for learning simplicity, keep the current `REACT_APP_SERVER_URL` docs, but document that this is a legacy choice.

---

### 11. Clarify Free-Tier Limits

The deployment docs should avoid promising production-grade reliability at $0/month.

Add this expectation to Phase 6:

- Render Free web services can spin down after 15 minutes without inbound traffic.
- Spin-up can take around one minute.
- Free services may restart and have monthly limits.
- MongoDB Atlas M0 has storage, throughput, transfer, and idle-cluster limits.
- Vercel Hobby is for personal/non-commercial use.
- UptimeRobot can reduce cold starts but does not turn free infrastructure into production infrastructure.

For a family app, this is usually acceptable. Just make the tradeoff explicit.

---

## Later Enhancements

### Admin Controls

Add an admin role that can:

- Disable registration.
- Invite users.
- Remove users.
- Manage rooms.
- Reset invite codes.

### Message Features

Good next additions:

- Edit/delete own messages.
- Read receipts.
- Reactions.
- Image attachments using object storage.
- Search.

### Privacy and Safety

Consider:

- Password reset flow.
- Account lockout after repeated failed login attempts.
- Refresh tokens or shorter-lived access tokens.
- HTTPS-only cookies if you move away from localStorage.
- Basic audit logs for login and user management.

### Testing

Add tests around the risky paths:

- Auth register/login validation.
- Socket auth rejection.
- Room authorization.
- Message deduplication.
- Offline queue ack behavior.
- WebRTC call state transitions.

---

## Revised MVP Definition

The MVP should include:

- Invite-only registration.
- JWT-authenticated HTTP and Socket.IO flows.
- Three fixed rooms: `general`, `family`, `random`.
- Real-time messages with authenticated authors.
- Message pagination.
- Typing indicators.
- Connection status.
- Persistent offline queue with acknowledgements.
- Online user list.
- One-to-one video calls between online users.
- TURN-ready WebRTC configuration.
- Vite frontend.
- Render/Vercel/MongoDB deployment notes with clear free-tier caveats.

Anything beyond that can wait until the family is using the core chat reliably.
