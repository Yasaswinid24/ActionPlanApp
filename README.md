# Action Plan — shared, live, 24/7

A tiny Node/Express app: one server, data stored permanently in a free
MongoDB Atlas database, and the action-plan page you already had. Anyone
with the URL sees the same live data (no Claude account needed).

**Why MongoDB now, instead of a local JSON file:** Render's free plan wipes
its local disk every time the service restarts or redeploys (including
after it "sleeps" from inactivity). A local file cannot survive that. A free
external database like MongoDB Atlas lives outside Render entirely, so your
data survives restarts, redeploys, and sleep/wake cycles.

## Step 1 — Create your free MongoDB Atlas database (~5 minutes)

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (free).
2. When asked to create a cluster, choose the **M0 Free** tier.
3. Under **Security → Database Access**, create a database user with a
   username and password (save these somewhere).
4. Under **Security → Network Access**, click **Add IP Address** → **Allow
   Access from Anywhere** (0.0.0.0/0). This is needed because Render's
   servers don't have a fixed IP.
5. Go to your cluster → **Connect** → **Drivers** → copy the connection
   string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`
   Replace `<username>` and `<password>` with the ones from step 3.

## Step 2 — Run locally (optional, to test)
```
npm install
export MONGODB_URI="your-connection-string-here"
npm start
```
Then open http://localhost:3000

## Step 3 — Deploy on Render.com (free)

1. **Put this folder in a GitHub repo.**
   - Create a new repo on GitHub (e.g. `action-plan`), and push these files
     (`server.js`, `package.json`, `public/index.html`, this README) to it.

2. **Create the service on Render.**
   - Go to render.com → New → Web Service.
   - Connect your GitHub repo.
   - Settings:
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Instance Type:** Free is fine.

3. **Add the database connection as an environment variable.**
   - In your Render service → **Environment** tab → **Add Environment
     Variable**.
   - Key: `MONGODB_URI`
   - Value: the connection string from Step 1 (with your real username and
     password filled in).
   - Save. Render will redeploy automatically.

4. Render will give you a live URL like
   `https://action-plan-xxxx.onrender.com` — that's your 24/7 link. Send
   that same link to your boss; you both use it directly in any browser, no
   Claude account involved.

5. **Free-tier sleep (unrelated to data loss):** Render's free web services
   "sleep" after ~15 minutes of no traffic and take ~30-50 seconds to wake
   up on the next visit. That's just a slow first load, not a data problem
   anymore — your data is now safe in MongoDB regardless of sleep/wake or
   redeploys.

## What changed vs. the local-file version
- Data now lives permanently in MongoDB Atlas instead of a file on Render's
  disk, so it survives restarts and redeploys.
- The page still polls the server every 6 seconds so you each see the
  other's edits without refreshing manually (there's also a manual Refresh
  button).
