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
  /**
   * Whole-number percent, e.g. 3 means 3%. Required as of Phase 1 — every
   * projection now grows expenses (and the FIRE number) with inflation
   * rather than treating it as a disabled, decorative field.
   */
  inflationPct: number;
}

/** One point along a single projected portfolio growth line. */
export interface ProjectionPoint {
  /** Months from today. */
  month: number;
  /** Calendar year-fraction age, for chart labeling. */
  age: number;
  /** Projected portfolio value at this point. */
  value: number;
}

/**
 * One point along the combined chart series, carrying all three return
 * paths plus the (inflation-growing) FIRE target for that same month.
 * This is what GrowthChart.tsx actually plots.
 */
export interface CombinedProjectionPoint {
  month: number;
  age: number;
  conservative: number;
  base: number;
  optimistic: number;
  /** The FIRE number at this point in time, in future dollars. */
  fireTarget: number;
}

/** Status of the "years to FIRE" calculation — three real-world cases. */
export type FireTimelineStatus = "on-track" | "already-fi" | "unreachable";

/** The three return assumptions shown side by side on the chart and in FIRE-age cards. */
export type ReturnPathKey = "conservative" | "base" | "optimistic";

/**
 * Result of running the full FIRE timeline search for one return assumption.
 * Deliberately does NOT carry its own month-by-month projection — the chart
 * renders all three paths from the single combinedProjection series instead,
 * so there's exactly one projection-building code path, not two that could
 * silently drift apart.
 */
export interface ReturnPathResult {
  path: ReturnPathKey;
  /** The annual return actually used for this path, after flooring at 0% (see calculateReturnRangePaths). */
  annualReturnPct: number;
  timelineStatus: FireTimelineStatus;
  yearsToFire: number | null;
  estimatedFireAge: number | null;
}

/** Everything derived from FireInputs. Nothing here is ever hand-edited by the UI. */
export interface FireResults {
  /** FIRE number in today's dollars — unaffected by inflation, the original spec's formula. */
  fireNumberToday: number;
  /** FIRE number restated in future dollars at the user's target FIRE age, after inflation. */
  fireNumberAtTargetAge: number;
  progressPct: number;

  /** Base-case timeline (expected return, exactly as entered). Kept as the "headline" timeline. */
  timelineStatus: FireTimelineStatus;
  /** Null when status is "already-fi" or "unreachable". */
  yearsToFire: number | null;
  /** Null when status is "already-fi" or "unreachable". */
  estimatedFireAge: number | null;

  /** Dollar gap remaining to today's-dollars FIRE number. Zero if already there. */
  fireGap: number;

  /** Monthly investment required to hit the user's chosen target age, in today's dollars. */
  requiredMonthlyInvestment: number;
  /** Whether the required contribution is even achievable in the years available. */
  requiredContributionReachable: boolean;

  /** Conservative / base / optimistic results, each a full timeline search at a different return. */
  returnPaths: Record<ReturnPathKey, ReturnPathResult>;

  /** Combined chart series: all three paths plus the inflating FIRE target, aligned by month. */
  combinedProjection: CombinedProjectionPoint[];
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
