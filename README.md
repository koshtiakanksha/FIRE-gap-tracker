# FIRE Gap Tracker

A financial independence simulation dashboard that models FIRE timelines, required investments, portfolio growth, and scenario-based tradeoffs using compound growth calculations and interactive visualizations — now with inflation-adjusted projections and a conservative/base/optimistic return range.

[Link](https://fire-gap-tracker.vercel.app/)

**Know your number. Know the gap.**

> For educational planning only, not financial advice.

---

## Overview

FIRE Gap Tracker turns a small set of financial inputs into a clear FIRE (Financial Independence, Retire Early) roadmap. It answers one question well:

> "How far am I from financial independence, and what needs to change to get there faster?"

This is not a budgeting app, and it's not a full financial planning suite. It's a lightweight, single-page decision-support tool — the kind of thing you'd open once a month to sanity-check your plan, not something that asks you to log every transaction.

**Phase 1** moves the app from a single, overly-precise retirement age to a more honest picture: expenses (and the FIRE number itself) now grow with inflation over the full projection, and every timeline is shown as a conservative/base/optimistic range instead of one number that implies more certainty than the underlying assumptions support.

## Problem solved

Most people pursuing FIRE end up with their plan scattered across a mental estimate, a spreadsheet they built once and forgot to update, and a vague sense of "I think I'm on track." FIRE Gap Tracker consolidates the core FIRE math — your number, your progress, your timeline, and the levers that move it — into one live dashboard that recalculates instantly as assumptions change, and now shows that timeline as a realistic range rather than a single point estimate.

## Product positioning

FIRE Gap Tracker is built and described as a **financial independence simulation dashboard**, not a calculator. The distinction matters: a calculator gives you one answer. This app shows you three portfolio growth trajectories at once, an inflating FIRE-number target line they're all racing toward, and lets you pressure-test the plan against three realistic changes — without ever pretending to be more precise than the underlying assumptions allow.

## Features

- **One-page dashboard** — header, input panel, output metric cards, progress bar, multi-path growth chart, FIRE age range cards, gap summary, and scenario comparisons, all on a single responsive screen.
- **Eight required inputs** — current age, target FIRE age, current invested assets, annual expenses, monthly investment, expected annual return, safe withdrawal rate, and inflation rate. One optional input (annual income, for reference only).
- **Inflation-adjusted modeling** — annual expenses (and therefore the FIRE number) compound with inflation every month over the full projection, not as a single end-of-period multiplication. The dashboard shows both:
  - **FIRE number, today's dollars** — what you'd need if you retired today.
  - **FIRE number, future dollars** — what that same lifestyle is projected to cost by your target FIRE age, after inflation.
- **Conservative / base / optimistic return paths** — every timeline (years to FIRE, estimated FIRE age) is calculated three times: at your expected return minus 2 points, at your expected return exactly, and at your expected return plus 2 points. Returns are floored at 0% for the conservative and base paths so a low input doesn't get pushed into a confusing more-negative number.
- **FIRE age range cards** — conservative, base, and optimistic FIRE ages displayed side by side, each showing "Not reached" instead of a broken or misleadingly precise number when a path doesn't cross the FIRE number within 100 years.
- **Multi-line growth chart** — conservative, base, and optimistic portfolio paths plotted together against a dashed gold line showing the inflating FIRE number in future dollars, with a legend and mobile-readable labels.
- **"What Moves the Needle"** — three dynamic, real-calculation comparisons: investing $500/month more, reducing annual expenses by $5,000, and modeling returns 2% lower. Every number here is computed live from your actual inputs, not hardcoded.
- **Scenario persistence** — inputs autosave to `localStorage` as you type, so refreshing the page never loses your plan. Scenarios saved before Phase 1 (missing an inflation rate) load cleanly and default to 3%.
- **Reset to sample** — one click restores realistic example values.
- **Export/import as JSON** — download your scenario as a portable file, or import one back in, with full validation and friendly error messages for malformed files. Older exported files without an inflation rate import cleanly with the same 3% default.
- **Defensive edge-case handling** — see [Edge cases handled](#edge-cases-handled) below. No NaN, no Infinity, no blank cards, no crashes.

## Tech stack

- [Vite](https://vite.dev/) — build tool and dev server
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI and type safety
- [Tailwind CSS v4](https://tailwindcss.com/) — styling, via the official Vite plugin
- [Recharts](https://recharts.org/) — the multi-path portfolio growth chart
- `localStorage` — the only persistence layer; no backend, no database, no auth

No new dependencies were added in Phase 1 — the inflation and return-range modeling is implemented with plain TypeScript and the existing Recharts `ComposedChart`/`Line`/`Area` components already in use.

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

All formulas live in `src/lib/fireCalculations.ts` as pure, dependency-free, individually testable functions.

**FIRE Number (today's dollars)**
```
FIRE Number = Annual Expenses / Safe Withdrawal Rate
```

**Inflation-adjusted expenses at a future point in time** — `calculateInflationAdjustedExpenses`
```
monthly_inflation = inflation_rate / 12
expenses_at_month_N = annual_expenses_today * (1 + monthly_inflation)^N
```
Expenses compound every month over the full projection — this is never a single end-of-period multiplication.

**FIRE number in future dollars** — `calculateFutureFireNumber`
```
future_fire_number(N) = inflation-adjusted expenses at month N / Safe Withdrawal Rate
```

**Current Progress** (measured against today's-dollars FIRE number, not the inflating one)
```
Progress % = Current Invested Assets / FIRE Number (today's $)
```

**Future Portfolio Value (monthly compounding)** — `calculateFutureValue` / `calculateProjectionPath`
```
monthly_return = annual_return / 12
months = years * 12

FV = current_assets * (1 + monthly_return)^months
   + monthly_contribution * (((1 + monthly_return)^months - 1) / monthly_return)
```
When `monthly_return` is exactly 0, this is handled as a separate linear case (contributions simply add up with no compounding) to avoid dividing by zero.

**Conservative / base / optimistic return paths** — `calculateReturnRangePaths`
```
conservative = max(0, expected_return - 2 points)
base         = expected_return
optimistic   = expected_return + 2 points
```

**Years to FIRE, per path** — `calculateFireAgeForPath` / `findMonthsToFire`

A month-by-month loop grows the portfolio at that path's return AND recomputes the inflating FIRE number at every step, stopping the moment the portfolio crosses whatever the target has grown to by that month. Capped at 100 years. This loop-based approach (rather than a closed-form solve) is what correctly handles an inflating target plus zero and negative return assumptions without a second code path.

**Required Monthly Investment** (to hit your chosen target FIRE age, inflation-adjusted)

With a fixed target this has a clean algebraic solution. Once the target itself grows every month, there's no closed form — so this is solved numerically via binary search over the monthly contribution amount, checking the same month-by-month walk used everywhere else against the inflated target at the target month. If the result would be negative — meaning you're already on pace to beat your target age — the app shows $0 rather than a negative number.

## Edge cases handled

- Safe withdrawal rate cannot be 0 or negative
- Annual expenses must be greater than $0
- Monthly investment cannot be negative
- Target FIRE age must be greater than current age
- Inflation rate cannot be empty, negative, or above 10% — with a friendly, field-specific error message
- Expected return can be 0% (handled as a separate linear-growth case)
- Expected return can be low or negative without breaking any calculation or chart; conservative/base return paths floor at 0% rather than going further negative
- Current assets can be $0
- "Already financially independent" is detected and shown in place of a timeline, per return path
- "Not reached" is shown (not a broken or misleadingly precise number) when a return path doesn't cross the FIRE number within 100 years
- Required monthly investment floors at $0 instead of going negative
- Old saved/imported scenarios missing an inflation rate default to 3% instead of failing validation or crashing
- Imported JSON scenarios are structurally validated before being applied, with specific error messages for invalid files
- No `NaN`, no `Infinity`, no blank cards, and no chart rendering errors reach the UI under any input combination, including very high expenses, very low monthly investment, or a 100-year-unreachable plan

## Today's dollars vs. future dollars

Today's dollars show the value in current spending power. Future dollars include inflation and estimate how much the same lifestyle may cost later. The dashboard labels every figure with one or the other so it's never ambiguous which one you're looking at.

## Screenshots

_Add screenshots of the dashboard here before publishing — e.g. a full-page desktop view, the multi-path growth chart, and a mobile input-panel view._

`docs/screenshot-desktop.png`
`docs/screenshot-mobile.png`
`docs/screenshot-chart.png`

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

- **Inflation grows expenses monthly, compounding over the full projection.** It is never applied as a single multiplication at the end. The FIRE number itself is therefore a moving target in every timeline search.
- **Conservative and base return paths floor at 0%.** A user entering a very low expected return won't see the conservative path go further negative — it's product-level flooring, not a math necessity (the underlying engine handles negative returns safely on its own).
- **Returns within each path are a single constant annual rate**, compounded monthly. Real markets are far lumpier than this, and don't move in three discrete lanes — the chart's footer text says as much.
- **Annual income is collected but not used** in any calculation — it's there for the user's own reference only, per the spec.
- **"Years to FIRE" uses a 100-year search cap per return path.** Beyond that, each path independently reports "Not reached" rather than searching indefinitely.
- **The required-monthly-investment figure can floor at $0** but is also flagged as potentially unreachable if no contribution amount, however large, would close the (inflating) gap by the target age.
- **Old data migrates forward automatically.** Any saved or imported scenario missing an inflation rate is treated as 3% rather than rejected.

## Limitations

- This is still an educational simulator, not financial advice.
- Taxes and account types (e.g. tax-advantaged vs. taxable accounts) are not modeled.
- Monte Carlo simulation (randomized year-to-year returns) is not included — the three return paths are fixed constant-rate scenarios, not a probability distribution.
- FIRE variants (Coast FIRE, Barista FIRE, Lean/Fat FIRE) are not modeled.

## Future improvements

Intentionally **not** built in this phase, to keep scope tight:

- Multiple saved scenarios (currently: one active scenario at a time)
- Coast FIRE / Barista FIRE modeling
- Lean FIRE / Fat FIRE presets
- Tax drag modeling
- Monte Carlo simulation (variable, randomized returns instead of three fixed paths)
- Account login / cloud scenario storage

## Why I built this

I wanted a small, focused project that exercises real financial modeling logic (not just CRUD), a polished interactive chart, and genuine engineering discipline around edge cases — without scope-creeping into a full personal finance platform. Phase 1 pushed that discipline further: modeling inflation as a genuinely compounding process rather than a single end-of-period fudge, and replacing one falsely precise number with an honest range, are both small changes in scope but real changes in how trustworthy the output feels.

---

## Project structure

```
src/
  components/
    InputPanel.tsx        — all eight (+1 optional) input fields, including inflation rate
    MetricCard.tsx          — reusable output card + FIRE gap summary card
    ProgressBar.tsx         — progress bar toward today's-dollars FIRE number
    GrowthChart.tsx          — Recharts multi-line chart: conservative/base/optimistic + inflating FIRE target
    ReturnPathCards.tsx      — conservative / base / optimistic FIRE age cards
    WhatMovesNeedle.tsx      — the three dynamic scenario comparison cards
    ScenarioActions.tsx      — reset / export / import controls
  lib/
    fireCalculations.ts      — every FIRE formula, including inflation and return-path logic, as pure functions
    formatters.ts            — currency / percent / years / path-FIRE-age display formatting
    validation.ts            — input validation rules, including inflation rate
    scenarioStorage.ts        — localStorage autosave + JSON export/import + old-data migration
  types/
    fire.ts                  — FireInputs, FireResults, ReturnPathResult, CombinedProjectionPoint, etc.
  App.tsx
  main.tsx
  index.css
```
