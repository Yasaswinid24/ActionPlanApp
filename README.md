# Action Plan — shared, live, 24/7

A tiny Node/Express app: one server, one shared JSON "database" file, and the
action-plan page you already had. Anyone with the URL sees the same live data
(no Claude account needed).

## Run locally (optional, to test)
```
npm install
npm start
```
Then open http://localhost:3000

## Deploy on Render.com (free)

1. **Put this folder in a GitHub repo.**
   - Create a new repo on GitHub (e.g. `action-plan`), and push these files
     (`server.js`, `package.json`, `public/index.html`, this README) to it.

2. **Create the service on Render.**
   - Go to render.com → New → Web Service.
   - Connect your GitHub repo.
   - Settings:
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Instance Type:** Free is fine to start.
   - Click **Create Web Service**. Render will build and give you a live URL
     like `https://action-plan-xxxx.onrender.com` — that's your 24/7 link.
     Send that same link to your boss; you both use it directly in any
     browser, no Claude account involved.

3. **Important — data persistence caveat:**
   Render's **free** plan does not guarantee the filesystem survives
   redeploys (and can reset on rebuilds). For a to-do list you're actively
   relying on, do ONE of these:
   - **Cheapest fix:** upgrade to Render's Starter instance (~$7/mo) and add
     a **Persistent Disk** mounted at `/data`, then set the environment
     variable `DATA_DIR=/data` in Render's dashboard. Now your JSON file
     survives every redeploy and restart, guaranteed.
   - **Free fix:** if you don't redeploy often, the free plan's disk
     typically survives normal restarts (just not code redeploys) — fine
     for testing, riskier for daily real use.
   - **More robust free option:** swap the JSON file for a free external
     database like Neon.tech (Postgres) or Supabase, and Render stays free
     forever. I can build that version too if you want it — just ask.

4. **Free-tier sleep:** Render's free web services "sleep" after ~15 minutes
   of no traffic and take ~30-50 seconds to wake up on the next visit. If
   that's annoying, the $7/mo Starter plan stays awake all the time (true
   24/7, no wake-up delay) — which is also the plan you'd want for the
   persistent disk above.

## What changed vs. the Claude artifact version
- Data now lives in `data/db.json` on the server instead of Claude's
  artifact storage, so it works for both of you, outside Claude entirely.
- The page polls the server every 6 seconds so you each see the other's
  edits without refreshing manually (there's also a manual Refresh button).
