# Phase 3 — Frontend Core Chat UI
### FamilyChat Engineering Guide

**Duration:** Weeks 4–6  
**Goal:** Build the complete React frontend with login, registration, real-time chat rooms, typing indicators, offline message queue, and connection status.

---

## Folder Structure for This Phase

```
client/src/
├── App.jsx                     ← routes and layout
├── index.js                    ← React entry point
├── context/
│   └── AuthContext.jsx         ← login/logout state
└── components/
    ├── Login.jsx               ← login screen
    ├── Register.jsx            ← register screen
    └── ChatRoom.jsx            ← main chat interface
```

---

## Step 1 — Create React App

```bash
cd client
npx create-react-app .
npm install socket.io-client axios react-router-dom
```

### What each package does

| Package | Purpose |
|---------|---------|
| socket.io-client | Connect to Socket.IO server |
| axios | Make HTTP requests to the API |
| react-router-dom | Handle page navigation |

---

## Step 2 — Create Environment File

Create `client/.env`:

```
REACT_APP_SERVER_URL=http://localhost:3001
```

> In production (Phase 6), this will be updated to your Render backend URL.

---

## Step 3 — Create Auth Context

This stores the login state across all pages.

### client/src/context/AuthContext.jsx

```javascript
import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Load saved login from localStorage on app start
    const token    = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    return token ? { token, username } : null;
  });

  const login = (token, username) => {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setUser({ token, username });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## Step 4 — Create Register Page

### client/src/components/Register.jsx

```javascript
import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [form, setForm]   = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const { login }         = useAuth();
  const navigate          = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_SERVER_URL}/api/auth/register`,
        form
      );
      login(res.data.token, res.data.username);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  const inputStyle = {
    display: "block", width: "100%", margin: "10px 0",
    padding: 10, borderRadius: 6, border: "1px solid #ddd", fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24,
      boxShadow: "0 2px 12px rgba(0,0,0,0.1)", borderRadius: 10 }}>
      <h2 style={{ marginBottom: 4 }}>Create Account</h2>
      <p style={{ color: "#888", marginBottom: 20, fontSize: 14 }}>Join FamilyChat</p>

      {error && (
        <div style={{ background: "#fee", color: "#c00", padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          style={inputStyle}
          required
        />
        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={inputStyle}
          required
        />
        <button type="submit" style={{
          width: "100%", padding: 12, marginTop: 8,
          background: "#3498db", color: "white",
          border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15,
        }}>
          Create Account
        </button>
      </form>

      <p style={{ marginTop: 16, textAlign: "center", fontSize: 14 }}>
        Already have an account? <a href="/login" style={{ color: "#3498db" }}>Login</a>
      </p>
    </div>
  );
}
```

---

## Step 5 — Create Login Page

### client/src/components/Login.jsx

