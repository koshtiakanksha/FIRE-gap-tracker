import { describe, it, expect } from "vitest";
import {
  calculateFireNumber,
  calculateProgressPct,
  calculateInflationAdjustedExpenses,
  calculateFutureFireNumber,
  calculateFutureValue,
  findMonthsToFire,
  calculateRequiredMonthlyInvestment,
  calculateReturnRangePaths,
  calculateFireAgeForPath,
  calculateFireResults,
} from "../fireCalculations";
import type { FireInputs } from "../../types/fire";

/** A realistic baseline scenario, reused across several tests below. */
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

describe("calculateFireNumber", () => {
  it("matches the spec's worked example: $60k expenses / 4% SWR = $1.5M", () => {
    expect(calculateFireNumber(60000, 4)).toBe(1_500_000);
  });

  it("returns Infinity when the safe withdrawal rate is 0 (never NaN, never a crash)", () => {
    expect(calculateFireNumber(50000, 0)).toBe(Infinity);
  });

  it("returns Infinity for a negative safe withdrawal rate", () => {
    expect(calculateFireNumber(50000, -1)).toBe(Infinity);
  });
});

describe("calculateProgressPct", () => {
  it("computes assets / fireNumber as a percentage", () => {
    expect(calculateProgressPct(750000, 1_500_000)).toBe(50);
  });

  it("clamps at 0 rather than going negative for a degenerate fireNumber", () => {
    expect(calculateProgressPct(100000, 0)).toBe(0);
    expect(calculateProgressPct(100000, Infinity)).toBe(0);
  });
});

describe("calculateInflationAdjustedExpenses — monthly compounding, not a single multiply", () => {
  it("returns the unchanged amount at month 0", () => {
    expect(calculateInflationAdjustedExpenses(48000, 3, 0)).toBe(48000);
  });

  it("at 0% inflation, expenses never grow regardless of horizon", () => {
    expect(calculateInflationAdjustedExpenses(48000, 0, 12)).toBe(48000);
    expect(calculateInflationAdjustedExpenses(48000, 0, 360)).toBe(48000);
  });

  it("at 3% inflation, expenses compound monthly and land near the textbook annual figure", () => {
    // (1 + 0.03/12)^120 ≈ 1.3494 — i.e. roughly 35% higher after 10 years,
    // consistent with ~3% annual compounding, not a single end-multiply.
    const after10Years = calculateInflationAdjustedExpenses(48000, 3, 120);
    expect(after10Years).toBeGreaterThan(48000 * 1.34);
    expect(after10Years).toBeLessThan(48000 * 1.36);
  });

  it("grows monotonically month over month — confirms genuine compounding, not a flat jump", () => {
    const m0 = calculateInflationAdjustedExpenses(48000, 3, 0);
    const m1 = calculateInflationAdjustedExpenses(48000, 3, 1);
    const m2 = calculateInflationAdjustedExpenses(48000, 3, 2);
    const m120 = calculateInflationAdjustedExpenses(48000, 3, 120);
    const m121 = calculateInflationAdjustedExpenses(48000, 3, 121);
    expect(m1).toBeGreaterThan(m0);
    expect(m2).toBeGreaterThan(m1);
    expect(m121).toBeGreaterThan(m120);
    // The single-step growth factor should be the same small monthly amount
    // everywhere along the curve — i.e. each month adds the same *rate*,
    // not a chunk proportional to elapsed time (which would indicate a
    // disguised single multiply rather than real compounding).
    const earlyStepRatio = m1 / m0;
    const lateStepRatio = m121 / m120;
    expect(earlyStepRatio).toBeCloseTo(lateStepRatio, 6);
  });
});

describe("calculateFutureFireNumber", () => {
  it("equals the plain FIRE number at month 0", () => {
    expect(calculateFutureFireNumber(48000, 3, 4, 0)).toBeCloseTo(calculateFireNumber(48000, 4), 6);
  });

  it("is strictly larger than today's FIRE number once inflation has had time to compound", () => {
    const today = calculateFireNumber(48000, 4);
    const in20Years = calculateFutureFireNumber(48000, 3, 4, 240);
    expect(in20Years).toBeGreaterThan(today);
  });

  it("at 0% inflation, the future FIRE number equals today's FIRE number at any horizon", () => {
    const today = calculateFireNumber(48000, 4);
    const in30Years = calculateFutureFireNumber(48000, 0, 4, 360);
    expect(in30Years).toBeCloseTo(today, 6);
  });
});

describe("calculateFutureValue", () => {
  it("handles 0% return as pure linear accumulation (no division by zero, no NaN)", () => {
    const fv = calculateFutureValue(10000, 100, 0, 12);
    expect(fv).toBe(11200);
    expect(Number.isFinite(fv)).toBe(true);
  });

  it("compounds correctly for a positive return", () => {
    const fv = calculateFutureValue(75000, 1500, 7, 240);
    expect(fv).toBeGreaterThan(75000 + 1500 * 240); // must exceed simple sum once compounding applies
    expect(Number.isFinite(fv)).toBe(true);
  });

  it("never returns NaN or Infinity for typical inputs", () => {
    const fv = calculateFutureValue(0, 0, 7, 0);
    expect(fv).toBe(0);
  });
});

