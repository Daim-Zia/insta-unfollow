let ws = null;
let loggedIn = false;

// --- WebSocket ---

function connect() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = (e) => {
    const { type, data } = JSON.parse(e.data);
    if (type === 'status') handleStatus(data);
    if (type === 'log') addLog(data);
    if (type === 'progress') handleProgress(data);
    if (type === 'error') addLog({ username: 'SYSTEM', result: 'error: ' + data.message });
  };
  ws.onclose = () => setTimeout(connect, 2000);
  ws.onerror = () => {};
}

function handleStatus(data) {
  if (data.loggedIn !== undefined) {
    loggedIn = data.loggedIn;
    if (loggedIn) showDashboard(data.profile);
    else showLogin();
  }
  if (data.message) addLog({ username: 'SYSTEM', result: 'info: ' + data.message });
  if (data.stats) updateStats(data.stats);
  if (data.running !== undefined) updateButtons(data.running, data.paused);
  if (data.waitingForLogin) {
    document.getElementById('headerStatus').textContent = 'Waiting for login...';
    document.getElementById('headerStatus').style.color = 'var(--warning)';
  }
  if (data.following !== undefined) {
    document.getElementById('statFollowing').textContent = data.following;
    document.getElementById('statFollowers').textContent = data.followers;
    document.getElementById('statNonFollowers').textContent = data.nonFollowers;
  }
}

function handleProgress(data) {
  const pct = data.total > 0 ? (data.index / data.total * 100).toFixed(1) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = `${data.index} / ${data.total}`;
  document.getElementById('progressBar').classList.remove('hidden');
  if (data.stats) updateStats(data.stats);
}

// --- UI ---

function showLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('dashboardSection').classList.add('hidden');
  document.getElementById('headerStatus').textContent = 'Not connected';
  document.getElementById('headerStatus').style.color = 'var(--text-dim)';
}

function showDashboard(profile) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  document.getElementById('headerStatus').textContent = 'Connected';
  document.getElementById('headerStatus').style.color = 'var(--success)';
  if (profile) {
    document.getElementById('profileUsername').textContent = profile.username;
    document.getElementById('profileStats').textContent = `${profile.following} following / ${profile.followers} followers`;
    document.getElementById('avatarPlaceholder').textContent = profile.username[0].toUpperCase();
  }
}

function updateButtons(running, paused) {
  document.getElementById('startBtn').classList.toggle('hidden', running);
  document.getElementById('pauseBtn').classList.toggle('hidden', !running);
  document.getElementById('stopBtn').classList.toggle('hidden', !running);
  document.getElementById('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
  if (!running) document.getElementById('progressBar').classList.add('hidden');
}

function updateStats(stats) {
  document.getElementById('statUnfollowed').textContent = stats.total;
}

function addLog(data) {
  const container = document.getElementById('logContainer');
  const empty = container.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date(data.at || Date.now()).toLocaleTimeString();
  let resultClass = 'result-info';
  if (data.result === 'done') resultClass = 'result-done';
  else if (data.result?.includes('error') || data.result === 'blocked') resultClass = 'result-error';
  else if (data.result?.includes('warn') || data.result === 'unverified') resultClass = 'result-warn';

  entry.innerHTML = `<span class="time">${time}</span><span class="user">${data.username}</span><span class="${resultClass}">${data.result}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

// --- Actions ---

async function doLogin() {
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Opening browser...';
  const res = await fetch('/api/login', { method: 'POST' });
  const data = await res.json();
  btn.disabled = false;
  btn.textContent = 'Login with Instagram';
  if (data.ok) showDashboard(data.profile);
}

async function doStart() {
  const cfg = {
    hourlyLimit: parseInt(document.getElementById('hourlyLimit').value) || 200,
    dailyLimit: parseInt(document.getElementById('dailyLimit').value) || 1000,
    minDelay: parseInt(document.getElementById('minDelay').value) || 4,
    maxDelay: parseInt(document.getElementById('maxDelay').value) || 7,
    breakEvery: parseInt(document.getElementById('breakEvery').value) || 60,
    breakMin: parseInt(document.getElementById('breakMin').value) || 1,
    breakMax: parseInt(document.getElementById('breakMax').value) || 2,
  };
  await fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
  updateButtons(true, false);
}

async function doStop() {
  await fetch('/api/stop', { method: 'POST' });
  updateButtons(false, false);
}

async function doPause() {
  const res = await fetch('/api/pause', { method: 'POST' });
  const data = await res.json();
  updateButtons(true, data.paused);
}

async function doPreview() {
  addLog({ username: 'SYSTEM', result: 'info: Scanning...' });
  const res = await fetch('/api/preview');
  const data = await res.json();
  if (data.ok) {
    document.getElementById('statFollowing').textContent = data.following;
    document.getElementById('statFollowers').textContent = data.followers;
    document.getElementById('statNonFollowers').textContent = data.nonFollowers;
    document.getElementById('statUnfollowed').textContent = data.alreadyUnfollowed;
    addLog({ username: 'SYSTEM', result: `info: ${data.nonFollowers} non-followers found (${data.sample.slice(0, 8).join(', ')}...)` });
  } else {
    addLog({ username: 'SYSTEM', result: 'error: ' + data.error });
  }
}

// --- Init ---

connect();
fetch('/api/status').then((r) => r.json()).then(handleStatus);
