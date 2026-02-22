# 🛠️ Sentry Autopilot (MCP App)
**AI agent that turns Sentry crashes into PRs.**

The lightweight **MCP app** that sits between **Sentry → GitHub → your repo** and removes the busywork of fixing recurring crashes.

## Why it exists
Most Sentry issues are not “hard” — they’re just **time-expensive**:
open Sentry → read stacktrace → find file → reproduce mentally → patch → open PR.

This tool collapses that loop into one place: **chat + a Fix button**.

## What it does
- Watches Sentry for new crashes
- Pulls full context (stacktrace, breadcrumbs, tags, release, user impact)
- Fetches the exact code from GitHub (suspect files + nearby context)
- Generates a suggested fix + diff
- Lets you ship it as a PR (or file an issue) in one click

## MCP tools


## Quick start
1. **Install:** `npm install`
2. **Configure:** add `SENTRY_TOKEN` + `GITHUB_TOKEN` to `.env`
3. **Run:** `npm run dev`
4. **Try:** “Check Sentry and propose fixes”