```javascript
import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [form, setForm]   = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const { login }         = useAuth();
  const navigate          = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_SERVER_URL}/api/auth/login`,
        form
      );
      login(res.data.token, res.data.username);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  const inputStyle = {
    display: "block", width: "100%", margin: "10px 0",
    padding: 10, borderRadius: 6, border: "1px solid #ddd", fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24,
      boxShadow: "0 2px 12px rgba(0,0,0,0.1)", borderRadius: 10 }}>
      <h2 style={{ marginBottom: 4 }}>Welcome Back</h2>
      <p style={{ color: "#888", marginBottom: 20, fontSize: 14 }}>Login to FamilyChat</p>

      {error && (
        <div style={{ background: "#fee", color: "#c00", padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={inputStyle}
          required
        />
        <button type="submit" style={{
          width: "100%", padding: 12, marginTop: 8,
          background: "#3498db", color: "white",
          border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15,
        }}>
          Login
        </button>
      </form>

      <p style={{ marginTop: 16, textAlign: "center", fontSize: 14 }}>
        No account yet? <a href="/register" style={{ color: "#3498db" }}>Register</a>
      </p>
    </div>
  );
}
```

---

## Step 6 — Create Chat Room

### client/src/components/ChatRoom.jsx

```javascript
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

// Connect to backend with slow-connection settings
const socket = io(process.env.REACT_APP_SERVER_URL, {
  reconnection:         true,
  reconnectionAttempts: 10,
  reconnectionDelay:    1000,
  reconnectionDelayMax: 10000,
  timeout:              20000,
  transports:           ["websocket", "polling"],
});

const ROOMS = ["general", "family", "random"];

export default function ChatRoom() {
  const { user, logout }        = useAuth();
  const [room, setRoom]         = useState("general");
  const [message, setMessage]   = useState("");
  const [messages, setMessages] = useState([]);
  const [typing, setTyping]     = useState("");
  const [status, setStatus]     = useState("connecting");
  const messagesEndRef          = useRef(null);
  const messageQueueRef         = useRef([]);   // offline message queue
  let typingTimer;

  // Status bar colours
  const statusConfig = {
    connected:    { bg: "#27ae60", text: "● Connected" },
    disconnected: { bg: "#e74c3c", text: "● Disconnected — reconnecting..." },
    reconnecting: { bg: "#f39c12", text: "● Reconnecting..." },
    connecting:   { bg: "#f39c12", text: "● Connecting..." },
    failed:       { bg: "#e74c3c", text: "● Connection failed — please refresh" },
  };

  useEffect(() => {
    // Join the default room
    socket.emit("join_room", { room, username: user.username });

    // Connection status events
    socket.on("connect",          ()  => setStatus("connected"));
    socket.on("disconnect",       ()  => setStatus("disconnected"));
    socket.on("reconnecting",     ()  => setStatus("reconnecting"));
    socket.on("reconnect_failed", ()  => setStatus("failed"));
    socket.on("reconnect", () => {
      setStatus("connected");
      // Flush queued messages when reconnected
      messageQueueRef.current.forEach(msg => socket.emit("send_message", msg));
      messageQueueRef.current = [];
    });

    // Message events
    socket.on("message_history",  (h) => setMessages(h));
    socket.on("older_messages",   (o) => setMessages(prev => [...o, ...prev]));
    socket.on("receive_message",  (d) => setMessages(prev => [...prev, d]));

    // Presence events
    socket.on("user_joined", ({ username }) =>
      setMessages(prev => [...prev, {
        system: true, message: `${username} joined the chat`, time: new Date()
      }])
    );
    socket.on("user_left", ({ username }) =>
      setMessages(prev => [...prev, {
        system: true, message: `${username} left the chat`, time: new Date()
      }])
    );

    // Typing indicator
    socket.on("user_typing",      (u) => setTyping(`${u} is typing...`));
    socket.on("user_stop_typing", ()  => setTyping(""));

    return () => {
      socket.off("connect");       socket.off("disconnect");
      socket.off("reconnecting");  socket.off("reconnect");
      socket.off("reconnect_failed");
      socket.off("message_history"); socket.off("older_messages");
      socket.off("receive_message"); socket.off("user_joined");
      socket.off("user_left");     socket.off("user_typing");
      socket.off("user_stop_typing");
    };
  }, [room]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const switchRoom = (newRoom) => {
    socket.emit("join_room", { room: newRoom, username: user.username });
    setRoom(newRoom);
    setMessages([]);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    const data = { room, author: user.username, message, time: new Date() };

    if (socket.connected) {
      socket.emit("send_message", data);
    } else {
      // Save to queue — will send when reconnected
      messageQueueRef.current.push(data);
      setMessages(prev => [...prev, { ...data, pending: true }]);
    }

    setMessage("");
    socket.emit("stop_typing", { room });
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", { room, username: user.username });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit("stop_typing", { room }), 1500);
  };

  // Load older messages when user scrolls to top
  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && messages.length > 0) {
      socket.emit("load_more", { room, before: messages[0].time });
    }
  };

  const s = statusConfig[status] || statusConfig.connecting;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 230, background: "#1a1a2e", color: "white",
        padding: 20, display: "flex", flexDirection: "column",
      }}>
        <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 4 }}>FamilyChat</div>
        <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 24 }}>Hi, {user.username}!</div>

        <div style={{ fontSize: 11, opacity: 0.4, letterSpacing: 1, marginBottom: 8 }}>ROOMS</div>
        {ROOMS.map(r => (
          <div key={r} onClick={() => switchRoom(r)} style={{
            padding: "9px 12px", cursor: "pointer", borderRadius: 6,
            background: room === r ? "#3498db" : "transparent",
            marginBottom: 4, fontSize: 14, transition: "background .15s",
          }}>
            # {r}
          </div>
        ))}

        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{
          background: "#e74c3c", color: "white", border: "none",
          padding: "9px 16px", cursor: "pointer", borderRadius: 6, fontSize: 14,
        }}>
          Logout
        </button>
      </div>

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Connection status bar */}
        <div style={{ background: s.bg, color: "white", padding: "5px 20px", fontSize: 12 }}>
          {s.text}
        </div>

        {/* Room header */}
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid #eee",
          background: "#fff", fontWeight: "bold",
        }}>
          # {room}
        </div>

        {/* Messages list */}
        <div
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#fafafa" }}
        >
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              {msg.system ? (
                <div style={{ textAlign: "center", color: "#bbb", fontSize: 12, padding: "4px 0" }}>
                  {msg.message}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontWeight: "bold", fontSize: 14,
                      color: msg.author === user.username ? "#3498db" : "#2c3e50",
                    }}>
                      {msg.author}
                    </span>
                    <span style={{ fontSize: 11, color: "#bbb" }}>
                      {new Date(msg.time).toLocaleTimeString()}
                    </span>
                    {msg.pending && (
                      <span style={{ fontSize: 11, color: "#f39c12" }}>⏳ sending...</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, opacity: msg.pending ? 0.5 : 1, lineHeight: 1.5 }}>
                    {msg.message}
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typing && (
          <div style={{ padding: "3px 20px", color: "#aaa", fontSize: 12, background: "#fafafa" }}>
            {typing}
          </div>
        )}

        {/* Message input */}
        <div style={{
          padding: 16, borderTop: "1px solid #eee",
          display: "flex", gap: 10, background: "#fff",
        }}>
          <input
            value={message}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message #${room}  (Enter to send)`}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 6,
              border: "1px solid #ddd", fontSize: 14, outline: "none",
            }}
          />
          <button onClick={sendMessage} style={{
            padding: "10px 22px", background: "#3498db", color: "white",
            border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14,
          }}>
            Send
          </button>
        </div>

      </div>
    </div>
  );
}
```

---

## Step 7 — Create App.jsx

### client/src/App.jsx

```javascript
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login    from "./components/Login";
import Register from "./components/Register";

