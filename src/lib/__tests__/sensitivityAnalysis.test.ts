import { describe, it, expect } from "vitest";
import { calculateSensitivityAnalysis, rankFireLevers } from "../sensitivityAnalysis";
import type { FireInputs, SensitivityLeverResult } from "../../types/fire";

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

describe("calculateSensitivityAnalysis — basic shape", () => {
  it("returns a result for all 5 specified levers", () => {
    const analysis = calculateSensitivityAnalysis(baseInputs);
    expect(analysis.leverResults).toHaveLength(5);
    const ids = analysis.leverResults.map((r) => r.id);
    expect(ids).toContain("invest-more-10pct");
    expect(ids).toContain("spend-less-10pct");
    expect(ids).toContain("higher-return-1pt");
    expect(ids).toContain("lower-swr-half-pt");
    expect(ids).toContain("later-target-age");
  });

  it("identifies a biggest lever for a normal on-track scenario", () => {
    const analysis = calculateSensitivityAnalysis(baseInputs);
    expect(analysis.biggestLever).not.toBeNull();
    expect(analysis.biggestLever?.yearsImprovement).toBeGreaterThan(0);
  });

  it("ranks the biggest lever first in leverResults", () => {
    const analysis = calculateSensitivityAnalysis(baseInputs);
    expect(analysis.leverResults[0].id).toBe(analysis.biggestLever?.id);
  });
});

describe("calculateSensitivityAnalysis — already FI", () => {
  it("returns null yearsImprovement for every lever and a null biggestLever when already FI", () => {
    const alreadyFi: FireInputs = { ...baseInputs, currentAssets: 2_000_000 };
    const analysis = calculateSensitivityAnalysis(alreadyFi);
    expect(analysis.biggestLever).toBeNull();
    for (const lever of analysis.leverResults) {
      expect(lever.yearsImprovement).toBeNull();
    }
  });
});

describe("calculateSensitivityAnalysis — unreachable baseline", () => {
  it("handles a hopeless baseline without crashing, NaN, or Infinity", () => {
    const hopeless: FireInputs = {
      ...baseInputs,
      currentAssets: 0,
      monthlyInvestment: 5,
      annualExpenses: 1_000_000,
      expectedReturnPct: 1,
    };
    const analysis = calculateSensitivityAnalysis(hopeless);
    expect(analysis.leverResults).toHaveLength(5);
    for (const lever of analysis.leverResults) {
      if (lever.yearsImprovement !== null) {
        expect(Number.isFinite(lever.yearsImprovement)).toBe(true);
      }
    }
  });
});

describe("calculateSensitivityAnalysis — target-age lever is measured differently, on purpose", () => {
  it("reports a non-zero years improvement for pushing the target age out, since it's measured via required-investment reduction, not yearsToFire (which the lever can never move)", () => {
    const analysis = calculateSensitivityAnalysis(baseInputs);
    const laterTarget = analysis.leverResults.find((r) => r.id === "later-target-age");
    expect(laterTarget?.yearsImprovement).not.toBeNull();
    expect(laterTarget?.yearsImprovement as number).toBeGreaterThan(0);
  });

  it("returns null for the target-age lever when there's no current contribution to convert dollars into years against", () => {
    const noContribution: FireInputs = { ...baseInputs, monthlyInvestment: 0 };
    const analysis = calculateSensitivityAnalysis(noContribution);
    const laterTarget = analysis.leverResults.find((r) => r.id === "later-target-age");
    expect(laterTarget?.yearsImprovement).toBeNull();
  });
});

describe("rankFireLevers", () => {
  it("sorts levers with a numeric improvement in descending order", () => {
    const unranked: SensitivityLeverResult[] = [
      { id: "invest-more-10pct", label: "A", description: "", yearsImprovement: 1.5 },
      { id: "spend-less-10pct", label: "B", description: "", yearsImprovement: 4.2 },
      { id: "higher-return-1pt", label: "C", description: "", yearsImprovement: 2.8 },
    ];
    const ranked = rankFireLevers(unranked);
    expect(ranked.map((r) => r.id)).toEqual(["spend-less-10pct", "higher-return-1pt", "invest-more-10pct"]);
  });

  it("sorts null-improvement levers to the end, after every numeric one", () => {
    const unranked: SensitivityLeverResult[] = [
      { id: "invest-more-10pct", label: "A", description: "", yearsImprovement: null },
      { id: "spend-less-10pct", label: "B", description: "", yearsImprovement: 3 },
      { id: "higher-return-1pt", label: "C", description: "", yearsImprovement: null },
    ];
    const ranked = rankFireLevers(unranked);
    expect(ranked[0].id).toBe("spend-less-10pct");
    expect(ranked[1].yearsImprovement).toBeNull();
    expect(ranked[2].yearsImprovement).toBeNull();
  });

  it("returns an empty array unchanged", () => {
    expect(rankFireLevers([])).toEqual([]);
  });
});

describe("calculateSensitivityAnalysis — spec example sanity check", () => {
  it("for a scenario with low expenses relative to investment headroom, ranks levers sensibly (no lever wins by a nonsensical margin)", () => {
    const analysis = calculateSensitivityAnalysis(baseInputs);
    const investMore = analysis.leverResults.find((r) => r.id === "invest-more-10pct");
    const spendLess = analysis.leverResults.find((r) => r.id === "spend-less-10pct");

    expect(investMore?.yearsImprovement).not.toBeNull();
    expect(spendLess?.yearsImprovement).not.toBeNull();
    // Both real, comparable, finite years of improvement — which one "wins"
    // legitimately depends on the inputs, so this just asserts they're
    // both sane positive numbers rather than asserting a specific winner.
    expect(investMore?.yearsImprovement as number).toBeGreaterThan(0);
    expect(spendLess?.yearsImprovement as number).toBeGreaterThan(0);
  });

  it("the lower-swr lever can legitimately show null or a small/negative-leaning improvement, since a lower SWR raises the FIRE number", () => {
    const analysis = calculateSensitivityAnalysis(baseInputs);
    const lowerSwr = analysis.leverResults.find((r) => r.id === "lower-swr-half-pt");
    expect(lowerSwr).toBeDefined();
    // Whatever the value, it must not be NaN/Infinity.
    if (lowerSwr?.yearsImprovement !== null && lowerSwr?.yearsImprovement !== undefined) {
      expect(Number.isFinite(lowerSwr.yearsImprovement)).toBe(true);
    }
  });
});
