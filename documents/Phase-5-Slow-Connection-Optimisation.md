# Phase 5 — Slow-Connection Optimisation
### FamilyChat Engineering Guide

**Duration:** Weeks 8–10  
**Goal:** Verify and finalise all optimisations so the app works reliably on 2G, slow WiFi, and unstable mobile connections.

---

## Overview

Most of the optimisations were already built in Phases 2–4. This phase is about:
1. Verifying all slow-connection features work correctly
2. Tuning settings for your family's specific network conditions
3. Final end-to-end testing on real devices

---

## Complete Optimisation Checklist

### Network Resilience

#### ✅ Socket.IO server settings (server/index.js)
```javascript
const io = new Server(server, {
  pingTimeout:       60000,  // Wait 60s before considering connection dead
  pingInterval:      25000,  // Ping every 25s to keep connection alive
  transports:        ["websocket", "polling"], // Fall back to polling on bad networks
  upgradeTimeout:    30000,  // Give 30s for connection upgrade
  maxHttpBufferSize: 1e6,    // Limit message payload to 1MB
});
```

#### ✅ Socket.IO client settings (ChatRoom.jsx)
```javascript
const socket = io(process.env.REACT_APP_SERVER_URL, {
  reconnection:         true,   // Auto-reconnect
  reconnectionAttempts: 10,     // Try 10 times before giving up
  reconnectionDelay:    1000,   // Start with 1s wait
  reconnectionDelayMax: 10000,  // Max wait 10s between retries
  timeout:              20000,  // Connection timeout 20s
  transports:           ["websocket", "polling"],
});
```

#### ✅ Connection status bar
Visible at top of chat. Changes color based on state:
- 🟢 Green = Connected
- 🟡 Yellow = Reconnecting / Connecting
- 🔴 Red = Disconnected or Failed

#### ✅ Offline message queue
```javascript
if (socket.connected) {
  socket.emit("send_message", data);
} else {
  // Save message locally
  messageQueueRef.current.push(data);
  // Show in UI as "pending"
  setMessages(prev => [...prev, { ...data, pending: true }]);
}

// When reconnected, flush queue
socket.on("reconnect", () => {
  messageQueueRef.current.forEach(msg => socket.emit("send_message", msg));
  messageQueueRef.current = [];
});
```

---

### Performance (Fast Load Times)

#### ✅ Lazy loading (App.jsx)
```javascript
const ChatRoom = lazy(() => import("./components/ChatRoom"));
const VideoCall = lazy(() => import("./components/VideoCall"));
```
These components only load when the user navigates to them, reducing initial bundle size.

#### ✅ Paginated messages (server/index.js + ChatRoom.jsx)
```javascript
// Server: load only 20 messages on join
const history = await Message.find({ room })
  .sort({ time: -1 })
  .limit(20);

// Server: load 20 more on demand
socket.on("load_more", async ({ room, before }) => {
  const older = await Message.find({
    room,
    time: { $lt: new Date(before) },
  }).sort({ time: -1 }).limit(20);
  socket.emit("older_messages", older.reverse());
});

// Client: detect scroll to top
const handleScroll = (e) => {
  if (e.target.scrollTop === 0 && messages.length > 0) {
    socket.emit("load_more", { room, before: messages[0].time });
  }
};
```

---

### Video Quality Adaptation

#### ✅ Quality presets
```javascript
const VIDEO_CONSTRAINTS = {
  low:    { width: 320,  height: 240,  frameRate: 10 }, // ~50–150 KB/s
  medium: { width: 640,  height: 480,  frameRate: 20 }, // ~150–400 KB/s
  high:   { width: 1280, height: 720,  frameRate: 30 }, // ~400KB/s+
};
```

#### ✅ Auto-detect on call start
```javascript
// useConnectionQuality hook measures speed before call starts
// Automatically picks the right quality preset
const { quality, speed } = useConnectionQuality();
const stream = await getStream(quality); // uses correct preset
```

