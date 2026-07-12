/**
 * Pure financial calculations for the FIRE Gap Tracker.
 *
 * Every function here is deterministic and side-effect free: given the same
 * inputs, you always get the same outputs. No UI concerns, no localStorage,
 * no formatting. That separation is what makes these safe to reuse for both
 * the main dashboard and the "What Moves the Needle" comparisons.
 *
 * A note on precision: this app is directional, not predictive. Markets
 * don't return a smooth annual rate every year, and nobody's expenses are
 * perfectly flat. These formulas answer "roughly how far, roughly how long,"
 * which is exactly what a FIRE gap tracker should promise — and no more.
 */

import type { FireInputs, FireResults, ProjectionPoint, ScenarioComparison } from "../types/fire";

/** Cap on how far into the future we'll search for a FIRE date. */
const MAX_YEARS_TO_SEARCH = 100;

/**
 * FIRE Number = Annual Expenses / Safe Withdrawal Rate
 *
 * This is the portfolio size that, withdrawn at the chosen safe rate,
 * covers annual expenses indefinitely (the "4% rule" and its relatives).
 */
export function calculateFireNumber(annualExpenses: number, safeWithdrawalRatePct: number): number {
  const rate = safeWithdrawalRatePct / 100;
  if (rate <= 0) return Infinity;
  return annualExpenses / rate;
}

/**
 * Progress % = Current Invested Assets / FIRE Number
 *
 * Clamped to a sane floor at 0 (negative assets aren't a real input we allow,
 * but this keeps the function defensive on its own).
 */
export function calculateProgressPct(currentAssets: number, fireNumber: number): number {
  if (!isFinite(fireNumber) || fireNumber <= 0) return 0;
  const pct = (currentAssets / fireNumber) * 100;
  return Math.max(0, pct);
}

/**
 * Future Value via monthly compounding.
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

/** Result of the month-by-month search for when the portfolio crosses the FIRE number. */
interface TimelineSearchResult {
  status: "on-track" | "already-fi" | "unreachable";
  months: number | null;
}

/**
 * Years to FIRE: loop month by month until portfolio value >= FIRE number.
 *
 * A closed-form solve exists for the positive-return case, but the spec
 * calls for a search loop, and a loop is also what correctly handles
 * negative, zero, and edge-case returns without a second code path.
 * Capped at MAX_YEARS_TO_SEARCH so a bad combination of inputs (e.g. a
 * negative return with a small contribution) can't loop unbounded.
 */
export function findMonthsToFire(
  currentAssets: number,
  monthlyContribution: number,
  annualReturnPct: number,
  fireNumber: number,
): TimelineSearchResult {
  if (!isFinite(fireNumber)) {
    return { status: "unreachable", months: null };
  }

  if (currentAssets >= fireNumber) {
    return { status: "already-fi", months: 0 };
  }

  const monthlyReturn = annualReturnPct / 100 / 12;
  const maxMonths = MAX_YEARS_TO_SEARCH * 12;

  let balance = currentAssets;
  for (let month = 1; month <= maxMonths; month++) {
    balance = monthlyReturn === 0 ? balance + monthlyContribution : balance * (1 + monthlyReturn) + monthlyContribution;

    if (balance >= fireNumber) {
      return { status: "on-track", months: month };
    }
  }

  return { status: "unreachable", months: null };
}

/**
 * Required Contribution to hit the user's target FIRE age, solved algebraically:
 *
 * Required Contribution =
 *   (FIRE Number - current_assets * (1 + monthly_return)^months)
 *   / (((1 + monthly_return)^months - 1) / monthly_return)
 *
 * Handles a 0% return separately (no compounding term to divide by), and
 * floors negative results at $0 — a negative answer just means the user is
 * already on pace to beat their target age with no required change.
 */
export function calculateRequiredMonthlyInvestment(
  currentAssets: number,
  fireNumber: number,
  annualReturnPct: number,
  monthsToTarget: number,
): { amount: number; reachable: boolean } {
  if (monthsToTarget <= 0) {
    // Target age is already here or in the past — nothing meaningful to solve for.
    return { amount: 0, reachable: currentAssets >= fireNumber };
  }

  const monthlyReturn = annualReturnPct / 100 / 12;

  if (monthlyReturn === 0) {
    const required = (fireNumber - currentAssets) / monthsToTarget;
    return { amount: Math.max(0, required), reachable: true };
  }

  const growthFactor = Math.pow(1 + monthlyReturn, monthsToTarget);
  const futureValueOfCurrentAssets = currentAssets * growthFactor;
  const annuityFactor = (growthFactor - 1) / monthlyReturn;

  if (annuityFactor === 0 || !isFinite(annuityFactor)) {
    return { amount: 0, reachable: false };
  }

  const required = (fireNumber - futureValueOfCurrentAssets) / annuityFactor;
  return { amount: Math.max(0, required), reachable: true };
}

/**
 * Builds the full month-by-month projection used to draw the growth chart.
 * Sampled monthly but only needs to be smooth, not exhaustive, so the chart
 * stays readable; for long horizons we keep every point since the line
 * chart component handles down-sampling for ticks, not data density.
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
    balance = monthlyReturn === 0 ? balance + monthlyContribution : balance * (1 + monthlyReturn) + monthlyContribution;
    points.push({ month, age: currentAge + month / 12, value: balance });
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
  const fireNumber = calculateFireNumber(inputs.annualExpenses, inputs.safeWithdrawalRatePct);
  const progressPct = calculateProgressPct(inputs.currentAssets, fireNumber);

  const timeline = findMonthsToFire(
    inputs.currentAssets,
    inputs.monthlyInvestment,
    inputs.expectedReturnPct,
    fireNumber,
  );

  const yearsToFire = timeline.months !== null ? timeline.months / 12 : null;
  const estimatedFireAge = yearsToFire !== null ? inputs.currentAge + yearsToFire : null;

  const fireGap = Math.max(0, fireNumber - inputs.currentAssets);

  const monthsToTarget = Math.max(0, (inputs.targetFireAge - inputs.currentAge) * 12);
  const required = calculateRequiredMonthlyInvestment(
    inputs.currentAssets,
    fireNumber,
    inputs.expectedReturnPct,
    monthsToTarget,
  );

  // Project out far enough to show the FIRE line being reached (or, if
  // unreachable, just show a long, honest, flattening climb).
  const projectionMonths = timeline.status === "on-track" && timeline.months !== null
    ? Math.min(timeline.months + 12, MAX_YEARS_TO_SEARCH * 12)
    : Math.max(monthsToTarget, 30 * 12);

  const projection = generateProjection(
    inputs.currentAge,
    inputs.currentAssets,
    inputs.monthlyInvestment,
    inputs.expectedReturnPct,
    projectionMonths,
  );

  return {
    fireNumber,
    progressPct,
    timelineStatus: timeline.status,
    yearsToFire,
    estimatedFireAge,
    fireGap,
    requiredMonthlyInvestment: required.amount,
    requiredContributionReachable: required.reachable,
    projection,
  };
}

/**
 * "What Moves the Needle" — three dynamic comparisons against the user's
 * current plan. Each one re-runs the same calculateFireResults pipeline with
 * one input nudged, so the numbers are always real, never hardcoded.
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

  const fireNumberDrop = baseline.fireNumber - result.fireNumber;

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
