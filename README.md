<p align="center">
  <img src="https://img.shields.io/badge/Insta--Unfollow-v1.0-blueviolet?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/github/stars/Daim-Zia/insta-unfollow?style=for-the-badge&color=yellow" alt="Stars">
  <img src="https://img.shields.io/github/forks/Daim-Zia/insta-unfollow?style=for-the-badge" alt="Forks">
  <img src="https://img.shields.io/github/license/Daim-Zia/insta-unfollow?style=for-the-badge&color=green" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge" alt="Node">
</p>

<h1 align="center">Insta-Unfollow</h1>

<p align="center">
  <strong>Unfollow thousands of non-followers on Instagram in minutes.</strong><br>
  Free, open-source, runs 100% locally on your machine.<br>
  No API keys. No credentials shared. No third-party servers.
</p>

---

> **[Download](#quick-start)** | **[How It Works](#how-it-works)** | **[Safety Tips](#recommended-settings)** | **[FAQ](#troubleshooting)**

---

## Why Insta-Unfollow?

| Feature | Insta-Unfollow | Browser Extensions | Online Services |
|---------|:-:|:-:|:-:|
| Free forever | ✅ | ⚠️ | ❌ |
| Open source | ✅ | ❌ | ❌ |
| Credentials stay local | ✅ | ⚠️ | ❌ |
| No account required | ✅ | ⚠️ | ❌ |
| Works on any OS | ✅ | ❌ | ⚠️ |
| Unfollow speed | 600+/hr | ~200/hr | varies |
| Resume after crash | ✅ | ❌ | ⚠️ |

## Features

- **Browser-based login** — Log in through Instagram's real login page. Your credentials never leave your machine.
- **Mass unfollow** — Removes 6,000+ non-followers in a single session with smart rate limiting.
- **Real-time dashboard** — Dark-themed web UI with live progress bar, stats, and activity log.
- **Configurable limits** — Hourly caps, daily caps, random delays, scheduled breaks.
- **Pause / Resume / Stop** — Full control at any time.
- **Crash-safe** — Progress is saved after every unfollow. Restart and it picks up where it left off.
- **Smart failure detection** — Detects Instagram action blocks and stops automatically.
- **No API keys needed** — Just Node.js and a browser. That's it.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (includes npm)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/Daim-Zia/insta-unfollow.git
cd insta-unfollow

# Install dependencies
npm install
npx playwright install chromium

# Start the app
npm start
```

Open **http://localhost:3456** in your browser.

### Usage

1. Click **Login with Instagram** — a Chromium window opens
2. Log in to your Instagram account in that window
3. The window closes automatically — dashboard loads with your profile
4. Click **Scan** to see how many non-followers you have
5. Adjust settings if needed (see [Recommended Settings](#recommended-settings))
6. Click **Start Unfollowing** — watch the progress in real time

## Recommended Settings

> Use conservative settings if your account is new, has fewer than 1,000 followers, or has been action-blocked before.

| Profile | Hourly | Daily | Delay | Break Every | Break Duration |
|---------|:------:|:-----:|:-----:|:-----------:|:--------------:|
| **Safe** (new accounts) | 40-60 | 200-400 | 8-15s | 40 | 2-3 min |
| **Moderate** (established) | 80-120 | 500-800 | 5-10s | 60 | 1-2 min |
| **Aggressive** (risky) | 150-200 | 800-1200 | 3-6s | 80 | 1 min |

### Rules to Avoid Action Blocks

- Never unfollow more than **1,000 accounts per day** total
- Accounts under **1 year old** should stay under 50/hr and 200/day
- **Always take breaks** — the built-in break scheduler exists for a reason
- If Instagram shows a **"Confirm it's you"** prompt, **STOP immediately** and wait 24-48 hours
- Spread unfollowing across **multiple sessions**, not one long run
- Running multiple tools (bot + manual + this) simultaneously **will** get you blocked

## How It Works

```
Login (real browser) → Fetch following list → Fetch followers list
→ Compute difference (non-followers)
→ Open Following dialog → Search → Click Unfollow → Confirm
→ Repeat with delays → Resume on restart
```

1. Uses [Playwright](https://playwright.dev/) to launch a real Chromium browser (not a headless bot)
2. You log in through Instagram's official login page — no API keys, no OAuth
3. The app fetches your following and followers lists via Instagram's internal API
4. Computes the difference (accounts you follow that don't follow you back)
5. Opens your profile's Following dialog and uses the search box to find each non-follower
6. Clicks **Following → Unfollow → Confirm** for each account
7. Respects configurable rate limits with random delays and scheduled breaks
8. Saves progress after every unfollow so nothing is lost on crash

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| Hourly Limit | 200 | Max unfollows per rolling 60 minutes |
| Daily Limit | 1,000 | Max unfollows per rolling 24 hours |
| Min Delay | 4 sec | Minimum random pause between unfollows |
| Max Delay | 7 sec | Maximum random pause between unfollows |
| Break Every | 60 | Take a longer break after N unfollows |
| Break Duration | 1 min | Length of break in minutes |

## Data & Privacy

- **Credentials never leave your machine** — You log in directly through Instagram's website in a real browser window
- **Session stored locally** — Login session saved in `./session/` directory
- **Progress saved locally** — Unfollow history in `./state/progress.json`
- **No data sent to external servers** — Everything runs locally on your machine
- **No tracking, no analytics, no phone-home** — 100% offline

## Troubleshooting

**Login window doesn't appear / closes immediately**
- Make sure Playwright Chromium is installed: `npx playwright install chromium`
- Try running `npm start` from a terminal (not a script editor)

**"Action blocked" or "5 consecutive failures"**
- Instagram temporarily blocked unfollowing. Stop the app and wait 24-48 hours.
- Lower your rate limits (see [Recommended Settings](#recommended-settings))

**Browser opens but stays on a blank page**
- Wait 5-10 seconds — Instagram can be slow to load on first visit
- If it persists, delete the `./session/` folder and log in again

**Script crashes mid-run**
- Your progress is saved. Just run `npm start` again — it resumes from where it left off.

**"Execution context was destroyed" error**
- Instagram navigated during a page operation. The app handles this automatically and continues.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js, Express, WebSocket |
| Browser Automation | [Playwright](https://playwright.dev/) (Chromium) |
| Frontend | Vanilla HTML/CSS/JS (dark theme) |
| State | JSON file persistence |

## Contributing

Contributions welcome! Open an issue or submit a PR.

```bash
# Development
git clone https://github.com/Daim-Zia/insta-unfollow.git
cd insta-unfollow
npm install
npx playwright install chromium
npm start
```

## License

[MIT](LICENSE) — use it however you want.

## Star History

If this saved you hours of manually unfollowing people, give it a star — it helps others find it.

<p align="center">
  <a href="https://github.com/Daim-Zia/insta-unfollow/stargazers">
    <img src="https://img.shields.io/github/stars/Daim-Zia/insta-unfollow?style=social" alt="Star this repo">
  </a>
</p>

---

<p align="center">
  Built with care. Use responsibly. Don't blame me if Instagram gets grumpy.
</p>
