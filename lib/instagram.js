const browser = require('./browser');

const HOUR = 3600000;
const DAY = 86400000;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiFetch(page, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await page.evaluate(async (u) => {
      const r = await fetch(u, {
        headers: { 'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest' },
        credentials: 'include',
      });
      return { status: r.status, body: await r.text() };
    }, url);
    if (res.status === 200) return JSON.parse(res.body);
    if (res.status === 429 || res.status === 400) {
      await sleep(45000);
      continue;
    }
    throw new Error(`API ${res.status}: ${res.body.slice(0, 200)}`);
  }
  throw new Error('API retry limit exceeded');
}

async function getProfileInfo(page) {
  // Detect logged-in user by looking for profile link on the home page
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
  } catch {}
  const username = await page.evaluate(() => {
    // Look for links like /{username}/ in the sidebar/nav (not /accounts/, /explore/, etc.)
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href');
      if (h && /^\/[a-zA-Z0-9._]+\/$/.test(h) && !h.match(/^\/(accounts|explore|reels|direct|p|stories|legal|directory)\//)) {
        return h.slice(1, -1);
      }
    }
    return null;
  });
  if (!username) return null;
  const data = await apiFetch(page, `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`);
  const user = data?.data?.user;
  if (!user) return null;
  return { id: user.id, username: user.username, following: user.edge_follow?.count || 0, followers: user.edge_followed_by?.count || 0 };
}

async function getFriendsList(page, userId, kind) {
  const users = [];
  const seen = new Set();
  let maxId = '';
  let pageNum = 0;
  while (true) {
    pageNum++;
    const url =
      `https://www.instagram.com/api/v1/friendships/${userId}/${kind}/?count=200&search_surface=follow_list_page` +
      (maxId ? `&max_id=${maxId}` : '');
    const data = await apiFetch(page, url);
    for (const u of data.users || []) {
      if (u?.username && !seen.has(u.username)) {
        seen.add(u.username);
        users.push(u.username);
      }
    }
    maxId = data.next_max_id || '';
    if (!maxId || !data.big_list || !(data.users || []).length) break;
    if (users.length >= 50000) break;
    await sleep(rand(400, 1200));
  }
  return users;
}

async function unfollowViaDialog(page, search, target) {
  await search.fill(target);
  await sleep(1800);

  const btnHandle = await page.evaluateHandle((t) => {
    const d = document.querySelector('div[role="dialog"]');
    if (!d) return { err: 'no_dialog' };
    if (/No results found/.test(d.innerText)) return { err: 'not_following' };
    const link = d.querySelector('a[href="/' + t + '/"]');
    if (!link) return { err: 'not_found' };
    let el = link;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el || el.getAttribute('role') === 'dialog') return { err: 'no_button' };
      const btn = el.querySelector('button');
      if (btn && /Following/.test(btn.innerText || '')) return btn;
    }
    return { err: 'no_button' };
  }, target);

  const isErr = await btnHandle.evaluate((v) => v?.err || null);
  if (isErr === 'no_dialog') return 'net_error';
  if (isErr === 'not_following') return 'already_unfollowed';
  if (isErr === 'not_found') return 'not_found';
  if (isErr === 'no_button') return 'no_button';

  const el = btnHandle.asElement();
  if (!el) return 'no_button';
  await el.click();
  await sleep(1200);

  if ((await page.getByText(/try again later|restrict certain activity|blocked/i).count()) > 0) return 'blocked';

  const menu = page.locator('div[role="dialog"], div[role="menu"]').last();
  const unfollowOpt = menu.locator('button, div[role="button"], a').filter({ hasText: /^Unfollow$/ }).last();
  try {
    await unfollowOpt.waitFor({ timeout: 4000 });
    await unfollowOpt.click({ timeout: 4000 });
  } catch {
    return 'no_unfollow_opt';
  }
  await sleep(900);

  const confirm = page.locator('div[role="dialog"]').filter({ hasText: /Unfollow @|request to follow/i }).last().locator('button').filter({ hasText: 'Unfollow' }).last();
  try {
    await confirm.waitFor({ timeout: 2500 });
    await confirm.click({ timeout: 3000 });
    await sleep(900);
  } catch {}

  const verified = await page.evaluate((t) => {
    const d = document.querySelector('div[role="dialog"]');
    if (!d) return true;
    const link = d.querySelector('a[href="/' + t + '/"]');
    if (!link) return true;
    let el = link;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el || el.getAttribute('role') === 'dialog') return true;
      const btn = el.querySelector('button');
      if (btn) {
        const txt = (btn.innerText || '').trim();
        return txt === 'Follow' || /No results/.test(d.innerText);
      }
    }
    return true;
  }, target);
  return verified ? 'done' : 'unverified';
}

module.exports = { getProfileInfo, getFriendsList, unfollowViaDialog, sleep, rand, HOUR, DAY };
