# Phase 4 — Voice & Video Calls
### FamilyChat Engineering Guide

**Duration:** Weeks 6–8  
**Goal:** Add WebRTC-powered voice and video calls with automatic quality switching based on real-time connection speed.

---

## How WebRTC Works

WebRTC creates a **direct connection between two devices** — video never goes through your server.

```
Step 1: User A sends "call offer" via Socket.IO server
Step 2: User B receives offer, sends "answer" back via Socket.IO
Step 3: Both exchange ICE candidates (network paths)
Step 4: Direct peer connection established
Step 5: Video/audio streams directly between devices
        (does NOT go through your server — no bandwidth cost)
```

### ICE Servers (STUN/TURN)

| Server | Purpose | Cost |
|--------|---------|------|
| STUN | Helps devices discover their public IP | Free (Google) |
| TURN | Relay server fallback for strict networks | Free (Metered.ca, 50GB/month) |

TURN is only needed when a direct connection fails (rare on home WiFi).

---

## Folder Structure for This Phase

```
client/src/
├── hooks/
│   └── useConnectionQuality.js    ← network speed detection
└── components/
    └── VideoCall.jsx              ← voice + video call component
```

---

## Step 1 — Create Connection Quality Hook

This hook measures internet speed every 30 seconds and returns `low`, `medium`, or `high`.

### client/src/hooks/useConnectionQuality.js

```javascript
import { useState, useEffect, useRef } from "react";

export default function useConnectionQuality() {
  const [quality, setQuality] = useState("low"); // default to low for safety
  const [speed, setSpeed]     = useState(null);
  const intervalRef           = useRef(null);

  const measureSpeed = async () => {
    try {
      // Download a tiny file and time it
      const start = Date.now();
      await fetch("https://www.google.com/favicon.ico?nocache=" + start, {
        cache: "no-store",
      });
      const durationSec = (Date.now() - start) / 1000;
      const speedKbps   = 1 / durationSec; // file is ~1KB

      setSpeed(Math.round(speedKbps));

      // Set quality based on measured speed
      if      (speedKbps < 50)  setQuality("low");    // 2G / very slow WiFi
      else if (speedKbps < 200) setQuality("medium");  // 3G / normal WiFi
      else                      setQuality("high");    // 4G / fast WiFi
    } catch {
      // If speed test fails, stay on low (safest option)
      setQuality("low");
    }
  };

  useEffect(() => {
    // Also use browser's built-in Network Information API if available
    const nav = navigator.connection;
    if (nav) {
      const fromBrowser = () => {
        if      (["slow-2g", "2g"].includes(nav.effectiveType)) setQuality("low");
        else if (nav.effectiveType === "3g")                    setQuality("medium");
        else                                                    setQuality("high");
      };
      fromBrowser();
      nav.addEventListener("change", fromBrowser);
    }

    // Measure immediately, then every 30 seconds
    measureSpeed();
    intervalRef.current = setInterval(measureSpeed, 30000);

    return () => {
      clearInterval(intervalRef.current);
      if (navigator.connection)
        navigator.connection.removeEventListener("change", () => {});
    };
  }, []);

  return { quality, speed };
}
```

### Quality thresholds

| Speed | Quality | Video resolution | Frame rate |
|-------|---------|-----------------|------------|
| < 50 KB/s | Low | 320 × 240 | 10 fps |
| 50–200 KB/s | Medium | 640 × 480 | 20 fps |
| > 200 KB/s | High | 1280 × 720 | 30 fps |

---

## Step 2 — Create Video Call Component

### client/src/components/VideoCall.jsx

