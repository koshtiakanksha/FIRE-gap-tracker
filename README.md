# FIRE Gap Tracker

A financial independence simulation dashboard that models FIRE timelines, required investments, portfolio growth, and scenario-based tradeoffs using compound growth calculations and interactive visualizations.

**Know your number. Know the gap.**

> For educational planning only, not financial advice.

---

## Overview

FIRE Gap Tracker turns seven basic financial inputs into a clear FIRE (Financial Independence, Retire Early) roadmap. It answers one question well:

> "How far am I from financial independence, and what needs to change to get there faster?"

This is not a budgeting app, and it's not a full financial planning suite. It's a lightweight, single-page decision-support tool — the kind of thing you'd open once a month to sanity-check your plan, not something that asks you to log every transaction.

## Problem solved

Most people pursuing FIRE end up with their plan scattered across a mental estimate, a spreadsheet they built once and forgot to update, and a vague sense of "I think I'm on track." FIRE Gap Tracker consolidates the core FIRE math — your number, your progress, your timeline, and the levers that move it — into one live dashboard that recalculates instantly as assumptions change.

## Product positioning

FIRE Gap Tracker is built and described as a **financial independence simulation dashboard**, not a calculator. The distinction matters: a calculator gives you one answer. This app shows you a portfolio growth trajectory, lets you see exactly where the FIRE-number finish line sits on that trajectory, and lets you pressure-test the plan against three realistic changes — without ever pretending to be more precise than the underlying assumptions allow.

## Features