// Lazy load ChatRoom — only loads when user visits /chat
// This makes initial page load faster on slow connections
const ChatRoom = lazy(() => import("./components/ChatRoom"));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/chat"     element={
            <PrivateRoute>
              <Suspense fallback={
                <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
                  Loading chat...
                </div>
              }>
                <ChatRoom />
              </Suspense>
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

## Step 8 — Test the Full App Locally

```bash
# Terminal 1 — start backend
cd server && npm run dev

# Terminal 2 — start frontend
cd client && npm start
```

1. Open **http://localhost:3000**
2. Register an account
3. Open a second browser tab → register another account
4. Both should chat in real time
5. Test typing indicator — start typing in one tab, see it in the other
6. Test reconnection — stop the server, try to send a message, restart the server

---

## Key Features Implemented

| Feature | How it works |
|---|---|
| Login state | Saved in localStorage, loaded on refresh |
| Protected routes | PrivateRoute redirects to /login if not logged in |
| Room switching | Emits join_room, clears messages, loads new history |
| Typing indicator | Emits typing, clears after 1.5s of no keypress |
| Offline queue | Messages saved when disconnected, sent on reconnect |
| Pending message UI | Faded with ⏳ icon until server confirms |
| Auto-scroll | scrollIntoView on every new message |
| Load older messages | Triggered by scrolling to top |
| Connection status bar | Green/yellow/red bar at top of screen |
| Lazy loading | ChatRoom loads only when needed |

---

## Phase 3 Checklist

- [ ] React app created with all packages installed
- [ ] `client/.env` created with server URL
- [ ] `AuthContext.jsx` created
- [ ] `Register.jsx` created and working
- [ ] `Login.jsx` created and working
- [ ] `ChatRoom.jsx` created with all features
- [ ] `App.jsx` updated with routes and lazy loading
- [ ] Two browser tabs can chat in real time
- [ ] Typing indicator works
- [ ] Connection status bar shows green when connected

---

## Push to GitHub

```bash
cd ..  # root family-chat folder
git add .
git commit -m "Phase 3: frontend chat UI complete"
git push origin main
```

---

## What's Next

Move to **Phase 4 — Voice & Video Calls** to add WebRTC-powered calls with automatic quality switching.
