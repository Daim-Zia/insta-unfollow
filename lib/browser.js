const { chromium } = require('playwright');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'session');

let context = null;
let page = null;

async function launch(headless = true) {
  if (context) return { context, page };
  context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless,
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  page = context.pages()[0] || await context.newPage();
  return { context, page };
}

async function getPage() {
  if (!page) await launch();
  return page;
}

async function isLoggedIn() {
  try {
    const p = await getPage();
    await p.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await p.waitForTimeout(3000);
    const loginBtn = await p.locator('a[href*="login"], a[href*="emailsignup"]').count();
    return loginBtn === 0;
  } catch {
    return false;
  }
}

async function openLogin() {
  const p = await getPage();
  await p.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
  return p;
}

async function waitForLogin(timeoutMs = 300000) {
  const p = await getPage();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await p.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await p.waitForTimeout(2000);
      const hasLogin = await p.locator('a[href*="login"], a[href*="emailsignup"]').count();
      if (hasLogin === 0) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

async function close() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
    page = null;
  }
}

module.exports = { launch, getPage, isLoggedIn, openLogin, waitForLogin, close };