- **One-page dashboard** — header, input panel, output metric cards, progress bar, growth chart, gap summary, and scenario comparisons, all on a single responsive screen.
- **Seven required inputs** — current age, target FIRE age, current invested assets, annual expenses, monthly investment, expected annual return, and safe withdrawal rate. One optional input (annual income, for reference only).
- **Six output cards** — FIRE number, current progress %, years to FIRE, estimated FIRE age, required monthly investment to hit your target age, and a plain-language FIRE gap summary.
- **Progress bar** toward your FIRE number.
- **Portfolio growth line/area chart** with a dashed gold reference line marking your FIRE number, mobile-readable axis labels, and a tooltip showing value at any age.
- **"What Moves the Needle"** — three dynamic, real-calculation comparisons: investing $500/month more, reducing annual expenses by $5,000, and modeling returns 2% lower. Every number here is computed live from your actual inputs, not hardcoded.
- **Scenario persistence** — inputs autosave to `localStorage` as you type, so refreshing the page never loses your plan.
- **Reset to sample** — one click restores realistic example values.
- **Export/import as JSON** — download your scenario as a portable file, or import one back in, with full validation and friendly error messages for malformed files.
- **Defensive edge-case handling** — see [Edge cases handled](#edge-cases-handled) below. No NaN, no Infinity, no blank cards, no crashes.

## Tech stack

- [Vite](https://vite.dev/) — build tool and dev server
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI and type safety
- [Tailwind CSS v4](https://tailwindcss.com/) — styling, via the official Vite plugin
- [Recharts](https://recharts.org/) — the portfolio growth chart
- `localStorage` — the only persistence layer; no backend, no database, no auth

## How to run locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (typically `http://localhost:5173`).

## How to build

```bash
npm run build
```

Output is written to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

## Calculation formulas

All formulas live in `src/lib/fireCalculations.ts` as pure, dependency-free functions.

**FIRE Number**
```
FIRE Number = Annual Expenses / Safe Withdrawal Rate
```

**Current Progress**
```
Progress % = Current Invested Assets / FIRE Number
```

**Future Portfolio Value (monthly compounding)**
```
monthly_return = annual_return / 12
months = years * 12

FV = current_assets * (1 + monthly_return)^months
   + monthly_contribution * (((1 + monthly_return)^months - 1) / monthly_return)
```
When `monthly_return` is exactly 0, this is handled as a separate linear case (contributions simply add up with no compounding) to avoid dividing by zero.

**Years to FIRE**

A month-by-month loop adds contributions and growth until the portfolio value crosses the FIRE number, capped at 100 years. This loop-based approach (rather than a closed-form solve) is what correctly handles zero and negative return assumptions without a second code path.

**Required Monthly Investment** (to hit your chosen target FIRE age)
```
Required Contribution =
  (FIRE Number - current_assets * (1 + monthly_return)^months)
  / (((1 + monthly_return)^months - 1) / monthly_return)
```
Handled separately for 0% returns. If the result is negative — meaning you're already on pace to beat your target age — the app shows $0 rather than a negative number.

## Edge cases handled

- Safe withdrawal rate cannot be 0 or negative
- Annual expenses must be greater than $0
- Monthly investment cannot be negative
- Target FIRE age must be greater than current age
- Expected return can be 0% (handled as a separate linear-growth case)
- Expected return can be low or negative without breaking any calculation or chart
- Current assets can be $0
- "Already financially independent" is detected and shown in place of a timeline
- "Not reachable within 100 years" is detected and shown instead of an infinite loop or broken number
- Required monthly investment floors at $0 instead of going negative
- Imported JSON scenarios are structurally validated before being applied, with specific error messages for invalid files
- No `NaN`, no `Infinity`, no blank cards, and no chart rendering errors reach the UI under any input combination

## Screenshots

_Add screenshots of the dashboard here before publishing — e.g. a full-page desktop view and a mobile input-panel view._

`docs/screenshot-desktop.png`
`docs/screenshot-mobile.png`

## Deployment

This is a static site with no backend — it deploys anywhere that serves static files.

**Vercel**
1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.

**Netlify**
1. Push this repo to GitHub.
2. New site from Git → select the repo.
3. Build command: `npm run build`. Publish directory: `dist`.

**GitHub Pages**
1. `npm run build`.
2. Deploy the contents of `dist/` to a `gh-pages` branch (e.g. via the `gh-pages` npm package or a GitHub Action).
3. If hosted at a subpath (e.g. `username.github.io/fire-gap-tracker`), set `base` in `vite.config.ts` accordingly.

## Important assumptions made

- **Inflation is not modeled.** All figures are in today's dollars. The app deliberately does not pretend to adjust for inflation rather than fake a feature — the optional inflation input exists in the data model but isn't wired into any calculation.
- **Returns are treated as a single constant annual rate**, compounded monthly. Real markets are far lumpier than this; the chart's footer text says as much.
- **Annual income is collected but not used** in any calculation — it's there for the user's own reference only, per the spec.
- **"Years to FIRE" uses a 100-year search cap.** Beyond that, the app reports "not reachable" rather than searching indefinitely.
- **The required-monthly-investment figure can floor at $0** but is also flagged as potentially unreachable if even $0 in expenses wouldn't close the gap by the target age (an extreme edge case, but handled rather than silently wrong).

## Future improvements

Intentionally **not** built in this MVP, to keep scope tight:

- Multiple saved scenarios (currently: one active scenario at a time)
- Coast FIRE / Barista FIRE modeling
- Lean FIRE / Fat FIRE presets
- Inflation-adjusted projections
- Tax drag modeling
- Monte Carlo simulation (variable, randomized returns instead of a constant rate)
- Account login / cloud scenario storage

## Why I built this

I wanted a small, focused project that exercises real financial modeling logic (not just CRUD), a polished interactive chart, and genuine engineering discipline around edge cases — without scope-creeping into a full personal finance platform. FIRE Gap Tracker is deliberately narrow: seven inputs, six outputs, one chart, three comparisons. That narrowness is the point — it's what makes the math trustworthy enough to actually use.

---

## Project structure

```
src/
  components/
    InputPanel.tsx        — all seven (+1 optional) input fields
    MetricCard.tsx         — reusable output card + FIRE gap summary card
    ProgressBar.tsx        — progress bar toward the FIRE number
    GrowthChart.tsx         — Recharts area chart with FIRE reference line
    WhatMovesNeedle.tsx     — the three dynamic scenario comparison cards
    ScenarioActions.tsx     — reset / export / import controls
  lib/
    fireCalculations.ts     — every FIRE formula, as pure functions
    formatters.ts           — currency / percent / years display formatting
    validation.ts           — input validation rules
    scenarioStorage.ts       — localStorage autosave + JSON export/import
  types/
    fire.ts                 — FireInputs, FireResults, ProjectionPoint, etc.
  App.tsx
  main.tsx
  index.css
```
