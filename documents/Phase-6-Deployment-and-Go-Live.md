# Phase 6 — Deployment & Go-Live
### FamilyChat Engineering Guide

**Duration:** Weeks 10–14  
**Goal:** Deploy the application to the internet, keep it running 24/7, and get your family using it.

---

## Deployment Architecture

```
Your Family's Devices
        ↕  HTTPS
Vercel (frontend)          ← React app, auto-deployed from GitHub
        ↕  WebSocket / HTTPS
Render (backend)           ← Node.js server, auto-deployed from GitHub
        ↕
MongoDB Atlas (database)   ← Messages and users stored here

UptimeRobot                ← Pings Render every 5 min to prevent sleep
```

---

## Step 1 — Final Code Review Before Deploying

Before deploying, verify these files are correct:

### server/index.js — check CLIENT_URL is used in CORS
```javascript
app.use(cors({ origin: process.env.CLIENT_URL }));
// and
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ["GET", "POST"] },
  ...
});
```

### client/src/components/ChatRoom.jsx — check env variable
```javascript
const socket = io(process.env.REACT_APP_SERVER_URL, { ... });
```

### client/src/components/VideoCall.jsx — check env variable
```javascript
// All API calls use process.env.REACT_APP_SERVER_URL
```

---

## Step 2 — Push All Code to GitHub

```bash
cd family-chat
git add .
git commit -m "Phase 6: ready for deployment"
git push origin main
```

Verify on github.com that your latest code is there.

---

## Step 3 — Deploy Backend to Render

### 3.1 Create Web Service

1. Go to **render.com** → login
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect account"** if not already connected → authorize GitHub
4. Find and select your `family-chat` repository
5. Click **"Connect"**

### 3.2 Configure the Service

Fill in these settings:

| Setting | Value |
|---------|-------|
| Name | `familychat-server` |
| Region | Pick closest to your family |
| Branch | `main` |
| Root Directory | `server` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |

### 3.3 Add Environment Variables

Scroll down to **"Environment Variables"** section. Add these one by one:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | A long random string (at least 32 characters) |
| `CLIENT_URL` | `https://familychat.vercel.app` *(update after Vercel deploy)* |
| `PORT` | `3001` |

> **How to generate a good JWT_SECRET:**  
> Type random characters like: `xK9mP2vQ8nL5wR7tY3uA6hJ0bC4eF1gD`  
> Or use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3.4 Deploy

Click **"Create Web Service"**

Render will:
1. Pull your code from GitHub
2. Run `npm install`
3. Run `npm start`
4. Give you a live URL

**Your backend URL will be:**
```
https://familychat-server.onrender.com
```

Wait for the status to show **"Live"** (takes 2–5 minutes).

### 3.5 Verify Backend is Running

Open in your browser:
```
https://familychat-server.onrender.com
```

You should see:
```
FamilyChat server running ✅
```

---

## Step 4 — Deploy Frontend to Vercel

### 4.1 Create New Project

1. Go to **vercel.com** → login
2. Click **"Add New..."** → **"Project"**
3. Find and click **"Import"** next to `family-chat`

### 4.2 Configure the Project

| Setting | Value |
|---------|-------|
| Framework Preset | Create React App *(auto-detected)* |
| Root Directory | `client` |
| Build Command | `npm run build` *(auto-filled)* |
| Output Directory | `build` *(auto-filled)* |

### 4.3 Add Environment Variable

Expand **"Environment Variables"** section:

| Key | Value |
|-----|-------|
| `REACT_APP_SERVER_URL` | `https://familychat-server.onrender.com` |

### 4.4 Deploy

Click **"Deploy"**

Vercel will:
1. Pull your code from GitHub
2. Build the React app
3. Deploy to a global CDN

**Your frontend URL will be:**
```
https://familychat.vercel.app
```
*(or similar — Vercel auto-generates a name)*

---

## Step 5 — Connect Frontend and Backend

### 5.1 Update CLIENT_URL on Render

1. Go to Render → your `familychat-server` service
2. Click **"Environment"** tab
3. Update `CLIENT_URL` to your actual Vercel URL:
```
CLIENT_URL = https://familychat.vercel.app
```
4. Click **"Save Changes"**
5. Render automatically redeploys — wait 1–2 minutes

### 5.2 Test the Connection

1. Open your Vercel URL in a browser
2. Register a new account
3. You should see the chat room

If it fails, check:
- Is the Render service showing "Live" status?
- Is `CLIENT_URL` exactly matching your Vercel URL (no trailing slash)?
- Is `REACT_APP_SERVER_URL` in Vercel exactly matching your Render URL?

---

## Step 6 — Setup UptimeRobot (Keep Server Awake)

Render's free tier **sleeps** after 15 minutes with no traffic. First request after sleep takes ~30 seconds. UptimeRobot pings every 5 minutes to prevent this.

