# Insta-Unfollow

Mass unfollow Instagram non-followers using browser automation. Log in with your Instagram account, and the app will automatically unfollow users who don't follow you back.

![Screenshot](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

## Features

- **Browser-based login** — Log in through Instagram's real login page (credentials never leave your browser)
- **Automatic unfollowing** — Identifies and unfollows non-followers using Instagram's Following dialog
- **Rate limiting** — Configurable hourly and daily limits to avoid action blocks
- **Real-time progress** — Live dashboard with progress bar and activity log
- **Session persistence** — Stay logged in between sessions (no re-login needed)
- **Pause/Resume** — Full control over the unfollowing process

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/insta-unfollow.git
cd insta-unfollow
npm install
npx playwright install chromium
```

### Usage

```bash
npm start
```

Open **http://localhost:3456** in your browser.

1. Click **Login with Instagram** — a browser window will open
2. Log in to your Instagram account in the browser window
3. Once logged in, the browser window closes and the dashboard loads
4. Click **Scan** to preview how many non-followers you have
5. Adjust settings (hourly limit, delays, etc.)
6. Click **Start Unfollowing**

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Hourly Limit | 200 | Max unfollows per rolling 60 minutes |
| Daily Limit | 1000 | Max unfollows per rolling 24 hours |
| Min Delay | 4 sec | Minimum pause between unfollows |
| Max Delay | 7 sec | Maximum pause between unfollows |
| Break Every | 60 | Take a longer break after N unfollows |
| Break Duration | 1 min | Length of break (minutes) |

### Recommended Settings

**Safe** (low risk of action block):
- Hourly: 100, Daily: 500, Delay: 6-10s, Break every 40

**Moderate**:
- Hourly: 200, Daily: 1000, Delay: 4-7s, Break every 60

**Aggressive** (higher risk):
- Hourly: 300+, Daily: 2000, Delay: 2-4s, Break every 80

## How It Works

1. Uses [Playwright](https://playwright.dev/) to automate a real Chromium browser
2. Logs into Instagram through the official login page (no API keys needed)
3. Fetches your following and followers lists via Instagram's API
4. Computes the difference (non-followers)
5. Opens the Following dialog on your profile and uses the search box to find each non-follower
6. Clicks the Following button → Unfollow → Confirm for each account
7. Respects rate limits with configurable delays and breaks

## Data & Privacy

- **Credentials never leave your machine** — You log in directly through Instagram's website in a real browser window
- **Session stored locally** — Login session is saved in `./session/` directory
- **Progress saved locally** — Unfollow history is saved in `./state/progress.json`
- **No data sent to external servers** — Everything runs locally on your machine

## Troubleshooting

**"Action blocked" or "5 consecutive failures"**
- Instagram temporarily blocked unfollowing. Stop the app and wait a few hours before retrying.
- Use lower rate limits to avoid this.

**Login window doesn't appear**
- Make sure Playwright's Chromium is installed: `npx playwright install chromium`

**Script crashes mid-run**
- Your progress is saved. Just run `npm start` again — it will resume from where it left off.

## Tech Stack

- **Backend**: Node.js, Express, WebSocket
- **Automation**: Playwright (Chromium)
- **Frontend**: Vanilla HTML/CSS/JS

## License

MIT