```javascript
import { useEffect, useRef, useState } from "react";
import useConnectionQuality from "../hooks/useConnectionQuality";

// Video quality presets for different connection speeds
const VIDEO_CONSTRAINTS = {
  low:    { width: 320,  height: 240,  frameRate: 10 },
  medium: { width: 640,  height: 480,  frameRate: 20 },
  high:   { width: 1280, height: 720,  frameRate: 30 },
};

const QUALITY_LABELS = {
  low:    "Low",
  medium: "Medium",
  high:   "High",
};

const QUALITY_COLORS = {
  low:    "#e74c3c",
  medium: "#f39c12",
  high:   "#27ae60",
};

// ICE servers for WebRTC
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Optional: add Metered.ca TURN for difficult networks
  // { urls: "turn:relay.metered.ca:80", username: "YOUR_USERNAME", credential: "YOUR_CREDENTIAL" }
];

export default function VideoCall({ socket, targetUser, onEnd }) {
  const { quality, speed }            = useConnectionQuality();
  const [activeQuality, setActiveQuality] = useState("low");
  const [callStatus, setCallStatus]       = useState("idle");
  const [notification, setNotification]   = useState("");
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef        = useRef(null);
  const streamRef      = useRef(null);

  // ── Auto-switch quality when connection speed changes ──────
  useEffect(() => {
    if (callStatus === "in-call" && quality !== activeQuality) {
      switchQuality(quality);
    }
  }, [quality]);

  // ── Get camera/microphone stream at given quality ──────────
  const getStream = async (q) =>
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: VIDEO_CONSTRAINTS[q],
    });

  // ── Switch video quality mid-call (no interruption) ────────
  const switchQuality = async (newQuality) => {
    if (!peerRef.current || !streamRef.current) return;

    try {
      // Stop old video track
      streamRef.current.getVideoTracks().forEach(t => t.stop());

      // Get new stream at new quality
      const newStream = await getStream(newQuality);
      streamRef.current = newStream;

      // Update local video preview
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

      // Replace video track in the peer connection
      // This swaps quality WITHOUT dropping the call
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = peerRef.current
        .getSenders()
        .find(s => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newVideoTrack);

      setActiveQuality(newQuality);

      // Show brief notification
      setNotification(`Video quality switched to ${QUALITY_LABELS[newQuality]}`);
      setTimeout(() => setNotification(""), 3000);
    } catch (err) {
      console.error("Quality switch failed:", err);
    }
  };

  // ── Create WebRTC peer connection ──────────────────────────
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    // Play incoming video/audio from the other person
    pc.ontrack = (e) => {
      if (remoteVideoRef.current)
        remoteVideoRef.current.srcObject = e.streams[0];
    };

    // Send ICE candidates to the other person via Socket.IO
    pc.onicecandidate = (e) => {
      if (e.candidate)
        socket.emit("ice_candidate", { to: targetUser, candidate: e.candidate });
    };

    return pc;
  };

  // ── Handle incoming call ───────────────────────────────────
  useEffect(() => {
    socket.on("call_offer", async ({ from, offer }) => {
      setCallStatus("receiving");

      const stream = await getStream(quality);
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call_answer", { to: from, answer });
      setCallStatus("in-call");
      setActiveQuality(quality);
    });

    socket.on("call_answer", async ({ answer }) => {
      await peerRef.current?.setRemoteDescription(answer);
      setCallStatus("in-call");
    });

    socket.on("ice_candidate", async ({ candidate }) => {
      try {
        await peerRef.current?.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    });

    socket.on("call_ended", endCall);

    return () => {
      socket.off("call_offer");
      socket.off("call_answer");
      socket.off("ice_candidate");
      socket.off("call_ended");
    };
  }, [quality]);

  // ── Start a call ───────────────────────────────────────────
  const startCall = async () => {
    try {
      setCallStatus("calling");

      const stream = await getStream(quality);
      streamRef.current = stream;
      setActiveQuality(quality);

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call_offer", { to: targetUser, offer });
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallStatus("idle");
      alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  // ── End the call ───────────────────────────────────────────
  const endCall = () => {
    peerRef.current?.close();
    peerRef.current = null;

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    socket.emit("end_call", { to: targetUser });
    setCallStatus("idle");
    onEnd?.();
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div>

      {/* Quality badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, padding: "3px 10px", borderRadius: 20, marginBottom: 8,
        background: QUALITY_COLORS[quality], color: "white",
      }}>
        ● {QUALITY_LABELS[quality]} quality
        {speed && ` (${speed} KB/s)`}
      </div>

      {/* Auto-switch notification toast */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: "#2c3e50", color: "white",
          padding: "12px 20px", borderRadius: 8, fontSize: 13,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          🔄 {notification}
        </div>
      )}

      {/* Video windows — shown during call */}
      {callStatus !== "idle" && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          background: "#000", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {/* Remote video (large) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: 340, display: "block" }}
          />

          {/* Your own video (small, corner) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: 110, position: "absolute",
              bottom: 12, right: 12, borderRadius: 8,
              border: "2px solid rgba(255,255,255,0.3)",
            }}
          />

          {/* Quality badge on video */}
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.6)", color: "white",
            fontSize: 11, padding: "2px 10px", borderRadius: 20,
          }}>
            {QUALITY_LABELS[activeQuality]}
          </div>

          {/* End call button */}
          <button onClick={endCall} style={{
            position: "absolute", bottom: 12, left: "50%",
            transform: "translateX(-50%)",
            background: "#e74c3c", color: "white",
            border: "none", borderRadius: 24,
            padding: "8px 20px", cursor: "pointer", fontSize: 13,
          }}>
            📵 End Call
          </button>
        </div>
      )}

      {/* Call controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {callStatus === "idle" && (
          <button onClick={startCall} style={{
            background: "#27ae60", color: "white", border: "none",
            padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 13,
          }}>
            📹 Video Call
          </button>
        )}
        {callStatus === "calling" && (
          <div style={{ fontSize: 13, color: "#888" }}>
            Calling {targetUser}...
            <button onClick={endCall} style={{
              marginLeft: 10, background: "#e74c3c", color: "white",
              border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer",
            }}>Cancel</button>
          </div>
        )}
        {callStatus === "receiving" && (
          <div style={{ fontSize: 13, color: "#888" }}>Connecting...</div>
        )}
      </div>

    </div>
  );
}
```

