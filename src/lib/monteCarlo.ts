/**
 * Monte Carlo FIRE simulation.
 *
 * The deterministic engine in fireCalculations.ts answers "what happens at
 * exactly this return, every single year, forever" — three times, for
 * conservative/base/optimistic. Real markets don't deliver a smooth
 * constant return; some years are up 25%, some are down 15%. Monte Carlo
 * simulation captures that by running the SAME plan thousands of times,
 * each time with a different randomly-sampled sequence of annual returns
 * (drawn from a normal distribution centered on the expected return, with
 * the user's chosen volatility as the spread), and looking at how often —
 * and how fast — the portfolio actually crosses the inflating FIRE number.
 *
 * This stays directional and educational, exactly like the rest of the
 * app: a normal distribution of annual returns is a simplification (real
 * market returns are not perfectly normal, and years aren't independent of
 * each other), not a forecast. The output is a probability and a range,
 * never a promise.
 */

import { calculateFutureFireNumber } from "./fireCalculations";
import { createSeededRandom, sampleNormal, type RandomFn } from "./randomGenerator";
import type {
  FireInputs,
  MonteCarloChartPoint,
  MonteCarloRunOutcome,
  MonteCarloSummary,
} from "../types/fire";

const MAX_YEARS_TO_SEARCH = 100;
export const DEFAULT_NUM_SIMULATIONS = 1000;

/**
 * Runs ONE simulated "life": draws a random annual return for each year
 * (resampled every 12 months, not every month — annual volatility describes
 * year-to-year variation, and resampling every month would understate how
 * volatile a real single year actually is), grows the portfolio against
 * that path, and checks every month whether it has crossed the (inflating)
 * FIRE number.
 *
 * Returns the same shape findMonthsToFire would for a single deterministic
 * path, so callers can reuse the familiar on-track / already-fi / unreachable
 * vocabulary if needed — but for the simulation summary we only need
 * reachedFire + monthsToFire.
 */
function simulateOneRun(inputs: FireInputs, random: RandomFn): MonteCarloRunOutcome {
  const fireNumberToday = calculateFutureFireNumber(
    inputs.annualExpenses,
    inputs.inflationPct,
    inputs.safeWithdrawalRatePct,
    0,
  );

  if (inputs.currentAssets >= fireNumberToday) {
    return { reachedFire: true, monthsToFire: 0 };
  }

  const maxMonths = MAX_YEARS_TO_SEARCH * 12;
  let balance = inputs.currentAssets;
  let currentAnnualReturnPct = inputs.expectedReturnPct;

  for (let month = 1; month <= maxMonths; month++) {
    // Resample the year's return at the start of each 12-month block.
    if ((month - 1) % 12 === 0) {
      currentAnnualReturnPct = sampleNormal(random, inputs.expectedReturnPct, inputs.volatilityPct);
    }

    const monthlyReturn = currentAnnualReturnPct / 100 / 12;
    balance = balance * (1 + monthlyReturn) + inputs.monthlyInvestment;

    const targetAtThisMonth = calculateFutureFireNumber(
      inputs.annualExpenses,
      inputs.inflationPct,
      inputs.safeWithdrawalRatePct,
      month,
    );

    if (balance >= targetAtThisMonth) {
      return { reachedFire: true, monthsToFire: month };
    }
  }

  return { reachedFire: false, monthsToFire: null };
}

/**
 * Runs the full Monte Carlo simulation: numSimulations independent random
 * "lives", each produced by simulateOneRun. Accepts an optional RandomFn so
 * tests can inject a seeded generator (see randomGenerator.ts) instead of
 * relying on real randomness — without that, the same test could pass or
 * fail from run to run, which defeats the point of a regression test.
 *
 * Pure function: given the same inputs and the same RandomFn, always
 * produces the same outcomes array.
 */
export function runMonteCarloSimulation(
  inputs: FireInputs,
  numSimulations: number = DEFAULT_NUM_SIMULATIONS,
  random: RandomFn = createSeededRandom(Date.now() ^ 0x9e3779b9),
): MonteCarloRunOutcome[] {
  const outcomes: MonteCarloRunOutcome[] = [];
  for (let i = 0; i < numSimulations; i++) {
    outcomes.push(simulateOneRun(inputs, random));
  }
  return outcomes;
}

