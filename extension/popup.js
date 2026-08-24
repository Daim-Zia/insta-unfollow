// Popup script — communicates with background service worker

function send(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => resolve(resp || { ok: false, error: 'No response' }));
  });
}

function addLog(data) {
  const container = document.getElementById('logContainer');
  const empty = container.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  let cls = 'result-info';
  if (data.result === 'done') cls = 'result-done';
  else if (data.result?.includes('error')) cls = 'result-error';
  else if (data.result?.includes('warn')) cls = 'result-warn';

  entry.innerHTML = `<span class="time">${time}</span><span class="user">${data.username}</span><span class="${cls}">${data.result}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function updateButtons(running, paused) {
  document.getElementById('startBtn').classList.toggle('hidden', running);
  document.getElementById('pauseBtn').classList.toggle('hidden', !running);
  document.getElementById('stopBtn').classList.toggle('hidden', !running);
  document.getElementById('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
  if (!running) document.getElementById('progressBar').classList.add('hidden');
}

function updateStats(stats) {
  if (stats.total !== undefined) document.getElementById('statUnfollowed').textContent = stats.total;
}

function showDashboard(profile) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  document.getElementById('statusBadge').textContent = 'Connected';
  document.getElementById('statusBadge').className = 'badge connected';
  if (profile) {
    document.getElementById('username').textContent = profile.username;
    document.getElementById('counts').textContent = `${profile.following} following / ${profile.followers} followers`;
    document.getElementById('avatar').textContent = profile.username[0].toUpperCase();
    document.getElementById('statFollowing').textContent = profile.following;
    document.getElementById('statFollowers').textContent = profile.followers;
  }
}

async function doLogin() {
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Connecting...';
  const resp = await send({ action: 'login' });
  btn.disabled = false;
  btn.textContent = 'Connect Instagram';
  if (resp?.ok && resp.profile) {
    showDashboard(resp.profile);
  } else {
    addLog({ username: 'SYSTEM', result: 'error: ' + (resp?.error || 'Failed. Make sure you are logged in to Instagram.') });
  }
}

async function doScan() {
  addLog({ username: 'SYSTEM', result: 'info: Scanning...' });
  const resp = await send({ action: 'scan' });
  if (resp?.ok) {
    document.getElementById('statFollowing').textContent = resp.following;
    document.getElementById('statFollowers').textContent = resp.followers;
    document.getElementById('statNonFollowers').textContent = resp.nonFollowers;
  } else {
    addLog({ username: 'SYSTEM', result: 'error: ' + (resp?.error || 'Scan failed') });
  }
}

async function doStart() {
  const cfg = {
    hourlyLimit: parseInt(document.getElementById('hourlyLimit').value) || 40,
    dailyLimit: parseInt(document.getElementById('dailyLimit').value) || 200,
    minDelay: parseInt(document.getElementById('minDelay').value) || 8,
    maxDelay: parseInt(document.getElementById('maxDelay').value) || 15,
    breakEvery: parseInt(document.getElementById('breakEvery').value) || 40,
    breakMin: parseInt(document.getElementById('breakMin').value) || 2,
  };
  const resp = await send({ action: 'start', config: cfg });
  if (resp?.ok) {
    updateButtons(true, false);
  } else {
    addLog({ username: 'SYSTEM', result: 'error: ' + (resp?.error || 'Failed to start') });
  }
}

async function doStop() {
  await send({ action: 'stop' });
  updateButtons(false, false);
}

async function doPause() {
  const resp = await send({ action: 'pause' });
  if (resp?.ok) updateButtons(true, resp.paused);
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'log') addLog(msg.data);
  if (msg.type === 'status') {
    if (msg.data.running !== undefined) updateButtons(msg.data.running, msg.data.paused);
    if (msg.data.stats) updateStats(msg.data.stats);
    if (msg.data.message) addLog({ username: 'SYSTEM', result: 'info: ' + msg.data.message });
  }
  if (msg.type === 'progress') {
    const pct = msg.data.total > 0 ? (msg.data.index / msg.data.total * 100).toFixed(1) : 0;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = `${msg.data.index} / ${msg.data.total}`;
    document.getElementById('progressBar').classList.remove('hidden');
    if (msg.data.stats) updateStats(msg.data.stats);
  }
});

// Init — check current status
(async () => {
  const resp = await send({ action: 'getStatus' });
  if (resp?.ok) {
    if (resp.loggedIn && resp.profile) {
      showDashboard(resp.profile);
      document.getElementById('statUnfollowed').textContent = resp.unfollowedCount || 0;
      document.getElementById('statNonFollowers').textContent = resp.nonFollowersCount || 0;
    }
    if (resp.running) updateButtons(true, resp.paused);
  }
})();