#### ✅ Auto-switch during call (no interruption)
```javascript
// RTCRtpSender.replaceTrack() swaps video quality mid-call
const sender = peerRef.current.getSenders().find(s => s.track?.kind === "video");
if (sender) await sender.replaceTrack(newVideoTrack);
// Call continues without renegotiation or interruption
```

---

## Tuning for Your Family's Network

If family members are on particularly slow connections, adjust these settings:

### Lower message page size
```javascript
// server/index.js — change .limit(20) to .limit(10)
const history = await Message.find({ room })
  .sort({ time: -1 })
  .limit(10); // Load fewer messages = faster
```

### Lower reconnection delay
```javascript
// ChatRoom.jsx — try reconnecting faster
reconnectionDelay:    500,   // Start trying after 0.5s
reconnectionDelayMax: 5000,  // Max 5s between retries
```

### Lower video quality thresholds
```javascript
// useConnectionQuality.js — be more conservative
if      (speedKbps < 100) setQuality("low");    // was 50
else if (speedKbps < 300) setQuality("medium");  // was 200
else                      setQuality("high");
```

---

## Testing on Slow Connections

### Method 1 — Chrome DevTools throttling (easiest)

1. Open the app in Chrome
2. Press F12 → open DevTools
3. Click the **Network** tab
4. Click the throttle dropdown (says "No throttling")
5. Select **"Slow 3G"** or **"Fast 3G"**
6. Test the app — it simulates a slow mobile connection

### Method 2 — Test on real family devices

The most reliable test. On the slowest device your family uses:
- Send messages
- Disconnect WiFi, send a message, reconnect WiFi → message should send
- Start a video call → quality badge should show "Low" or "Medium"

### Method 3 — Simulate disconnection

1. Start the backend server
2. Open the app → connect
3. Stop the server (`Ctrl+C` in terminal)
4. App should show "Disconnected — reconnecting..."
5. Try sending a message → should show ⏳ pending
6. Restart the server
7. App should reconnect and send the pending message

---

## Slow Connection Test Results Table

Use this to document your test results:

| Test | Expected result | Pass/Fail |
|------|----------------|-----------|
| Send message on 3G | Message delivers within 5s | |
| Send message while offline | Shows pending, sends on reconnect | |
| App loads on slow WiFi | Login screen appears within 10s | |
| Video call on slow 3G | Starts at Low quality automatically | |
| Speed improves during call | Quality upgrades automatically | |
| Scroll to top in chat | Older messages load | |
| Browser refresh | User stays logged in | |
| Server restarts | App reconnects automatically | |

---

## Performance Summary

| Optimisation | Benefit |
|---|---|
| Load only 20 messages | 80% less data on first load |
| Lazy loading components | Faster initial page load |
| Socket.IO polling fallback | Works on networks that block WebSockets |
| 60s ping timeout | Tolerates brief network interruptions |
| 10 reconnection attempts | Recovers from temporary outages |
| Offline message queue | No lost messages during disconnection |
| Low video preset default | Works on 2G with ~50KB/s |
| replaceTrack() | Quality switches without call drop |

---

## Phase 5 Checklist

- [ ] Verified Socket.IO server settings are in `index.js`
- [ ] Verified client reconnection settings are in `ChatRoom.jsx`
- [ ] Connection status bar tested (shows red when server stops)
- [ ] Offline message queue tested (message queued and sent on reconnect)
- [ ] Chrome throttling test passed on Slow 3G
- [ ] Video call starts at Low quality on slow network
- [ ] Auto quality switch notification appears during call
- [ ] App tested on at least one real mobile device
- [ ] Older message loading works on scroll to top

---

## Push to GitHub

```bash
cd ..
git add .
git commit -m "Phase 5: slow-connection optimisation verified"
git push origin main
```

---

## What's Next

Move to **Phase 6 — Deployment & Go-Live** to deploy the app to the internet and share it with your family.