/** Linear-interpolated percentile of a sorted numeric array, 0-100 scale. */
function percentileOf(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return NaN;
  if (sortedValues.length === 1) return sortedValues[0];
  const rank = (percentile / 100) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = rank - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

/**
 * Builds the percentile portfolio paths (10th / 50th / 90th) for the Monte
 * Carlo chart, plus the same inflating FIRE target line the deterministic
 * chart uses. Re-simulates with a fresh batch of runs (using the supplied
 * RandomFn) and, at every month, takes the percentile ACROSS runs of the
 * balance at that month — this is the standard "fan chart" approach: each
 * percentile line is a real cross-section of the simulated outcomes at that
 * point in time, not a single representative run.
 */
function buildMonteCarloChartPaths(
  inputs: FireInputs,
  numSimulations: number,
  random: RandomFn,
  horizonMonths: number,
): MonteCarloChartPoint[] {
  // Run numSimulations parallel balance walks, recording the full balance
  // history for each so we can take cross-sectional percentiles per month.
  const balanceHistories: number[][] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const history: number[] = [inputs.currentAssets];
    let balance = inputs.currentAssets;
    let currentAnnualReturnPct = inputs.expectedReturnPct;

    for (let month = 1; month <= horizonMonths; month++) {
      if ((month - 1) % 12 === 0) {
        currentAnnualReturnPct = sampleNormal(random, inputs.expectedReturnPct, inputs.volatilityPct);
      }
      const monthlyReturn = currentAnnualReturnPct / 100 / 12;
      balance = balance * (1 + monthlyReturn) + inputs.monthlyInvestment;
      history.push(balance);
    }
    balanceHistories.push(history);
  }

  const points: MonteCarloChartPoint[] = [];
  for (let month = 0; month <= horizonMonths; month++) {
    const balancesAtThisMonth = balanceHistories.map((history) => history[month]).sort((a, b) => a - b);
    points.push({
      month,
      age: inputs.currentAge + month / 12,
      p10: percentileOf(balancesAtThisMonth, 10),
      p50: percentileOf(balancesAtThisMonth, 50),
      p90: percentileOf(balancesAtThisMonth, 90),
      fireTarget: calculateFutureFireNumber(inputs.annualExpenses, inputs.inflationPct, inputs.safeWithdrawalRatePct, month),
    });
  }

  return points;
}

/**
 * Turns raw per-run Monte Carlo outcomes into the summary the Risk &
 * Diagnosis section actually displays: probability of success, median /
 * 10th / 90th percentile FIRE ages, and chart-ready percentile paths.
 *
 * A percentile FIRE AGE (as opposed to a percentile portfolio value) needs
 * its own definition of "10th percentile": it's the time by which 10% of
 * all simulated runs had ALREADY reached FIRE — i.e. a relatively fast,
 * lucky outcome corresponds to a LOW percentile of the months-to-fire
 * distribution. The 90th percentile FIRE age is the slower, unlucky case.
 * Runs that never reach FIRE are treated as "infinitely far out" for
 * ranking purposes, which means a percentile FIRE age comes back null
 * whenever fewer than that percentile's share of runs ever succeeded.
 */
export function calculateMonteCarloSummary(
  inputs: FireInputs,
  numSimulations: number = DEFAULT_NUM_SIMULATIONS,
  random: RandomFn = createSeededRandom(Date.now() ^ 0x9e3779b9),
): MonteCarloSummary {
  const outcomes = runMonteCarloSimulation(inputs, numSimulations, random);

  const successCount = outcomes.filter((o) => o.reachedFire).length;
  const probabilityOfSuccessPct = numSimulations > 0 ? (successCount / numSimulations) * 100 : 0;

  // Months-to-fire for successful runs only, sorted ascending (fastest first).
  const successfulMonths = outcomes
    .filter((o): o is { reachedFire: true; monthsToFire: number } => o.reachedFire && o.monthsToFire !== null)
    .map((o) => o.monthsToFire)
    .sort((a, b) => a - b);

  /**
   * Percentile FIRE age, accounting for runs that never reach FIRE at all.
   * We compute the percentile rank AS IF every run (including failures,
   * treated as +Infinity months) were included, then only return a value
   * if that rank actually lands within the successful subset.
   */
  function percentileFireAge(percentile: number): number | null {
    if (numSimulations === 0 || successfulMonths.length === 0) return null;
    const rank = (percentile / 100) * (numSimulations - 1);
    const rankIndex = Math.round(rank);
    if (rankIndex >= successfulMonths.length) {
      // This percentile falls among the runs that never reached FIRE at all.
      return null;
    }
    const months = successfulMonths[rankIndex];
    return inputs.currentAge + months / 12;
  }

  const medianFireAge = percentileFireAge(50);
  const p10FireAge = percentileFireAge(10);
  const p90FireAge = percentileFireAge(90);

  // Chart horizon: run out a bit past the slower of (90th percentile FIRE
  // age) and the user's own target, so the fan chart has a sensible span
  // even when most runs succeed quickly or when most runs never succeed.
  const horizonYears =
    p90FireAge !== null
      ? Math.min(p90FireAge - inputs.currentAge + 5, MAX_YEARS_TO_SEARCH)
      : Math.max(inputs.targetFireAge - inputs.currentAge, 30);
  const horizonMonths = Math.max(12, Math.round(horizonYears * 12));

  const chartPaths = buildMonteCarloChartPaths(inputs, numSimulations, random, horizonMonths);

  return {
    numSimulations,
    probabilityOfSuccessPct,
    medianFireAge,
    p10FireAge,
    p90FireAge,
    chartPaths,
  };
}
