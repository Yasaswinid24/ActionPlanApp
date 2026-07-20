# Action Plan — shared, live, 24/7

A tiny Node/Express app storing data in MongoDB Atlas, plus the action-plan
page you already had. Anyone with the URL sees the same live data (no
Claude account needed). Because data lives in Atlas — not on Render's own
disk — it survives every redeploy automatically, at no extra cost.

## Run locally (optional, to test)
```
npm install
MONGODB_URI="your-atlas-connection-string" ADMIN_PASSWORD="yourpassword" npm start
```
Then open http://localhost:3000

## Set up MongoDB Atlas (you said you already have the free 512MB tier — good, this uses that)

1. In Atlas, go to your cluster → **Connect** → **Drivers** → copy the
   connection string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`
2. Make sure your Atlas cluster's **Network Access** allows connections from
   anywhere (`0.0.0.0/0`) — Render's servers use changing IPs, so IP
   allowlisting a specific address won't work on the free plan. In Atlas:
   Network Access → Add IP Address → Allow Access from Anywhere.
3. You don't need to create the database or collection manually — the app
   creates them automatically the first time it saves a plan.

## Deploy on Render.com (free)

1. **Put this folder in a GitHub repo** (push `server.js`, `package.json`,
   `public/`, this README).
2. **Create the service on Render.**
   - render.com → New → Web Service → connect your GitHub repo.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free is fine.
3. **Set environment variables** on the Render service (Environment tab):
   - `MONGODB_URI` → your Atlas connection string from above.
   - `ADMIN_PASSWORD` → a password only you and Panos know (see below).
   - `ADMIN_USER` → optional, defaults to `admin`.
4. Click **Create Web Service**. Render builds and gives you a live URL
   like `https://action-plan-xxxx.onrender.com` — that's your 24/7 link.

**Free-tier sleep:** Render's free web services sleep after ~15 minutes of
no traffic and take ~30-50 seconds to wake up on the next visit. That's
unrelated to data storage — your data is always safe in Atlas either way.
If the wake-up delay bothers you, the $7/mo Starter plan stays always-on.

## What changed vs. the Claude artifact version
- Data now lives in MongoDB Atlas instead of Claude's artifact storage, so
  it works for both of you, outside Claude entirely, and survives redeploys.
- The page polls the server every 6 seconds so you each see the other's
  edits without refreshing manually (there's also a manual Refresh button).

## Multiple action plans (one per customer/prospect)
The home page (`/`) lists every customer/prospect as a card. Click
"+ New plan", type a name, and it creates a fresh action plan with its own
link (`/plan.html?id=...`) — bookmark or share that specific link for that
customer. Delete a plan from the home page once a deal closes or falls
through. All plans live in the same free Atlas cluster, so this doesn't
cost anything extra.

Note: switching from the old local-JSON-file version to Atlas means past
data stored only in the old file is gone (it wasn't persisted on Render's
disk anyway across redeploys). Going forward, everything is safe in Atlas.

## Redeploying an update on Render
Push the new files to the same GitHub repo (overwrite the old ones) —
Render auto-redeploys on every push to your connected branch. No new
service or settings needed.

## Password-protecting the customer list (do this before sharing links with customers)

The customer list page (`/`) and the ability to create/delete plans now
require a password — this is the part only you and Panos should access.
Individual plan links (`/plan.html?id=...`) stay open with no password,
since those are what's safe to hand to a specific customer — the ID in the
link is a random 12-character code, and there's no way to browse from one
plan to any other without the password.

**Set it up on Render:**
1. Go to your Render service → **Environment**.
2. Add these environment variables:
   - `ADMIN_PASSWORD` → pick a real password (this is required — the app
     will block the customer list entirely until this is set).
   - `ADMIN_USER` → optional, defaults to `admin` if you skip it.
3. Save — Render will restart the service automatically.
4. Now when you or Panos open the site's root URL, your browser will pop up
   a login box asking for that username/password.

**When sharing a plan with a customer:** don't send them the root URL —
send them the specific `/plan.html?id=...` link from that customer's card
on your (password-protected) home page. That link works for them with no
password, and it only shows their own plan.