import { describe, it, expect } from "vitest";
import { validateFireInputs, isValidFireInputs } from "../validation";
import type { FireInputs } from "../../types/fire";

const validInputs: FireInputs = {
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

describe("validateFireInputs — volatility (Phase 2)", () => {
  it("accepts 0% volatility", () => {
    const errors = validateFireInputs({ ...validInputs, volatilityPct: 0 });
    expect(errors.find((e) => e.field === "volatilityPct")).toBeUndefined();
  });

  it("accepts the 15% default", () => {
    const errors = validateFireInputs({ ...validInputs, volatilityPct: 15 });
    expect(errors.find((e) => e.field === "volatilityPct")).toBeUndefined();
  });

  it("accepts exactly 40% (the upper bound)", () => {
    const errors = validateFireInputs({ ...validInputs, volatilityPct: 40 });
    expect(errors.find((e) => e.field === "volatilityPct")).toBeUndefined();
  });

  it("rejects a missing/NaN volatility with a friendly message", () => {
    const errors = validateFireInputs({ ...validInputs, volatilityPct: NaN });
    const error = errors.find((e) => e.field === "volatilityPct");
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/required/i);
  });

  it("rejects a negative volatility", () => {
    const errors = validateFireInputs({ ...validInputs, volatilityPct: -5 });
    const error = errors.find((e) => e.field === "volatilityPct");
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/negative/i);
  });

  it("rejects a volatility above 40%", () => {
    const errors = validateFireInputs({ ...validInputs, volatilityPct: 50 });
    const error = errors.find((e) => e.field === "volatilityPct");
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/40/);
  });
});

describe("validateFireInputs — inflation rate", () => {
  it("accepts 0% inflation", () => {
    const errors = validateFireInputs({ ...validInputs, inflationPct: 0 });
    expect(errors.find((e) => e.field === "inflationPct")).toBeUndefined();
  });

  it("accepts 3% inflation (the default)", () => {
    const errors = validateFireInputs({ ...validInputs, inflationPct: 3 });
    expect(errors.find((e) => e.field === "inflationPct")).toBeUndefined();
  });

  it("accepts exactly 10% (the upper bound)", () => {
    const errors = validateFireInputs({ ...validInputs, inflationPct: 10 });
    expect(errors.find((e) => e.field === "inflationPct")).toBeUndefined();
  });

  it("rejects a missing/NaN inflation rate with a friendly message", () => {
    const errors = validateFireInputs({ ...validInputs, inflationPct: NaN });
    const error = errors.find((e) => e.field === "inflationPct");
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/required/i);
  });

  it("rejects a negative inflation rate", () => {
    const errors = validateFireInputs({ ...validInputs, inflationPct: -1 });
    const error = errors.find((e) => e.field === "inflationPct");
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/negative/i);
  });

  it("rejects an inflation rate above 10%", () => {
    const errors = validateFireInputs({ ...validInputs, inflationPct: 15 });
    const error = errors.find((e) => e.field === "inflationPct");
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/10/);
  });
});

describe("validateFireInputs — overall validity", () => {
  it("returns no errors for a fully valid scenario", () => {
    expect(isValidFireInputs(validInputs)).toBe(true);
  });

  it("flags a target FIRE age that isn't greater than current age", () => {
    const errors = validateFireInputs({ ...validInputs, targetFireAge: 30 });
    expect(errors.find((e) => e.field === "targetFireAge")).toBeDefined();
  });

  it("flags a 0% safe withdrawal rate", () => {
    const errors = validateFireInputs({ ...validInputs, safeWithdrawalRatePct: 0 });
    expect(errors.find((e) => e.field === "safeWithdrawalRatePct")).toBeDefined();
  });

  it("flags annual expenses of 0", () => {
    const errors = validateFireInputs({ ...validInputs, annualExpenses: 0 });
    expect(errors.find((e) => e.field === "annualExpenses")).toBeDefined();
  });

  it("accepts a 0% expected return (not an error on its own)", () => {
    const errors = validateFireInputs({ ...validInputs, expectedReturnPct: 0 });
    expect(errors.find((e) => e.field === "expectedReturnPct")).toBeUndefined();
  });

  it("accepts current assets of 0", () => {
    const errors = validateFireInputs({ ...validInputs, currentAssets: 0 });
    expect(errors.find((e) => e.field === "currentAssets")).toBeUndefined();
  });

  it("flags a negative monthly investment", () => {
    const errors = validateFireInputs({ ...validInputs, monthlyInvestment: -100 });
    expect(errors.find((e) => e.field === "monthlyInvestment")).toBeDefined();
  });
});
