import { describe, it, expect } from "vitest";
import { runMonteCarloSimulation, calculateMonteCarloSummary } from "../monteCarlo";
import { createSeededRandom } from "../randomGenerator";
import { calculateFireResults } from "../fireCalculations";
import type { FireInputs } from "../../types/fire";

/**
 * All tests here use createSeededRandom with a fixed seed, never the
 * production default (which falls back to Date.now()-derived entropy).
 * This is what makes these tests deterministic and reproducible — same
 * seed, same simulated "lives," same assertions, every run.
 */

const baseInputs: FireInputs = {
  currentAge: 30,
  targetFireAge: 50,
  currentAssets: 75000,
  annualExpenses: 48000,
  monthlyInvestment: 1500,
  expectedReturnPct: 7,
  safeWithdrawalRatePct: 4,
  inflationPct: 3,
  volatilityPct: 15,
};

describe("runMonteCarloSimulation — output shape", () => {
  it("returns exactly numSimulations outcomes", () => {
    const outcomes = runMonteCarloSimulation(baseInputs, 250, createSeededRandom(1));
    expect(outcomes).toHaveLength(250);
  });

  it("every outcome has reachedFire as a boolean and monthsToFire consistent with it", () => {
    const outcomes = runMonteCarloSimulation(baseInputs, 100, createSeededRandom(2));
    for (const outcome of outcomes) {
      expect(typeof outcome.reachedFire).toBe("boolean");
      if (outcome.reachedFire) {
        expect(outcome.monthsToFire).not.toBeNull();
        expect(Number.isFinite(outcome.monthsToFire)).toBe(true);
        expect(outcome.monthsToFire as number).toBeGreaterThanOrEqual(0);
      } else {
        expect(outcome.monthsToFire).toBeNull();
      }
    }
  });

  it("is deterministic: the same seed produces the exact same outcomes every time", () => {
    const run1 = runMonteCarloSimulation(baseInputs, 200, createSeededRandom(777));
    const run2 = runMonteCarloSimulation(baseInputs, 200, createSeededRandom(777));
    expect(run1).toEqual(run2);
  });

  it("different seeds produce different outcomes (sanity check that randomness is actually applied)", () => {
    const run1 = runMonteCarloSimulation(baseInputs, 200, createSeededRandom(1));
    const run2 = runMonteCarloSimulation(baseInputs, 200, createSeededRandom(2));
    expect(run1).not.toEqual(run2);
  });
});

describe("runMonteCarloSimulation — 0% volatility collapses to the deterministic case", () => {
  it("produces IDENTICAL outcomes across every run when volatility is 0%", () => {
    const zeroVol: FireInputs = { ...baseInputs, volatilityPct: 0 };
    const outcomes = runMonteCarloSimulation(zeroVol, 50, createSeededRandom(5));
    const first = outcomes[0];
    for (const outcome of outcomes) {
      expect(outcome.reachedFire).toBe(first.reachedFire);
      expect(outcome.monthsToFire).toBe(first.monthsToFire);
    }
  });

  it("at 0% volatility, the months-to-fire matches the deterministic base-case timeline exactly", () => {
    const zeroVol: FireInputs = { ...baseInputs, volatilityPct: 0 };
    const outcomes = runMonteCarloSimulation(zeroVol, 5, createSeededRandom(9));
    const deterministic = calculateFireResults(baseInputs).returnPaths.base;

    expect(outcomes[0].reachedFire).toBe(deterministic.timelineStatus === "on-track" || deterministic.timelineStatus === "already-fi");
    if (deterministic.yearsToFire !== null) {
      const expectedMonths = Math.round(deterministic.yearsToFire * 12);
      expect(outcomes[0].monthsToFire).toBe(expectedMonths);
    }
  });
});

describe("runMonteCarloSimulation — 0% expected return", () => {
  it("does not crash and produces finite months for runs that do reach FIRE", () => {
    const zeroReturn: FireInputs = { ...baseInputs, expectedReturnPct: 0, volatilityPct: 5 };
    const outcomes = runMonteCarloSimulation(zeroReturn, 100, createSeededRandom(11));
    for (const outcome of outcomes) {
      if (outcome.reachedFire) {
        expect(Number.isFinite(outcome.monthsToFire)).toBe(true);
      }
    }
  });
});

