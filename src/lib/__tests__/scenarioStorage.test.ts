import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveInputsToLocalStorage,
  loadInputsFromLocalStorage,
  parseScenarioJson,
  SAMPLE_INPUTS,
  DEFAULT_INFLATION_PCT,
} from "../scenarioStorage";
import type { FireInputs } from "../../types/fire";

/**
 * Minimal in-memory localStorage shim — deliberately not pulling in jsdom
 * just to get a `window.localStorage`. This is the whole API surface
 * scenarioStorage.ts touches, and it behaves identically to the real thing
 * for these tests' purposes.
 */
function installFakeLocalStorage() {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
  vi.stubGlobal("window", { localStorage: fakeLocalStorage });
  vi.stubGlobal("localStorage", fakeLocalStorage);
  return fakeLocalStorage;
}

describe("localStorage autosave / load round-trip", () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it("saves and loads inputs, including inflationPct, exactly as given", () => {
    saveInputsToLocalStorage(SAMPLE_INPUTS);
    const loaded = loadInputsFromLocalStorage();
    expect(loaded).toEqual(SAMPLE_INPUTS);
    expect(loaded?.inflationPct).toBe(3);
  });

  it("returns null when nothing has been saved yet", () => {
    expect(loadInputsFromLocalStorage()).toBeNull();
  });

  it("defaults inflationPct to 3% for old data saved before Phase 1 added the field", () => {
    const oldShapeData = {
      currentAge: 35,
      targetFireAge: 55,
      currentAssets: 100000,
      annualExpenses: 50000,
      monthlyInvestment: 2000,
      expectedReturnPct: 6,
      safeWithdrawalRatePct: 4,
      // inflationPct intentionally absent — simulates a pre-Phase-1 save.
    };
    window.localStorage.setItem("fire-gap-tracker:scenario", JSON.stringify(oldShapeData));

    const loaded = loadInputsFromLocalStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.inflationPct).toBe(DEFAULT_INFLATION_PCT);
    expect(loaded?.currentAge).toBe(35); // everything else carries through unchanged
  });

  it("returns null (not a crash) for corrupted JSON in storage", () => {
    window.localStorage.setItem("fire-gap-tracker:scenario", "{not valid json");
    expect(loadInputsFromLocalStorage()).toBeNull();
  });

  it("returns null for structurally incomplete saved data (missing required numeric fields)", () => {
    window.localStorage.setItem("fire-gap-tracker:scenario", JSON.stringify({ currentAge: 30 }));
    expect(loadInputsFromLocalStorage()).toBeNull();
  });
});

describe("JSON import — parseScenarioJson", () => {
  it("accepts a full ScenarioFile export and applies inflationPct as saved", () => {
    const exported = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      inputs: SAMPLE_INPUTS,
    };
    const result = parseScenarioJson(JSON.stringify(exported));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.inputs.inflationPct).toBe(3);
    }
  });

  it("accepts a bare FireInputs object without the ScenarioFile wrapper", () => {
    const result = parseScenarioJson(JSON.stringify(SAMPLE_INPUTS));
    expect(result.success).toBe(true);
  });

  it("defaults inflationPct to 3% when importing an old file that predates the field", () => {
    const oldExport = {
      currentAge: 40,
      targetFireAge: 60,
      currentAssets: 200000,
      annualExpenses: 60000,
      monthlyInvestment: 2500,
      expectedReturnPct: 6,
      safeWithdrawalRatePct: 4,
    };
    const result = parseScenarioJson(JSON.stringify(oldExport));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.inputs.inflationPct).toBe(DEFAULT_INFLATION_PCT);
    }
  });

  it("rejects invalid JSON with a friendly error, not a thrown exception", () => {
    const result = parseScenarioJson("{not valid json at all");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/json/i);
    }
  });

  it("rejects structurally incomplete files with a friendly error", () => {
    const result = parseScenarioJson(JSON.stringify({ currentAge: 30 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("rejects a JSON array (valid JSON, wrong shape) without throwing", () => {
    const result = parseScenarioJson(JSON.stringify([1, 2, 3]));
    expect(result.success).toBe(false);
  });
});

describe("SAMPLE_INPUTS", () => {
  it("is itself a valid, complete FireInputs object including inflationPct", () => {
    const sample: FireInputs = SAMPLE_INPUTS;
    expect(sample.inflationPct).toBe(3);
    expect(Number.isFinite(sample.currentAge)).toBe(true);
    expect(sample.targetFireAge).toBeGreaterThan(sample.currentAge);
  });
});
