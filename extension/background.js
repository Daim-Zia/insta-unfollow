// Background service worker — manages state and coordinates messaging

let state = {
  profile: null,
  following: [],
  followers: [],
  nonFollowers: [],
  unfollowed: [],
  running: false,
  paused: false,
  stats: { total: 0, lastHour: 0, lastDay: 0 },
};

// Load state from storage
chrome.storage.local.get('state', (data) => {
  if (data.state) {
    state = { ...state, ...data.state, running: false, paused: false };
  }
});

function saveState() {
  chrome.storage.local.set({ state });
}

function getTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: 'https://www.instagram.com/*', active: true }, (tabs) => {
      resolve(tabs[0] || null);
    });
  });
}

function sendToContent(tab, msg) {
  return new Promise((resolve, reject) => {
    if (!tab) return reject(new Error('No Instagram tab found'));
    chrome.tabs.sendMessage(tab.id, msg, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// Message handler from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.action === 'getStatus') {
        sendResponse({
          ok: true,
          loggedIn: !!state.profile,
          profile: state.profile,
          stats: state.stats,
          running: state.running,
          paused: state.paused,
          unfollowedCount: state.unfollowed.length,
          nonFollowersCount: state.nonFollowers.length,
        });
      } else if (msg.action === 'login') {
        const tab = await getTab();
        if (!tab) {
          // Open instagram.com
          await chrome.tabs.create({ url: 'https://www.instagram.com/', active: true });
          sendResponse({ ok: false, error: 'Please log in to Instagram in the new tab, then try again.' });
          return;
        }
        const resp = await sendToContent(tab, { action: 'getProfile' });
        if (resp?.ok && resp.profile) {
          state.profile = resp.profile;
          saveState();
          sendResponse({ ok: true, profile: resp.profile });
        } else {
          sendResponse({ ok: false, error: 'Not logged in. Please log in to Instagram first.' });
        }
      } else if (msg.action === 'scan') {
        const tab = await getTab();
        if (!tab) return sendResponse({ ok: false, error: 'Open Instagram in a tab first' });
        if (!state.profile) {
          const profResp = await sendToContent(tab, { action: 'getProfile' });
          if (profResp?.ok) state.profile = profResp.profile;
        }
        if (!state.profile) return sendResponse({ ok: false, error: 'Not logged in' });

        broadcast({ type: 'log', data: { username: 'SYSTEM', result: 'info: Fetching following list...' } });
        const followingResp = await sendToContent(tab, { action: 'getFollowing', userId: state.profile.id });
        if (!followingResp?.ok) return sendResponse({ ok: false, error: followingResp?.error || 'Failed to fetch following' });
        state.following = followingResp.following;

        broadcast({ type: 'log', data: { username: 'SYSTEM', result: 'info: Fetching followers list...' } });
        const followersResp = await sendToContent(tab, { action: 'getFollowers', userId: state.profile.id });
        if (!followersResp?.ok) return sendResponse({ ok: false, error: followersResp?.error || 'Failed to fetch followers' });
        state.followers = followersResp.followers;

        const followerSet = new Set(state.followers);
        const alreadySet = new Set(state.unfollowed.map((u) => u.username));
        state.nonFollowers = state.following.filter((u) => !followerSet.has(u) && !alreadySet.has(u));

        state.stats = {
          total: state.unfollowed.length,
          lastHour: state.unfollowed.filter((u) => Date.now() - u.at < 3600000).length,
          lastDay: state.unfollowed.filter((u) => Date.now() - u.at < 86400000).length,
        };

        saveState();
        broadcast({ type: 'log', data: { username: 'SYSTEM', result: `info: Found ${state.nonFollowers.length} non-followers` } });
        sendResponse({ ok: true, nonFollowers: state.nonFollowers.length, following: state.following.length, followers: state.followers.length });
      } else if (msg.action === 'start') {
        if (state.running) return sendResponse({ ok: false, error: 'Already running' });
        if (state.nonFollowers.length === 0) return sendResponse({ ok: false, error: 'No non-followers found. Run Scan first.' });
        state.running = true;
        state.paused = false;
        saveState();
        runUnfollow(msg.config || {});
        sendResponse({ ok: true });
      } else if (msg.action === 'stop') {
        state.running = false;
        state.paused = false;
        saveState();
        sendResponse({ ok: true });
      } else if (msg.action === 'pause') {
        state.paused = !state.paused;
        saveState();
        sendResponse({ ok: true, paused: state.paused });
      } else {
        sendResponse({ ok: false, error: 'Unknown action' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});

async function runUnfollow(config) {
  const hourlyLimit = config.hourlyLimit || 40;
  const dailyLimit = config.dailyLimit || 200;
  const minDelay = (config.minDelay || 8) * 1000;
  const maxDelay = (config.maxDelay || 15) * 1000;
  const breakEvery = config.breakEvery || 40;
  const breakMin = (config.breakMin || 2) * 60000;
  const breakMax = ((config.breakMin || 2) + 1) * 60000;

  const tab = await getTab();
  if (!tab) {
    state.running = false;
    saveState();
    broadcast({ type: 'status', data: { message: 'No Instagram tab found. Stopped.' } });
    return;
  }

  let silentFailures = 0;

  for (let i = 0; i < state.nonFollowers.length; i++) {
    if (!state.running) break;
    while (state.paused && state.running) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!state.running) break;

    // Rate limit checks
    const now = Date.now();
    const hourCount = state.unfollowed.filter((u) => now - u.at < 3600000).length;
    if (hourCount >= hourlyLimit) {
      broadcast({ type: 'log', data: { username: 'SYSTEM', result: `info: Hourly limit (${hourlyLimit}) reached. Waiting...` } });
      await new Promise((r) => setTimeout(r, 3600000));
      continue;
    }
    const dayCount = state.unfollowed.filter((u) => now - u.at < 86400000).length;
    if (dayCount >= dailyLimit) {
      broadcast({ type: 'log', data: { username: 'SYSTEM', result: `info: Daily limit (${dailyLimit}) reached. Stopping.` } });
      break;
    }

    const target = state.nonFollowers[i];
    try {
      const resp = await sendToContent(tab, { action: 'unfollow', username: target });
      if (resp?.ok) {
        state.unfollowed.push({ username: target, at: Date.now() });
        state.stats.total = state.unfollowed.length;
        state.stats.lastHour = state.unfollowed.filter((u) => Date.now() - u.at < 3600000).length;
        state.stats.lastDay = state.unfollowed.filter((u) => Date.now() - u.at < 86400000).length;
        broadcast({ type: 'log', data: { username: target, result: 'done' } });
        silentFailures = 0;
      } else {
        broadcast({ type: 'log', data: { username: target, result: 'error: ' + (resp?.error || 'failed') } });
        silentFailures++;
      }
    } catch (e) {
      broadcast({ type: 'log', data: { username: target, result: 'error: ' + e.message } });
      silentFailures++;
    }

    broadcast({ type: 'progress', data: { index: i + 1, total: state.nonFollowers.length, stats: state.stats } });

    if (silentFailures >= 5) {
      broadcast({ type: 'log', data: { username: 'SYSTEM', result: 'warn: 5 consecutive failures. Stopping to avoid action block.' } });
      break;
    }

    // Break or delay
    if ((i + 1) % breakEvery === 0) {
      const b = Math.floor(breakMin / 60000 + Math.random() * ((breakMax - breakMin) / 60000));
      broadcast({ type: 'log', data: { username: 'SYSTEM', result: `info: Break for ${b} min...` } });
      await new Promise((r) => setTimeout(r, b * 60000));
    } else {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  state.running = false;
  saveState();
  broadcast({ type: 'log', data: { username: 'SYSTEM', result: `info: Session complete. ${state.unfollowed.length} total unfollowed.` } });
  broadcast({ type: 'status', data: { running: false, paused: false, stats: state.stats } });
}
