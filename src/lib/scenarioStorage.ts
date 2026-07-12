/**
 * Persistence layer: autosaving the current scenario to localStorage, plus
 * exporting/importing a scenario as a portable JSON file.
 *
 * This is the only file that touches `window.localStorage` or constructs
 * downloadable files — keeping that in one place makes it easy to reason
 * about what gets written to disk and when.
 */

import type { FireInputs, ScenarioFile } from "../types/fire";

const STORAGE_KEY = "fire-gap-tracker:scenario";
const SCHEMA_VERSION = 1;

/**
 * Default inflation rate applied whenever it's missing — either because a
 * scenario was saved before Phase 1 added this field, or because an
 * imported JSON file predates it. Keeps old saved data from ever breaking.
 */
export const DEFAULT_INFLATION_PCT = 3;

/** Realistic starter values shown on first load and on "Reset to sample". */
export const SAMPLE_INPUTS: FireInputs = {
  currentAge: 30,
  targetFireAge: 50,
  currentAssets: 75000,
  annualExpenses: 48000,
  monthlyInvestment: 1500,
  expectedReturnPct: 7,
  safeWithdrawalRatePct: 4,
  annualIncome: 95000,
  inflationPct: DEFAULT_INFLATION_PCT,
};

/**
 * Fills in a missing inflation rate on older saved/imported data, so a
 * scenario created before Phase 1 still loads cleanly instead of failing
 * validation for a field the user never had a chance to set.
 */
function withInflationDefault(inputs: FireInputs): FireInputs {
  if (typeof inputs.inflationPct === "number" && isFinite(inputs.inflationPct)) {
    return inputs;
  }
  return { ...inputs, inflationPct: DEFAULT_INFLATION_PCT };
}

/** Saves the current inputs to localStorage. Fails silently but logs — this is a non-critical convenience feature. */
export function saveInputsToLocalStorage(inputs: FireInputs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch (err) {
    console.warn("Could not autosave scenario to localStorage:", err);
  }
}

/** Loads previously saved inputs, or null if there's nothing saved (or it's corrupted). */
export function loadInputsFromLocalStorage(): FireInputs | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!looksLikeFireInputs(parsed)) return null;
    return withInflationDefault(parsed as FireInputs);
  } catch (err) {
    console.warn("Could not load saved scenario from localStorage:", err);
    return null;
  }
}

/** Triggers a browser download of the current scenario as a JSON file. */
export function downloadScenarioAsJson(inputs: FireInputs): void {
  const file: ScenarioFile = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    inputs,
  };

  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `fire-gap-tracker-scenario-${dateStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Result of attempting to parse an imported scenario file. */
export type ImportResult =
  | { success: true; inputs: FireInputs }
  | { success: false; error: string };

/**
 * Parses and validates an uploaded scenario file's text content.
 * Never throws — every failure mode returns a friendly, specific message
 * instead of a stack trace.
 */
export function parseScenarioJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: "That file isn't valid JSON. Make sure you're importing a file exported from this app." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { success: false, error: "That file doesn't look like a FIRE Gap Tracker scenario." };
  }

  const obj = parsed as Record<string, unknown>;

  // Accept either a full ScenarioFile wrapper or a bare FireInputs object,
  // since someone might hand-edit one before re-importing it.
  const candidateInputs = looksLikeFireInputs(obj.inputs) ? obj.inputs : obj;

  if (!looksLikeFireInputs(candidateInputs)) {
    return {
      success: false,
      error: "That file is missing one or more required fields. Try exporting a fresh scenario and comparing the structure.",
    };
  }

  return { success: true, inputs: withInflationDefault(candidateInputs as FireInputs) };
}

/**
 * Structural check that an unknown value has the required FireInputs shape
 * and types. Deliberately does NOT require inflationPct here — scenarios
 * exported before Phase 1 won't have it, and withInflationDefault() fills
 * it in right after this check passes, so old files import cleanly instead
 * of being rejected for a field that didn't exist yet when they were saved.
 */
function looksLikeFireInputs(value: unknown): value is FireInputs {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  const requiredNumberFields: Array<keyof FireInputs> = [
    "currentAge",
    "targetFireAge",
    "currentAssets",
    "annualExpenses",
    "monthlyInvestment",
    "expectedReturnPct",
    "safeWithdrawalRatePct",
  ];

  return requiredNumberFields.every((field) => typeof v[field] === "number" && isFinite(v[field] as number));
}
