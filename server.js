const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const browser = require('./lib/browser');
const instagram = require('./lib/instagram');
const state = require('./lib/state');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let running = false;
let paused = false;
let progress = state.load();
let currentProfile = null;

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(msg); });
}

function log(username, result) {
  state.addLog(progress, username, result);
  broadcast('log', { username, result, at: new Date().toISOString() });
}

// --- API Routes ---

app.get('/api/status', async (req, res) => {
  try {
    const page = await browser.getPage();
    const loggedIn = await instagram.getProfileInfo(page);
    res.json({ loggedIn: !!loggedIn, profile: currentProfile || loggedIn, stats: state.getStats(progress), running, paused });
  } catch {
    res.json({ loggedIn: false, profile: null, stats: state.getStats(progress), running, paused });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    await browser.launch(false);
    await browser.openLogin();
    broadcast('status', { waitingForLogin: true });
    const ok = await browser.waitForLogin(300000);
    if (ok) {
      // Send response immediately — don't block on profile fetch
      res.json({ ok: true });
      // Fetch profile in background, then restart headless
      try {
        const page = await browser.getPage();
        currentProfile = await instagram.getProfileInfo(page);
        await browser.close();
        await browser.launch(true);
        broadcast('status', { waitingForLogin: false, loggedIn: true, profile: currentProfile });
      } catch (e) {
        await browser.close().catch(() => {});
        await browser.launch(true).catch(() => {});
        broadcast('error', { message: 'Login succeeded but profile fetch failed: ' + e.message });
      }
    } else {
      res.json({ ok: false, error: 'Login timeout' });
      await browser.close().catch(() => {});
    }
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/logout', async (req, res) => {
  await browser.close();
  currentProfile = null;
  res.json({ ok: true });
});

app.get('/api/preview', async (req, res) => {
  try {
    const page = await browser.getPage();
    const profile = await instagram.getProfileInfo(page);
    if (!profile) return res.json({ ok: false, error: 'Not logged in' });

    const following = await instagram.getFriendsList(page, profile.id, 'following');
    const followers = await instagram.getFriendsList(page, profile.id, 'followers');
    const followerSet = new Set(followers);
    const already = new Set(progress.unfollowed.map((u) => u.username));
    const nonFollowers = following.filter((u) => !followerSet.has(u) && !already.has(u));

    res.json({ ok: true, following: following.length, followers: followers.length, nonFollowers: nonFollowers.length, alreadyUnfollowed: already.size, sample: nonFollowers.slice(0, 30) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/start', async (req, res) => {
  if (running) return res.json({ ok: false, error: 'Already running' });
  const cfg = req.body || {};
  running = true;
  paused = false;
  res.json({ ok: true });
  runAutomation(cfg);
});

app.post('/api/stop', (req, res) => {
  running = false;
  paused = false;
  res.json({ ok: true });
});

app.post('/api/pause', (req, res) => {
  paused = !paused;
  res.json({ ok: true, paused });
});

app.get('/api/stats', (req, res) => {
  res.json(state.getStats(progress));
});

// --- Automation ---

async function runAutomation(cfg) {
  const hourlyLimit = cfg.hourlyLimit || 200;
  const dailyLimit = cfg.dailyLimit || 1000;
  const minDelay = cfg.minDelay || 4;
  const maxDelay = cfg.maxDelay || 7;
  const breakEvery = cfg.breakEvery || 60;
  const breakMin = cfg.breakMin || 1;
  const breakMax = cfg.breakMax || 2;

  try {
    const page = await browser.getPage();
    const profile = await instagram.getProfileInfo(page);
    if (!profile) { broadcast('error', { message: 'Not logged in' }); running = false; return; }

    broadcast('status', { message: 'Fetching following list...' });
    const following = await instagram.getFriendsList(page, profile.id, 'following');
    broadcast('status', { message: 'Fetching followers list...' });
    const followers = await instagram.getFriendsList(page, profile.id, 'followers');

    const followerSet = new Set(followers);
    const already = new Set(progress.unfollowed.map((u) => u.username));
    const nonFollowers = following.filter((u) => !followerSet.has(u) && !already.has(u));

    broadcast('status', { message: `Found ${nonFollowers.length} non-followers`, following: following.length, followers: followers.length, nonFollowers: nonFollowers.length });

    await page.goto(`https://www.instagram.com/${profile.username}/`, { waitUntil: 'domcontentloaded' });
    await instagram.sleep(4000);
    await page.locator('a', { hasText: /following$/i }).first().click();
    await instagram.sleep(3000);
    const search = page.locator('div[role="dialog"] input').first();
    broadcast('status', { message: 'Following dialog ready. Starting...' });

    let silentFailures = 0;

    for (let i = 0; i < nonFollowers.length; i++) {
      if (!running) { broadcast('status', { message: 'Stopped by user' }); break; }
      while (paused && running) { await instagram.sleep(1000); }

      const now = Date.now();
      const todayCount = progress.unfollowed.filter((u) => now - u.at < instagram.DAY).length;
      if (todayCount >= dailyLimit) { broadcast('status', { message: `Daily limit (${dailyLimit}) reached` }); break; }

      const hourCount = progress.unfollowed.filter((u) => now - u.at < instagram.HOUR).length;
      if (hourCount >= hourlyLimit) {
        broadcast('status', { message: `Hourly limit (${hourlyLimit}) reached. Waiting 1 hour...` });
        await instagram.sleep(3600000);
      }

      const target = nonFollowers[i];
      let result;
      try {
        result = await instagram.unfollowViaDialog(page, search, target);
      } catch (e) {
        result = 'error';
        log(target, result);
        broadcast('status', { message: `Error on ${target}: ${e.message}` });
        break;
      }

      if (result === 'done' || result === 'already_unfollowed') {
        state.addUnfollow(progress, target);
      }
      log(target, result);
      broadcast('progress', { index: i + 1, total: nonFollowers.length, target, result, stats: state.getStats(progress) });

      if (result === 'blocked') {
        broadcast('status', { message: 'Action blocked by Instagram. Stopping.' });
        break;
      }
      if (result === 'net_error') continue;

      if (result === 'unverified' || result === 'no_unfollow_opt' || result === 'no_button') {
        silentFailures++;
        if (silentFailures >= 5) {
          broadcast('status', { message: '5 consecutive failures. Account may be action-blocked.' });
          break;
        }
      } else {
        silentFailures = 0;
      }

      if ((i + 1) % breakEvery === 0) {
        const b = instagram.rand(breakMin, breakMax);
        broadcast('status', { message: `Break for ${b} min...` });
        await instagram.sleep(b * 60000);
      } else {
        await instagram.sleep(instagram.rand(minDelay, maxDelay) * 1000);
      }
    }

    state.save(progress);
    running = false;
    broadcast('status', { message: 'Session complete', running: false, paused: false, stats: state.getStats(progress) });
  } catch (e) {
    running = false;
    broadcast('error', { message: e.message });
  }
}

// --- WebSocket ---

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', data: { running, paused, stats: state.getStats(progress) } }));
});

// --- Start ---

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log(`\n  Insta-Unfollow running at http://localhost:${PORT}\n`);
});