---

## Step 3 — Add VideoCall to ChatRoom

In `ChatRoom.jsx`, import and add VideoCall. Add these changes:

```javascript
// At the top of ChatRoom.jsx, add import
import VideoCall from "./VideoCall";

// Add this state inside the ChatRoom component
const [callTarget, setCallTarget] = useState(null);

// Add this in the online users section or next to the send button
<VideoCall
  socket={socket}
  targetUser={callTarget || "family-member-socket-id"}
  onEnd={() => setCallTarget(null)}
/>
```

> For a full group chat, you would store a list of online users with their socket IDs and show a call button next to each name. This can be added in a later iteration.

---

## Step 4 — Get a Free TURN Server (Optional)

If family members on mobile data have trouble connecting, add a TURN server.

1. Go to **metered.ca**
2. Sign up free (50 GB/month)
3. Dashboard → TURN Server Credentials
4. Copy your username and credential
5. Update `ICE_SERVERS` in VideoCall.jsx:

```javascript
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls:       "turn:relay.metered.ca:80",
    username:   "your_username_from_metered",
    credential: "your_credential_from_metered",
  },
  {
    urls:       "turn:relay.metered.ca:443",
    username:   "your_username_from_metered",
    credential: "your_credential_from_metered",
  },
];
```

---

## How Auto-Quality Switching Works

```
Call starts
     ↓
Detect speed → start at correct quality (low/medium/high)
     ↓
Every 30 seconds: re-measure speed
     ↓
Speed dropped? → call switchQuality("low")
     ↓
RTCRtpSender.replaceTrack() swaps video resolution
     ↓
Call continues — no interruption, no reconnection needed
     ↓
Speed improved? → call switchQuality("high")
     ↓
Small toast notification: "Video quality switched to High"
```

---

## Testing Voice & Video

1. Open the app in two different browsers (Chrome + Firefox, or two computers)
2. Log in with two different accounts
3. Click "Video Call"
4. Allow camera and microphone access when browser asks
5. Video should appear in both browsers

### Common issues

| Problem | Solution |
|---------|---------|
| Camera permission denied | Click the lock icon in browser address bar → Allow camera |
| No remote video | Check firewall — try adding TURN server |
| Call drops immediately | Check CORS settings in server, check ICE servers |
| Black video | Camera may be in use by another app |

---

## Phase 4 Checklist

- [ ] `useConnectionQuality.js` hook created
- [ ] `VideoCall.jsx` component created
- [ ] Auto-quality switching working (check speed badge changes)
- [ ] Video call connects between two browsers
- [ ] Audio works both ways
- [ ] Notification shows when quality switches
- [ ] End call button works and cleans up stream
- [ ] (Optional) Metered.ca TURN server added

---

## Push to GitHub

```bash
cd ..  # root family-chat folder
git add .
git commit -m "Phase 4: voice and video calls with auto quality"
git push origin main
```

---

## What's Next

Move to **Phase 5 — Slow-Connection Optimisation** to finalise all performance tuning and verify everything works on weak networks.