describe("findMonthsToFire — inflation makes the target move, not the math break", () => {
  it("with 0% inflation, the timeline matches the original fixed-target behavior", () => {
    const result = findMonthsToFire(75000, 1500, 7, 48000, 0, 4);
    expect(result.status).toBe("on-track");
    expect(result.months).not.toBeNull();
    // ~21.25 years (255 months) was the known-correct Phase 0 answer for these inputs.
    expect(result.months).toBeCloseTo(255, 0);
  });

  it("with 3% inflation, the same plan takes meaningfully longer (the target is rising)", () => {
    const noInflation = findMonthsToFire(75000, 1500, 7, 48000, 0, 4);
    const withInflation = findMonthsToFire(75000, 1500, 7, 48000, 3, 4);
    expect(withInflation.status).toBe("on-track");
    expect(withInflation.months).not.toBeNull();
    expect(noInflation.months).not.toBeNull();
    expect(withInflation.months as number).toBeGreaterThan(noInflation.months as number);
  });

  it("handles 0% expected return without crashing or producing NaN/Infinity", () => {
    const result = findMonthsToFire(10000, 500, 0, 48000, 0, 4);
    expect(result.status).toBe("unreachable"); // linear $500/mo can't close a $1.19M gap within 100 years
    expect(result.months).toBeNull();
  });

  it("flags very high expenses relative to assets/contribution as unreachable, not broken", () => {
    const result = findMonthsToFire(10000, 200, 5, 500000, 3, 4);
    expect(result.status).toBe("unreachable");
    expect(result.months).toBeNull();
  });

  it("handles a very low monthly investment by still finding a (long) timeline rather than failing", () => {
    const result = findMonthsToFire(50000, 10, 7, 30000, 3, 4);
    expect(result.status).toBe("on-track");
    expect(result.months).not.toBeNull();
    expect(Number.isFinite(result.months as number)).toBe(true);
  });

  it("detects already-FI immediately when current assets exceed today's FIRE number", () => {
    const result = findMonthsToFire(2_000_000, 1500, 7, 48000, 3, 4);
    expect(result.status).toBe("already-fi");
    expect(result.months).toBe(0);
  });

  it("never throws or returns NaN/Infinity months even with a degenerate safe withdrawal rate", () => {
    const result = findMonthsToFire(75000, 1500, 7, 48000, 3, 0);
    expect(result.status).toBe("unreachable");
    expect(result.months).toBeNull();
  });
});

describe("calculateRequiredMonthlyInvestment — solved against the inflating target", () => {
  it("round-trips: the required contribution, fed back in, lands on the inflated target", () => {
    const monthsToTarget = 240; // age 30 -> 50
    const required = calculateRequiredMonthlyInvestment(75000, 48000, 3, 4, 7, monthsToTarget);
    expect(required.reachable).toBe(true);

    // Re-simulate with the solved contribution and confirm it actually reaches the target.
    const target = calculateFutureFireNumber(48000, 3, 4, monthsToTarget);
    let balance = 75000;
    const monthlyReturn = 7 / 100 / 12;
    for (let m = 1; m <= monthsToTarget; m++) {
      balance = balance * (1 + monthlyReturn) + required.amount;
    }
    expect(balance).toBeCloseTo(target, 0);
  });

  it("is higher than the non-inflation requirement for the same target (a moving target costs more)", () => {
    const monthsToTarget = 240;
    const withInflation = calculateRequiredMonthlyInvestment(75000, 48000, 3, 4, 7, monthsToTarget);
    const withoutInflation = calculateRequiredMonthlyInvestment(75000, 48000, 0, 4, 7, monthsToTarget);
    expect(withInflation.amount).toBeGreaterThan(withoutInflation.amount);
  });

  it("floors at $0 when already on pace to beat the target with no contribution", () => {
    const required = calculateRequiredMonthlyInvestment(2_000_000, 48000, 3, 4, 7, 240);
    expect(required.amount).toBe(0);
    expect(required.reachable).toBe(true);
  });

  it("returns amount 0 with reachable=false when the target is infinite (degenerate safe withdrawal rate)", () => {
    // SWR = 0 makes the FIRE number Infinity — no finite monthly contribution
    // can ever reach an infinite target, regardless of search bounds.
    const required = calculateRequiredMonthlyInvestment(0, 50000, 3, 0, 7, 240);
    expect(required.reachable).toBe(false);
    expect(required.amount).toBe(0);
  });

  it("treats monthsToTarget <= 0 as already decided by current assets alone", () => {
    const alreadyThere = calculateRequiredMonthlyInvestment(2_000_000, 48000, 3, 4, 7, 0);
    expect(alreadyThere.reachable).toBe(true);
    expect(alreadyThere.amount).toBe(0);

    const notThere = calculateRequiredMonthlyInvestment(1000, 48000, 3, 4, 7, 0);
    expect(notThere.reachable).toBe(false);
  });
});

