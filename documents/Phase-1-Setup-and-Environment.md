# Phase 1 — Project Setup & Environment
### FamilyChat Engineering Guide

**Duration:** Weeks 1–2  
**Goal:** Get all accounts, tools, and repository ready before writing any app code.  
**Language:** JavaScript (Node.js + React)

---

## Prerequisites — Install These First

| Tool | Download | Purpose |
|------|----------|---------|
| Node.js v18+ | nodejs.org | Run JavaScript on server |
| Git | git-scm.com | Version control |
| VS Code | code.visualstudio.com | Code editor |
| GitHub account | github.com | Store source code |

### Verify installations
```bash
node --version    # must show v18 or higher
npm --version     # must show 9 or higher
git --version     # must show git version
```

---

## Step 1 — Create GitHub Repository

1. Go to **github.com** → click **"New repository"**
2. Repository name: `family-chat`
3. Set to **Public**
4. Check **"Add a README file"**
5. Click **"Create repository"**

### Clone to your computer
```bash
git clone https://github.com/YOUR_USERNAME/family-chat.git
cd family-chat
```

---

## Step 2 — Create Project Folder Structure

```bash
# Inside family-chat folder
mkdir server
mkdir client
touch .gitignore
```

Your structure should look like:
```
family-chat/
├── server/        ← Node.js backend (created in Phase 2)
├── client/        ← React frontend (created in Phase 3)
├── .gitignore
└── README.md
```

---

## Step 3 — Create .gitignore

Open `.gitignore` and add:
```
node_modules/
.env
.DS_Store
dist/
build/
*.log
```

> ⚠️ This is important — it prevents secret keys and large folders from being uploaded to GitHub.

---

## Step 4 — MongoDB Atlas (Free Database)

### Create free account
1. Go to **mongodb.com/atlas**
2. Click **"Try Free"** — no credit card needed
3. Sign up with Google or email

### Create free cluster
1. Click **"Build a Database"**
2. Choose **M0 FREE** (512 MB — enough for your family forever)
3. Select the region closest to you
4. Cluster name: `FamilyChat`
5. Click **"Create"**

### Create database user
1. Left sidebar → **"Database Access"**
2. Click **"Add New Database User"**
3. Authentication: **Password**
4. Username: `familychat-user`
5. Password: create a strong one — **save it somewhere safe**
6. Database User Privileges: **Read and write to any database**
7. Click **"Add User"**

### Allow network access
1. Left sidebar → **"Network Access"**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (needed for deployment)
4. Click **"Confirm"**

### Get your connection string
1. Left sidebar → **"Clusters"** → click **"Connect"**
2. Choose **"Connect your application"**
3. Driver: **Node.js** | Version: **4.1 or later**
4. Copy the connection string — it looks like:
```
mongodb+srv://familychat-user:<password>@familychat.xxxxx.mongodb.net/?retryWrites=true&w=majority
```
5. Replace `<password>` with your actual password
6. **Save this string** — you will need it in Phase 2

---

## Step 5 — Render Account (Free Backend Hosting)

1. Go to **render.com**
2. Click **"Get Started for Free"**
3. Sign up with **GitHub** (easier — links your repos automatically)
4. You don't need to create anything now — you will deploy in Phase 6

---

## Step 6 — Vercel Account (Free Frontend Hosting)

1. Go to **vercel.com**
2. Click **"Sign Up"**
3. Sign up with **GitHub**
4. You don't need to create anything now — you will deploy in Phase 6

---

## Step 7 — UptimeRobot Account (Free Server Keep-Alive)

Render's free tier sleeps after 15 minutes. UptimeRobot pings it every 5 minutes to keep it awake.

1. Go to **uptimerobot.com**
2. Click **"Register for FREE"**
3. Sign up with email
4. You will configure the monitor in Phase 6

---

## Phase 1 Checklist

- [ ] Node.js v18+ installed and verified
- [ ] Git installed and verified
- [ ] VS Code installed
- [ ] GitHub repository `family-chat` created and cloned
- [ ] `.gitignore` created with correct entries
- [ ] MongoDB Atlas free cluster created
- [ ] MongoDB database user created (username & password saved)
- [ ] MongoDB network access set to allow anywhere
- [ ] MongoDB connection string saved
- [ ] Render account created (linked to GitHub)
- [ ] Vercel account created (linked to GitHub)
- [ ] UptimeRobot account created

---

## Push Initial Setup to GitHub

```bash
cd family-chat
git add .
git commit -m "Phase 1: initial project setup"
git push origin main
```

---

## What's Next

Move to **Phase 2 — Backend Foundation** to build the Node.js server, database models, authentication, and real-time chat events.
