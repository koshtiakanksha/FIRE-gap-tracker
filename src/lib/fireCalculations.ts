/**
 * Pure financial calculations for the FIRE Gap Tracker.
 *
 * Every function here is deterministic and side-effect free: given the same
 * inputs, you always get the same outputs. No UI concerns, no localStorage,
 * no formatting. That separation is what makes these safe to reuse for both
 * the main dashboard and the "What Moves the Needle" comparisons.
 *
 * Phase 1 adds two things on top of the original single-line model:
 *
 * 1. Inflation-adjusted expenses and FIRE number. The FIRE number is no
 *    longer a fixed target — it grows every month as expenses inflate, so
 *    "years to FIRE" is really "years until the portfolio outruns a moving
 *    target." We never multiply the FIRE number by an inflation factor a
 *    single time; expenses (and therefore the FIRE number) compound monthly
 *    over the full projection, exactly like the portfolio does.
 *
 * 2. Conservative / base / optimistic return paths. The same inflating
 *    target is checked against three different return assumptions so a
 *    user sees a range, not one falsely precise number.
 *
 * A note on precision: this app is directional, not predictive. Markets
 * don't return a smooth annual rate every year, and nobody's expenses are
 * perfectly flat. These formulas answer "roughly how far, roughly how long,
 * under a few different assumptions," which is exactly what a FIRE gap
 * tracker should promise — and no more.
 */

import type {
  CombinedProjectionPoint,
  FireInputs,
  FireResults,
  ProjectionPoint,
  ReturnPathKey,
  ReturnPathResult,
  ScenarioComparison,
} from "../types/fire";

/** Cap on how far into the future we'll search for a FIRE date. */
const MAX_YEARS_TO_SEARCH = 100;

/** How many percentage points conservative/optimistic sit away from the base return. */
const RETURN_PATH_SPREAD_PCT = 2;

/**
 * FIRE Number = Annual Expenses / Safe Withdrawal Rate
 *
 * This is the portfolio size that, withdrawn at the chosen safe rate,
 * covers annual expenses indefinitely (the "4% rule" and its relatives).
 * Always computed in TODAY'S dollars — inflation is layered on separately
 * by calculateFutureFireNumber, never baked into this function.
 */
export function calculateFireNumber(annualExpenses: number, safeWithdrawalRatePct: number): number {
  const rate = safeWithdrawalRatePct / 100;
  if (rate <= 0) return Infinity;
  return annualExpenses / rate;
}

/**
 * Progress % = Current Invested Assets / FIRE Number
 *
 * Always measured against today's-dollars FIRE number — progress is about
 * where you stand right now, not a future, inflated target.
 */
export function calculateProgressPct(currentAssets: number, fireNumberToday: number): number {
  if (!isFinite(fireNumberToday) || fireNumberToday <= 0) return 0;
  const pct = (currentAssets / fireNumberToday) * 100;
  return Math.max(0, pct);
}

/**
 * Inflation-adjusted annual expenses at a future point in time.
 *
 * expenses_at_year = annual_expenses * (1 + inflation)^years
 *
 * Compounds annually-equivalent growth using a monthly rate under the hood
 * (via the `months` parameter) so this lines up exactly with the monthly
 * projection loop elsewhere in this file — no separate annual vs. monthly
 * rounding to reconcile.
 */
export function calculateInflationAdjustedExpenses(
  annualExpensesToday: number,
  inflationPct: number,
  months: number,
): number {
  if (months <= 0) return annualExpensesToday;
  const monthlyInflation = inflationPct / 100 / 12;
  if (monthlyInflation === 0) return annualExpensesToday;
  return annualExpensesToday * Math.pow(1 + monthlyInflation, months);
}

/**
 * The FIRE number restated in future dollars at a given point in time —
 * i.e. what your FIRE number will actually be once inflation has grown
 * your expenses for `months` months.
 *
 * future_fire_number = (annual_expenses_today * (1 + inflation)^years) / SWR
 */
