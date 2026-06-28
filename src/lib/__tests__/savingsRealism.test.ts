import { describe, it, expect } from "vitest";
import { calculateSavingsRateRealism } from "../savingsRealism";
import type { FireInputs } from "../../types/fire";

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
  annualIncome: 95000,
};

describe("calculateSavingsRateRealism — annual income missing", () => {
  it("returns null when annualIncome is undefined", () => {
    const noIncome: FireInputs = { ...baseInputs, annualIncome: undefined };
    expect(calculateSavingsRateRealism(noIncome, 1500)).toBeNull();
  });

  it("returns null when annualIncome is 0 (can't sensibly express a % of $0)", () => {
    const zeroIncome: FireInputs = { ...baseInputs, annualIncome: 0 };
    expect(calculateSavingsRateRealism(zeroIncome, 1500)).toBeNull();
  });

  it("returns null when annualIncome is negative (shouldn't happen past validation, but must not crash)", () => {
    const negativeIncome: FireInputs = { ...baseInputs, annualIncome: -1000 };
    expect(calculateSavingsRateRealism(negativeIncome, 1500)).toBeNull();
  });
});

describe("calculateSavingsRateRealism — basic calculation", () => {
  it("computes currentSavingsRatePct as monthly investment / monthly income", () => {
    // $95,000/year income -> $7,916.67/month. $1,500/month investment.
    const result = calculateSavingsRateRealism(baseInputs, 1500);
    expect(result).not.toBeNull();
    expect(result?.currentSavingsRatePct).toBeCloseTo((1500 / (95000 / 12)) * 100, 4);
  });

  it("computes requiredSavingsRatePct from the supplied required monthly investment, not currentSavingsRatePct", () => {
    const result = calculateSavingsRateRealism(baseInputs, 3000);
    expect(result?.requiredSavingsRatePct).toBeCloseTo((3000 / (95000 / 12)) * 100, 4);
    expect(result?.currentSavingsRatePct).not.toBeCloseTo(result?.requiredSavingsRatePct ?? -1, 4);
  });
});

describe("calculateSavingsRateRealism — realism labels", () => {
  it("labels a low required savings rate as 'realistic'", () => {
    // $1,000/month required against $95k income (~$7,917/mo) = ~12.6%
    const result = calculateSavingsRateRealism(baseInputs, 1000);
    expect(result?.label).toBe("realistic");
  });

  it("labels a moderate required savings rate as 'aggressive'", () => {
    // ~$2,200/month required against ~$7,917/mo income = ~27.8%
    const result = calculateSavingsRateRealism(baseInputs, 2200);
    expect(result?.label).toBe("aggressive");
  });

  it("labels a high required savings rate as 'very-aggressive'", () => {
    // ~$3,500/month required against ~$7,917/mo income = ~44.2%
    const result = calculateSavingsRateRealism(baseInputs, 3500);
    expect(result?.label).toBe("very-aggressive");
  });

  it("labels a very high required monthly investment (relative to income) as 'likely-unrealistic'", () => {
    // A required monthly investment that exceeds the entire monthly income.
    const result = calculateSavingsRateRealism(baseInputs, 10000);
    expect(result?.label).toBe("likely-unrealistic");
  });

  it("never returns NaN/Infinity even for an absurdly large required investment", () => {
    const result = calculateSavingsRateRealism(baseInputs, 50_000_000);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result?.requiredSavingsRatePct as number)).toBe(true);
    expect(result?.label).toBe("likely-unrealistic");
  });
});