describe("calculateMonteCarloSummary — FIRE reached (high-probability scenario)", () => {
  it("reports a high probability of success for a generous, realistic plan", () => {
    const generous: FireInputs = { ...baseInputs, currentAssets: 1_400_000 }; // already near the FIRE number
    const summary = calculateMonteCarloSummary(generous, 500, createSeededRandom(21));
    expect(summary.probabilityOfSuccessPct).toBeGreaterThan(90);
    expect(summary.medianFireAge).not.toBeNull();
  });

  it("orders percentile FIRE ages correctly: p10 <= median <= p90", () => {
    const summary = calculateMonteCarloSummary(baseInputs, 500, createSeededRandom(22));
    if (summary.p10FireAge !== null && summary.medianFireAge !== null && summary.p90FireAge !== null) {
      expect(summary.p10FireAge).toBeLessThanOrEqual(summary.medianFireAge);
      expect(summary.medianFireAge).toBeLessThanOrEqual(summary.p90FireAge);
    }
  });
});

describe("calculateMonteCarloSummary — FIRE not reached (hopeless scenario)", () => {
  it("reports near-0% probability and null percentile ages for a scenario that can't succeed", () => {
    const hopeless: FireInputs = {
      ...baseInputs,
      currentAssets: 0,
      monthlyInvestment: 10,
      annualExpenses: 500_000,
      expectedReturnPct: 2,
    };
    const summary = calculateMonteCarloSummary(hopeless, 200, createSeededRandom(31));
    expect(summary.probabilityOfSuccessPct).toBeLessThan(5);
    expect(summary.medianFireAge).toBeNull();
  });

  it("never produces NaN or Infinity in the summary even when almost no runs succeed", () => {
    const hopeless: FireInputs = {
      ...baseInputs,
      currentAssets: 0,
      monthlyInvestment: 10,
      annualExpenses: 500_000,
      expectedReturnPct: 2,
    };
    const summary = calculateMonteCarloSummary(hopeless, 200, createSeededRandom(32));
    expect(Number.isFinite(summary.probabilityOfSuccessPct)).toBe(true);
    for (const point of summary.chartPaths) {
      expect(Number.isFinite(point.p10)).toBe(true);
      expect(Number.isFinite(point.p50)).toBe(true);
      expect(Number.isFinite(point.p90)).toBe(true);
      expect(Number.isFinite(point.fireTarget)).toBe(true);
    }
  });
});

describe("calculateMonteCarloSummary — chart paths", () => {
  it("chart paths start at currentAssets for all three percentiles", () => {
    const summary = calculateMonteCarloSummary(baseInputs, 200, createSeededRandom(41));
    const first = summary.chartPaths[0];
    expect(first.p10).toBe(baseInputs.currentAssets);
    expect(first.p50).toBe(baseInputs.currentAssets);
    expect(first.p90).toBe(baseInputs.currentAssets);
  });

  it("p10 <= p50 <= p90 at every single month of the chart (percentiles never cross)", () => {
    const summary = calculateMonteCarloSummary(baseInputs, 300, createSeededRandom(42));
    for (const point of summary.chartPaths) {
      expect(point.p10).toBeLessThanOrEqual(point.p50 + 1e-6);
      expect(point.p50).toBeLessThanOrEqual(point.p90 + 1e-6);
    }
  });

  it("the fireTarget line is non-decreasing over time (inflation only ever grows the target)", () => {
    const summary = calculateMonteCarloSummary(baseInputs, 100, createSeededRandom(43));
    for (let i = 1; i < summary.chartPaths.length; i++) {
      expect(summary.chartPaths[i].fireTarget).toBeGreaterThanOrEqual(summary.chartPaths[i - 1].fireTarget - 1e-6);
    }
  });
});

describe("calculateMonteCarloSummary — very high required monthly investment scenario", () => {
  it("handles an extreme, near-impossible plan without NaN/Infinity/crash", () => {
    const extreme: FireInputs = {
      ...baseInputs,
      annualExpenses: 2_000_000,
      currentAssets: 1000,
      monthlyInvestment: 25,
    };
    const summary = calculateMonteCarloSummary(extreme, 150, createSeededRandom(51));
    expect(Number.isFinite(summary.probabilityOfSuccessPct)).toBe(true);
    expect(summary.probabilityOfSuccessPct).toBeGreaterThanOrEqual(0);
    expect(summary.probabilityOfSuccessPct).toBeLessThanOrEqual(100);
  });
});

describe("calculateMonteCarloSummary — numSimulations respected", () => {
  it("echoes back the requested numSimulations in the summary", () => {
    const summary = calculateMonteCarloSummary(baseInputs, 333, createSeededRandom(61));
    expect(summary.numSimulations).toBe(333);
  });

  it("defaults to 1000 simulations when not specified", () => {
    const summary = calculateMonteCarloSummary(baseInputs, undefined, createSeededRandom(62));
    expect(summary.numSimulations).toBe(1000);
  });
});