export function calculateFutureFireNumber(
  annualExpensesToday: number,
  inflationPct: number,
  safeWithdrawalRatePct: number,
  months: number,
): number {
  const inflatedExpenses = calculateInflationAdjustedExpenses(annualExpensesToday, inflationPct, months);
  return calculateFireNumber(inflatedExpenses, safeWithdrawalRatePct);
}

/**
 * Future Value via monthly compounding, for a single month step. Exposed
 * as a small helper so the month-by-month loops below all grow the
 * portfolio the same way.
 *
 * balance_next = balance * (1 + monthly_return) + monthly_contribution
 */
function stepBalanceOneMonth(balance: number, monthlyContribution: number, monthlyReturn: number): number {
  return monthlyReturn === 0 ? balance + monthlyContribution : balance * (1 + monthlyReturn) + monthlyContribution;
}

/**
 * Future Value via monthly compounding, closed form — used where we want a
 * single point-in-time answer rather than a month-by-month walk (e.g. the
 * required-contribution solver's inner evaluation).
 *
 * FV = current_assets * (1 + monthly_return)^months
 *    + monthly_contribution * (((1 + monthly_return)^months - 1) / monthly_return)
 *
 * When the monthly return is exactly 0, the growth-factor term above divides
 * by zero, so that case is handled on its own: contributions simply add up
 * linearly with no compounding.
 */
export function calculateFutureValue(
  currentAssets: number,
  monthlyContribution: number,
  annualReturnPct: number,
  months: number,
): number {
  const monthlyReturn = annualReturnPct / 100 / 12;

  if (months <= 0) return currentAssets;

  if (monthlyReturn === 0) {
    return currentAssets + monthlyContribution * months;
  }

  const growthFactor = Math.pow(1 + monthlyReturn, months);
  const principalGrowth = currentAssets * growthFactor;
  const contributionGrowth = monthlyContribution * ((growthFactor - 1) / monthlyReturn);
  return principalGrowth + contributionGrowth;
}

/** Result of the month-by-month search for when the portfolio crosses the (inflating) FIRE number. */
interface TimelineSearchResult {
  status: "on-track" | "already-fi" | "unreachable";
  months: number | null;
}

/**
 * Years to FIRE, against an INFLATING target: loop month by month, growing
 * both the portfolio and the FIRE number, until the portfolio value
 * crosses whatever the FIRE number has grown to by that month.
 *
 * This is the key Phase 1 change to the timeline search: previously the
 * target was fixed; now calculateFutureFireNumber recomputes it at every
 * step so expenses are genuinely compounding over time, not multiplied
 * once at the end.
 *
 * Capped at MAX_YEARS_TO_SEARCH so a bad combination of inputs (e.g. a
 * negative return with a small contribution and high inflation) can't loop
 * unbounded.
 */
export function findMonthsToFire(
  currentAssets: number,
  monthlyContribution: number,
  annualReturnPct: number,
  annualExpensesToday: number,
  inflationPct: number,
  safeWithdrawalRatePct: number,
): TimelineSearchResult {
  const fireNumberToday = calculateFireNumber(annualExpensesToday, safeWithdrawalRatePct);

  if (!isFinite(fireNumberToday)) {
    return { status: "unreachable", months: null };
  }

  if (currentAssets >= fireNumberToday) {
    return { status: "already-fi", months: 0 };
  }

  const monthlyReturn = annualReturnPct / 100 / 12;
  const maxMonths = MAX_YEARS_TO_SEARCH * 12;

  let balance = currentAssets;
  for (let month = 1; month <= maxMonths; month++) {
    balance = stepBalanceOneMonth(balance, monthlyContribution, monthlyReturn);
    const targetAtThisMonth = calculateFutureFireNumber(
      annualExpensesToday,
      inflationPct,
      safeWithdrawalRatePct,
      month,
    );

    if (balance >= targetAtThisMonth) {
      return { status: "on-track", months: month };
    }
  }

  return { status: "unreachable", months: null };
}