describe("calculateReturnRangePaths", () => {
  it("spreads conservative/optimistic 2 points below/above the base return", () => {
    const paths = calculateReturnRangePaths(7);
    expect(paths.conservative).toBe(5);
    expect(paths.base).toBe(7);
    expect(paths.optimistic).toBe(9);
  });

  it("floors the conservative path at 0% rather than going negative", () => {
    const paths = calculateReturnRangePaths(1); // 1 - 2 = -1, should floor to 0
    expect(paths.conservative).toBe(0);
    expect(paths.base).toBe(1);
    expect(paths.optimistic).toBe(3);
  });

  it("never produces NaN regardless of an extreme (but validation-allowed) input", () => {
    const paths = calculateReturnRangePaths(-10);
    expect(paths.conservative).toBe(0);
    expect(Number.isFinite(paths.base)).toBe(true);
    expect(Number.isFinite(paths.optimistic)).toBe(true);
  });
});

describe("calculateFireAgeForPath", () => {
  it("returns a longer (or equal) timeline for conservative than for optimistic, for the same inputs", () => {
    const conservative = calculateFireAgeForPath("conservative", 5, baseInputs);
    const optimistic = calculateFireAgeForPath("optimistic", 9, baseInputs);
    expect(conservative.timelineStatus).toBe("on-track");
    expect(optimistic.timelineStatus).toBe("on-track");
    expect(conservative.yearsToFire as number).toBeGreaterThan(optimistic.yearsToFire as number);
  });

  it("reports 'unreachable' with a null FIRE age rather than a broken number", () => {
    const hopeless: FireInputs = { ...baseInputs, annualExpenses: 5_000_000, monthlyInvestment: 50, currentAssets: 0 };
    const result = calculateFireAgeForPath("base", 5, hopeless);
    expect(result.timelineStatus).toBe("unreachable");
    expect(result.yearsToFire).toBeNull();
    expect(result.estimatedFireAge).toBeNull();
  });
});

describe("calculateFireResults — consistency across the whole pipeline", () => {
  it("base-case results match calculateFireAgeForPath('base', ...) exactly (single source of truth)", () => {
    const results = calculateFireResults(baseInputs);
    const standaloneBase = calculateFireAgeForPath("base", baseInputs.expectedReturnPct, baseInputs);
    expect(results.timelineStatus).toBe(standaloneBase.timelineStatus);
    expect(results.yearsToFire).toBe(standaloneBase.yearsToFire);
    expect(results.estimatedFireAge).toBe(standaloneBase.estimatedFireAge);
  });

  it("conservative, base, and optimistic paths are internally ordered (conservative slowest, optimistic fastest)", () => {
    const results = calculateFireResults(baseInputs);
    const { conservative, base, optimistic } = results.returnPaths;
    expect(conservative.yearsToFire as number).toBeGreaterThan(base.yearsToFire as number);
    expect(base.yearsToFire as number).toBeGreaterThan(optimistic.yearsToFire as number);
  });

  it("the combined chart series starts at currentAssets for all three paths and ends with no NaN/Infinity", () => {
    const results = calculateFireResults(baseInputs);
    const first = results.combinedProjection[0];
    expect(first.conservative).toBe(baseInputs.currentAssets);
    expect(first.base).toBe(baseInputs.currentAssets);
    expect(first.optimistic).toBe(baseInputs.currentAssets);

    for (const point of results.combinedProjection) {
      expect(Number.isFinite(point.conservative)).toBe(true);
      expect(Number.isFinite(point.base)).toBe(true);
      expect(Number.isFinite(point.optimistic)).toBe(true);
      expect(Number.isFinite(point.fireTarget)).toBe(true);
    }
  });

  it("fireNumberAtTargetAge is greater than fireNumberToday whenever inflation is positive and target age is in the future", () => {
    const results = calculateFireResults(baseInputs);
    expect(results.fireNumberAtTargetAge).toBeGreaterThan(results.fireNumberToday);
  });

  it("fireNumberAtTargetAge equals fireNumberToday when inflation is 0%", () => {
    const zeroInflation: FireInputs = { ...baseInputs, inflationPct: 0 };
    const results = calculateFireResults(zeroInflation);
    expect(results.fireNumberAtTargetAge).toBeCloseTo(results.fireNumberToday, 6);
  });

  it("handles a very high-expense, low-contribution scenario without NaN/Infinity anywhere in the output", () => {
    const hopeless: FireInputs = { ...baseInputs, annualExpenses: 2_000_000, monthlyInvestment: 25, currentAssets: 500 };
    const results = calculateFireResults(hopeless);

    expect(Number.isFinite(results.fireNumberToday)).toBe(true);
    expect(Number.isFinite(results.fireNumberAtTargetAge)).toBe(true);
    expect(Number.isFinite(results.progressPct)).toBe(true);
    expect(Number.isFinite(results.fireGap)).toBe(true);
    expect(Number.isFinite(results.requiredMonthlyInvestment)).toBe(true);
    expect(results.returnPaths.base.timelineStatus).toBe("unreachable");
  });
});