### 6.1 Configure monitor

1. Go to **uptimerobot.com** → login
2. Click **"Add New Monitor"**
3. Fill in:

| Field | Value |
|-------|-------|
| Monitor Type | HTTP(s) |
| Friendly Name | FamilyChat Server |
| URL | `https://familychat-server.onrender.com` |
| Monitoring Interval | Every 5 minutes |

4. Click **"Create Monitor"**

UptimeRobot will now ping your server every 5 minutes. The server stays awake and responds instantly for your family.

UptimeRobot also sends you an **email alert** if your server goes down — free.

---

## Step 7 — Test Everything on Real Devices

Test on the actual devices your family will use:

### Test checklist

| Test | How to test |
|------|------------|
| Register new account | Open Vercel URL → Register |
| Login | Logout → Login again |
| Send messages | Open in two browsers → chat |
| Typing indicator | Type in one browser → see indicator in other |
| Room switching | Click #family, #random |
| Video call | Two devices on same WiFi → start call |
| Mobile test | Open on phone → test chat and call |
| Slow network test | Use phone on 3G/4G → check video quality badge |
| Offline test | Turn off phone WiFi mid-chat → turn back on → check messages |

---

## Step 8 — Your Auto-Deploy Workflow

From now on, any code change is deployed automatically:

```bash
# Make your change
# ...edit files...

# Push to GitHub
git add .
git commit -m "describe what you changed"
git push origin main

# Render redeploys backend automatically (1-2 min)
# Vercel redeploys frontend automatically (1-2 min)
```

You never need to manually deploy again.

---

## Step 9 — Family Onboarding Guide

Send this to your family (copy and paste into a message):

---

**Welcome to FamilyChat! 👋**

Here's how to get started:

**1. Open the app**  
Go to: https://familychat.vercel.app

**2. Create your account**  
Click "Register" → enter your name, email, and a password → click "Create Account"

**3. Start chatting**  
You'll see rooms on the left side:
- **#general** — for everyday chat
- **#family** — for family news
- **#random** — for fun stuff

Click a room name to join it. Type a message and press Enter (or click Send).

**4. Video call**  
Click the "📹 Video Call" button → allow camera access when asked → wait for the other person to connect.

**5. If the app is slow at first**  
Wait about 30 seconds — it's waking up from sleep. This only happens after long periods of no activity.

**Questions?** Ask [your name] 😊

---

## Troubleshooting Common Issues

| Problem | Cause | Solution |
|---------|-------|---------|
| App shows blank page | Build error | Check Vercel logs → Functions tab |
| "Server error" on login | Backend down | Check Render logs → is service Live? |
| Messages not sending | CORS issue | Verify CLIENT_URL on Render matches Vercel URL |
| Video call doesn't connect | Firewall/NAT | Add Metered.ca TURN server (see Phase 4) |
| Slow first load (30s) | Render sleeping | UptimeRobot not set up — see Step 6 |
| App works locally but not live | Wrong env vars | Double-check Render and Vercel env variables |

### How to check Render logs
1. render.com → your service → click **"Logs"** tab
2. Look for errors in red

### How to check Vercel logs
1. vercel.com → your project → click **"Deployments"** → click latest
2. Click **"Build Logs"** or **"Functions"**

---

## Free Services Reference

| Service | URL | Purpose | Free limit |
|---------|-----|---------|-----------|
| GitHub | github.com | Code storage | Unlimited |
| MongoDB Atlas | mongodb.com/atlas | Database | 512 MB |
| Render | render.com | Backend hosting | 750 hrs/month |
| Vercel | vercel.com | Frontend hosting | Unlimited |
| UptimeRobot | uptimerobot.com | Server keep-alive | 50 monitors |
| Google STUN | Built-in | WebRTC calls | Unlimited |
| Metered.ca | metered.ca | TURN relay (optional) | 50 GB/month |

**Total monthly cost: $0**

---

## Phase 6 Checklist

- [ ] All code pushed to GitHub
- [ ] Backend deployed to Render (status: Live)
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set on Render
- [ ] Environment variables set on Vercel
- [ ] CLIENT_URL on Render matches Vercel URL
- [ ] REACT_APP_SERVER_URL on Vercel matches Render URL
- [ ] Visited the live Vercel URL — app loads
- [ ] Registered a test account successfully
- [ ] Chat works between two browser tabs
- [ ] UptimeRobot monitor set up
- [ ] Tested on a real mobile device
- [ ] Video call tested on two real devices
- [ ] Family onboarding message sent

---

## Congratulations! 🎉

Your FamilyChat app is live. Your family can now:
- Chat in real time across multiple rooms
- Make video calls with automatic quality adjustment
- Use the app even on slow mobile connections
- Access it from any device, anywhere in the world

**Total infrastructure cost: $0/month — forever.**
