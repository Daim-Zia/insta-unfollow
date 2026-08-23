const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', 'state');
const STATE_FILE = path.join(STATE_DIR, 'progress.json');

function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(STATE_FILE)) {
    return { unfollowed: [], log: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { unfollowed: [], log: [] };
  }
}

function save(state) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function addUnfollow(state, username) {
  state.unfollowed.push({ username, at: Date.now() });
}

function addLog(state, username, result) {
  state.log.push({ username, at: new Date().toISOString(), result });
}

function getStats(state) {
  const now = Date.now();
  const HOUR = 3600000;
  const DAY = 86400000;
  return {
    total: state.unfollowed.length,
    lastHour: state.unfollowed.filter((u) => now - u.at < HOUR).length,
    lastDay: state.unfollowed.filter((u) => now - u.at < DAY).length,
    logEntries: state.log.length,
  };
}

module.exports = { load, save, addUnfollow, addLog, getStats };
