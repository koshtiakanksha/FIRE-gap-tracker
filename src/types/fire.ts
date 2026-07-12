/**
 * Core data shapes for the FIRE Gap Tracker.
 *
 * Keeping these in one file means components, calculations, and storage
 * code all agree on the same vocabulary for "what a scenario is."
 */

/** Everything the user controls. This is the only state that gets persisted. */
export interface FireInputs {
  currentAge: number;
  targetFireAge: number;
  currentAssets: number;
  annualExpenses: number;
  monthlyInvestment: number;
  /** Whole-number percent, e.g. 7 means 7%. */
  expectedReturnPct: number;
  /** Whole-number percent, e.g. 4 means 4%. */
  safeWithdrawalRatePct: number;
  /** Optional. Not used in any calculation yet — see lib/fireCalculations.ts. */
  annualIncome?: number;
  /** Optional. Disabled in the MVP; see lib/fireCalculations.ts for why. */
  inflationPct?: number;
}

/** One point along the projected portfolio growth line. */
export interface ProjectionPoint {
  /** Months from today. */
  month: number;
  /** Calendar year-fraction age, for chart labeling. */
  age: number;
  /** Projected portfolio value at this point. */
  value: number;
}

/** Status of the "years to FIRE" calculation — three real-world cases. */
export type FireTimelineStatus = "on-track" | "already-fi" | "unreachable";

/** Everything derived from FireInputs. Nothing here is ever hand-edited by the UI. */
export interface FireResults {
  fireNumber: number;
  progressPct: number;
  timelineStatus: FireTimelineStatus;
  /** Null when status is "already-fi" or "unreachable". */
  yearsToFire: number | null;
  /** Null when status is "already-fi" or "unreachable". */
  estimatedFireAge: number | null;
  /** Dollar gap remaining to the FIRE number. Zero if already there. */
  fireGap: number;
  /** Monthly investment required to hit the user's chosen target age. */
  requiredMonthlyInvestment: number;
  /** Whether the required contribution is even achievable in the years available. */
  requiredContributionReachable: boolean;
  /** Full growth projection used to draw the chart. */
  projection: ProjectionPoint[];
}

/** One "What Moves the Needle" comparison card. */
export interface ScenarioComparison {
  id: "invest-more" | "spend-less" | "lower-returns";
  title: string;
  /** Short, plain-language description of the lever being pulled. */
  description: string;
  /** Human-readable result, e.g. "FIRE arrives 3.2 years sooner." */
  resultText: string;
  /** Whether this lever helps (true), hurts (false), or is neutral (null). */
  direction: "positive" | "negative" | "neutral";
  /** Set when the comparison can't be computed for the current inputs. */
  unavailableReason?: string;
}

/** A single field-level problem with the current inputs. */
export interface ValidationError {
  field: keyof FireInputs;
  message: string;
}

/** The full shape of a scenario file written to disk via export. */
export interface ScenarioFile {
  schemaVersion: 1;
  exportedAt: string;
  inputs: FireInputs;
}