/**
 * Required Contribution to hit the user's target FIRE age, against an
 * inflating target.
 *
 * With a fixed target this has a clean algebraic solution (Phase 0's
 * approach). Once the target itself grows every month, there's no closed
 * form anymore — so this solves numerically via binary search over the
 * monthly contribution amount, checking the same month-by-month walk used
 * everywhere else. This keeps exactly one definition of "how the portfolio
 * grows" and one definition of "how the target grows" in the whole app.
 *
 * Floors negative/zero results at $0 — meaning the user is already on pace
 * to beat their target age with no required change.
 */
export function calculateRequiredMonthlyInvestment(
  currentAssets: number,
  annualExpensesToday: number,
  inflationPct: number,
  safeWithdrawalRatePct: number,
  annualReturnPct: number,
  monthsToTarget: number,
): { amount: number; reachable: boolean } {
  const fireNumberToday = calculateFireNumber(annualExpensesToday, safeWithdrawalRatePct);

  if (monthsToTarget <= 0) {
    // Target age is already here or in the past — nothing meaningful to solve for.
    return { amount: 0, reachable: currentAssets >= fireNumberToday };
  }

  const monthlyReturn = annualReturnPct / 100 / 12;

  // Helper: does a given monthly contribution get the portfolio to (or past)
  // the inflated target by monthsToTarget?
  function reachesTargetWith(monthlyContribution: number): boolean {
    let balance = currentAssets;
    for (let month = 1; month <= monthsToTarget; month++) {
      balance = stepBalanceOneMonth(balance, monthlyContribution, monthlyReturn);
    }
    const targetAtEnd = calculateFutureFireNumber(
      annualExpensesToday,
      inflationPct,
      safeWithdrawalRatePct,
      monthsToTarget,
    );
    return balance >= targetAtEnd;
  }

  // Already there with $0/month? Floor at $0 immediately.
  if (reachesTargetWith(0)) {
    return { amount: 0, reachable: true };
  }

  // Find an upper bound the search can binary-search under. Doubling avoids
  // needing to guess a "big enough" number for any combination of inputs.
  let upperBound = 100;
  let safetyCounter = 0;
  while (!reachesTargetWith(upperBound) && safetyCounter < 40) {
    upperBound *= 2;
    safetyCounter += 1;
  }

  if (!reachesTargetWith(upperBound)) {
    // Even an enormous monthly contribution can't outrun this target —
    // happens with very high inflation and very little time.
    return { amount: 0, reachable: false };
  }

  let low = 0;
  let high = upperBound;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (reachesTargetWith(mid)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return { amount: Math.max(0, high), reachable: true };
}

/**
 * Builds a month-by-month projection for ONE return assumption, against a
 * fixed (non-inflating) starting balance walk. Used as the building block
 * for both the single-path projections and the combined chart series.
 */
export function generateProjection(
  currentAge: number,
  currentAssets: number,
  monthlyContribution: number,
  annualReturnPct: number,
  totalMonths: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  const monthlyReturn = annualReturnPct / 100 / 12;

  let balance = currentAssets;
  points.push({ month: 0, age: currentAge, value: balance });

  for (let month = 1; month <= totalMonths; month++) {
    balance = stepBalanceOneMonth(balance, monthlyContribution, monthlyReturn);
    points.push({ month, age: currentAge + month / 12, value: balance });
  }

  return points;
}

/**
 * Conservative / base / optimistic annual return assumptions, derived from
 * the user's single expected-return input.
 *
 * - Conservative: expected return - 2 points
 * - Base: expected return, unchanged
 * - Optimistic: expected return + 2 points
 *
 * Conservative and base are floored at 0% so a low or negative user input
 * doesn't get pushed further negative by subtracting the spread — the
 * underlying month-by-month math already handles 0% and negative returns
 * safely on its own, so this floor is a product choice (showing 0%, not a
 * confusing more-negative number), not a math necessity.
 */
export function calculateReturnRangePaths(expectedReturnPct: number): Record<ReturnPathKey, number> {
  return {
    conservative: Math.max(0, expectedReturnPct - RETURN_PATH_SPREAD_PCT),
    base: expectedReturnPct,
    optimistic: expectedReturnPct + RETURN_PATH_SPREAD_PCT,
  };
}

/**
 * Runs the full timeline search + projection for ONE return path, against
 * the same inflating FIRE number used everywhere else.
 */
export function calculateFireAgeForPath(
  path: ReturnPathKey,
  annualReturnPct: number,
  inputs: FireInputs,
): ReturnPathResult {
  const timeline = findMonthsToFire(
    inputs.currentAssets,
    inputs.monthlyInvestment,
    annualReturnPct,
    inputs.annualExpenses,
    inputs.inflationPct,
    inputs.safeWithdrawalRatePct,
  );

  const yearsToFire = timeline.months !== null ? timeline.months / 12 : null;
  const estimatedFireAge = yearsToFire !== null ? inputs.currentAge + yearsToFire : null;

  const projectionMonths =
    timeline.status === "on-track" && timeline.months !== null
      ? Math.min(timeline.months + 12, MAX_YEARS_TO_SEARCH * 12)
      : Math.max((inputs.targetFireAge - inputs.currentAge) * 12, 30 * 12);

  const projection = generateProjection(
    inputs.currentAge,
    inputs.currentAssets,
    inputs.monthlyInvestment,
    annualReturnPct,
    projectionMonths,
  );

  return {
    path,
    annualReturnPct,
    timelineStatus: timeline.status,
    yearsToFire,
    estimatedFireAge,
    projection,
  };
}

/**
 * Builds the combined chart series: all three return paths plus the
 * inflating FIRE target, aligned month-by-month so Recharts can plot all
 * four lines against one shared X axis. Runs out to the longest of the
 * three individual projections so no line gets cut off early.
 */
function buildCombinedProjection(
  inputs: FireInputs,
  returnPaths: Record<ReturnPathKey, ReturnPathResult>,
): CombinedProjectionPoint[] {
  const longestMonths = Math.max(
    returnPaths.conservative.projection.length - 1,
    returnPaths.base.projection.length - 1,
    returnPaths.optimistic.projection.length - 1,
  );

  const points: CombinedProjectionPoint[] = [];
  const returns = {
    conservative: returnPaths.conservative.annualReturnPct / 100 / 12,
    base: returnPaths.base.annualReturnPct / 100 / 12,
    optimistic: returnPaths.optimistic.annualReturnPct / 100 / 12,
  };

  let balances = {
    conservative: inputs.currentAssets,
    base: inputs.currentAssets,
    optimistic: inputs.currentAssets,
  };

  points.push({
    month: 0,
    age: inputs.currentAge,
    conservative: balances.conservative,
    base: balances.base,
    optimistic: balances.optimistic,
    fireTarget: calculateFutureFireNumber(inputs.annualExpenses, inputs.inflationPct, inputs.safeWithdrawalRatePct, 0),
  });

  for (let month = 1; month <= longestMonths; month++) {
    balances = {
      conservative: stepBalanceOneMonth(balances.conservative, inputs.monthlyInvestment, returns.conservative),
      base: stepBalanceOneMonth(balances.base, inputs.monthlyInvestment, returns.base),
      optimistic: stepBalanceOneMonth(balances.optimistic, inputs.monthlyInvestment, returns.optimistic),
    };

    points.push({
      month,
      age: inputs.currentAge + month / 12,
      conservative: balances.conservative,
      base: balances.base,
      optimistic: balances.optimistic,
      fireTarget: calculateFutureFireNumber(
        inputs.annualExpenses,
        inputs.inflationPct,
        inputs.safeWithdrawalRatePct,
        month,
      ),
    });
  }

  return points;
}

/**
 * Runs the full calculation pipeline for one set of inputs and returns
 * everything the dashboard needs to render. This is the single entry point
 * both the main dashboard and the comparison cards call, so they can never
 * drift out of sync with each other.
 */
export function calculateFireResults(inputs: FireInputs): FireResults {
  const fireNumberToday = calculateFireNumber(inputs.annualExpenses, inputs.safeWithdrawalRatePct);

  const monthsToTarget = Math.max(0, (inputs.targetFireAge - inputs.currentAge) * 12);
  const fireNumberAtTargetAge = calculateFutureFireNumber(
    inputs.annualExpenses,
    inputs.inflationPct,
    inputs.safeWithdrawalRatePct,
    monthsToTarget,
  );

  const progressPct = calculateProgressPct(inputs.currentAssets, fireNumberToday);
  const fireGap = Math.max(0, fireNumberToday - inputs.currentAssets);

  const returnPcts = calculateReturnRangePaths(inputs.expectedReturnPct);
  const returnPaths: Record<ReturnPathKey, ReturnPathResult> = {
    conservative: calculateFireAgeForPath("conservative", returnPcts.conservative, inputs),
    base: calculateFireAgeForPath("base", returnPcts.base, inputs),
    optimistic: calculateFireAgeForPath("optimistic", returnPcts.optimistic, inputs),
  };

  const required = calculateRequiredMonthlyInvestment(
    inputs.currentAssets,
    inputs.annualExpenses,
    inputs.inflationPct,
    inputs.safeWithdrawalRatePct,
    inputs.expectedReturnPct,
    monthsToTarget,
  );

  const combinedProjection = buildCombinedProjection(inputs, returnPaths);

  return {
    fireNumberToday,
    fireNumberAtTargetAge,
    progressPct,
    timelineStatus: returnPaths.base.timelineStatus,
    yearsToFire: returnPaths.base.yearsToFire,
    estimatedFireAge: returnPaths.base.estimatedFireAge,
    fireGap,
    requiredMonthlyInvestment: required.amount,
    requiredContributionReachable: required.reachable,
    returnPaths,
    combinedProjection,
  };
}

/**
 * "What Moves the Needle" — three dynamic comparisons against the user's
 * current plan. Each one re-runs the same calculateFireResults pipeline with
 * one input nudged, so the numbers are always real, never hardcoded.
 *
 * These compare BASE-case timelines before and after the nudge — inflation
 * and the conservative/optimistic spread apply equally to both sides of
 * each comparison, so the difference shown is purely the effect of the
 * lever being pulled.
 */
export function calculateScenarioComparisons(inputs: FireInputs, baseline: FireResults): ScenarioComparison[] {
  return [
    buildInvestMoreComparison(inputs, baseline),
    buildSpendLessComparison(inputs, baseline),
    buildLowerReturnsComparison(inputs, baseline),
  ];
}

function yearsBetween(baselineYears: number | null, alternateYears: number | null): number | null {
  if (baselineYears === null || alternateYears === null) return null;
  return baselineYears - alternateYears;
}

function buildInvestMoreComparison(inputs: FireInputs, baseline: FireResults): ScenarioComparison {
  const adjusted: FireInputs = { ...inputs, monthlyInvestment: inputs.monthlyInvestment + 500 };
  const result = calculateFireResults(adjusted);

  if (baseline.timelineStatus === "already-fi") {
    return {
      id: "invest-more",
      title: "Invest $500/month more",
      description: "An extra $500 a month toward your portfolio.",
      resultText: "You're already financially independent, so this lever has nothing left to move.",
      direction: "neutral",
    };
  }

  if (result.timelineStatus !== "on-track" || baseline.timelineStatus !== "on-track") {
    return {
      id: "invest-more",
      title: "Invest $500/month more",
      description: "An extra $500 a month toward your portfolio.",
      resultText: "Still not reachable within 100 years, even with the extra contribution.",
      direction: "neutral",
      unavailableReason: "not-reachable",
    };
  }

  const diff = yearsBetween(baseline.yearsToFire, result.yearsToFire);
  if (diff === null) {
    return {
      id: "invest-more",
      title: "Invest $500/month more",
      description: "An extra $500 a month toward your portfolio.",
      resultText: "Not enough information to compare.",
      direction: "neutral",
      unavailableReason: "incomplete",
    };
  }

  return {
    id: "invest-more",
    title: "Invest $500/month more",
    description: "An extra $500 a month toward your portfolio.",
    resultText:
      diff > 0.05
        ? `FIRE arrives ${formatYears(diff)} sooner.`
        : "Makes little to no difference at this point in your plan.",
    direction: diff > 0.05 ? "positive" : "neutral",
  };
}

function buildSpendLessComparison(inputs: FireInputs, baseline: FireResults): ScenarioComparison {
  const reducedExpenses = Math.max(0, inputs.annualExpenses - 5000);
  const adjusted: FireInputs = { ...inputs, annualExpenses: reducedExpenses };
  const result = calculateFireResults(adjusted);

  const fireNumberDrop = baseline.fireNumberToday - result.fireNumberToday;

  if (inputs.annualExpenses <= 5000) {
    return {
      id: "spend-less",
      title: "Reduce annual expenses by $5,000",
      description: "Trim $5,000/year from your cost of living.",
      resultText: "Your expenses are already too low for this comparison to apply.",
      direction: "neutral",
      unavailableReason: "expenses-too-low",
    };
  }

  let timelineText: string;
  if (baseline.timelineStatus === "already-fi") {
    timelineText = "You're already financially independent.";
  } else if (result.timelineStatus === "on-track" && baseline.timelineStatus === "on-track") {
    const diff = yearsBetween(baseline.yearsToFire, result.yearsToFire);
    timelineText = diff !== null && diff > 0.05
      ? ` Your timeline shortens by ${formatYears(diff)}.`
      : " Your timeline barely changes.";
  } else if (result.timelineStatus === "on-track" && baseline.timelineStatus !== "on-track") {
    timelineText = " This alone makes FIRE reachable within 100 years.";
  } else {
    timelineText = "";
  }

  return {
    id: "spend-less",
    title: "Reduce annual expenses by $5,000",
    description: "Trim $5,000/year from your cost of living.",
    resultText: `Your FIRE number drops by ${formatCurrencyPlain(fireNumberDrop)}.${timelineText}`,
    direction: fireNumberDrop > 0 ? "positive" : "neutral",
  };
}

function buildLowerReturnsComparison(inputs: FireInputs, baseline: FireResults): ScenarioComparison {
  const adjusted: FireInputs = { ...inputs, expectedReturnPct: inputs.expectedReturnPct - 2 };
  const result = calculateFireResults(adjusted);

  if (baseline.timelineStatus === "already-fi") {
    return {
      id: "lower-returns",
      title: "Returns are 2% lower",
      description: "Model a more conservative annual return.",
      resultText: "You're already financially independent, so future returns don't change that.",
      direction: "neutral",
    };
  }

  if (baseline.timelineStatus !== "on-track") {
    return {
      id: "lower-returns",
      title: "Returns are 2% lower",
      description: "Model a more conservative annual return.",
      resultText: "Your current plan already isn't reachable within 100 years — lower returns won't help.",
      direction: "neutral",
      unavailableReason: "not-reachable",
    };
  }

  if (result.timelineStatus !== "on-track") {
    return {
      id: "lower-returns",
      title: "Returns are 2% lower",
      description: "Model a more conservative annual return.",
      resultText: "At 2% lower returns, FIRE would no longer be reachable within 100 years.",
      direction: "negative",
    };
  }

  const diff = yearsBetween(result.yearsToFire, baseline.yearsToFire);
  if (diff === null) {
    return {
      id: "lower-returns",
      title: "Returns are 2% lower",
      description: "Model a more conservative annual return.",
      resultText: "Not enough information to compare.",
      direction: "neutral",
      unavailableReason: "incomplete",
    };
  }

  return {
    id: "lower-returns",
    title: "Returns are 2% lower",
    description: "Model a more conservative annual return.",
    resultText:
      diff > 0.05
        ? `FIRE is delayed by ${formatYears(diff)}.`
        : "Makes little to no difference at this point in your plan.",
    direction: diff > 0.05 ? "negative" : "neutral",
  };
}

// Small local helpers kept here (rather than formatters.ts) since they're
// only used to build resultText strings inside this module.
function formatYears(years: number): string {
  const rounded = Math.round(years * 10) / 10;
  return rounded === 1 ? "1 year" : `${rounded} years`;
}

function formatCurrencyPlain(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
