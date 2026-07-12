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
  /**
   * Whole-number percent, e.g. 15 means 15%. Added in Phase 2 for the Monte
   * Carlo simulation — the standard deviation of annual returns around the
   * expected return. Required (defaults to 15% for old data missing it, the
   * same migration pattern used for inflationPct in Phase 1). Valid range:
   * 0% to 40%.
   */
  volatilityPct: number;
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

// ---------------------------------------------------------------------------
// Phase 2: Monte Carlo simulation
// ---------------------------------------------------------------------------

/**
 * Outcome of a single simulated "life" in the Monte Carlo run: did this
 * particular random sequence of annual returns cross the (inflating) FIRE
 * number before the 100-year search cap, and if so, when?
 */
export interface MonteCarloRunOutcome {
  reachedFire: boolean;
  /** Months to FIRE for this run. Null if never reached within the cap. */
  monthsToFire: number | null;
}

/** One point along a Monte Carlo percentile chart path. */
export interface MonteCarloChartPoint {
  month: number;
  age: number;
  p10: number;
  p50: number;
  p90: number;
  /** The inflating FIRE number in future dollars, same as the deterministic chart's target line. */
  fireTarget: number;
}

/** Best/worst-case framing shown alongside the percentile FIRE ages. */
export type MonteCarloOutcomeLabel = "best-case" | "typical" | "worst-case";

/**
 * Full summary of a Monte Carlo run — the numbers the Risk & Diagnosis
 * section actually displays. Built by calculateMonteCarloSummary from the
 * raw per-run outcomes produced by runMonteCarloSimulation.
 */
export interface MonteCarloSummary {
  numSimulations: number;
  /** Share of simulated runs (0-100) that reached FIRE by the user's target age. */
  probabilityOfSuccessPct: number;
  /** Median (50th percentile) FIRE age across all runs. Null if fewer than half of runs ever reach FIRE. */
  medianFireAge: number | null;
  /** 10th percentile FIRE age — a relatively fast/lucky outcome. Null if fewer than 10% of runs reach FIRE. */
  p10FireAge: number | null;
  /** 90th percentile FIRE age — a relatively slow/unlucky outcome. Null if fewer than 90% of runs reach FIRE. */
  p90FireAge: number | null;
  /** Chart-ready percentile portfolio paths plus the inflating FIRE target. */
  chartPaths: MonteCarloChartPoint[];
}

// ---------------------------------------------------------------------------
// Phase 2: savings-rate realism
// ---------------------------------------------------------------------------

export type SavingsRealismLabel = "realistic" | "aggressive" | "very-aggressive" | "likely-unrealistic";

/**
 * Reads on how much of the user's income their plan requires them to
 * invest. Only computed when annualIncome is provided — Phase 2 uses
 * annual income for the first time, but it remains fully optional.
 */
export interface SavingsRateRealism {
  /** Current monthly investment as a % of monthly income. */
  currentSavingsRatePct: number;
  /** Required monthly investment (to hit target FIRE age) as a % of monthly income. */
  requiredSavingsRatePct: number;
  label: SavingsRealismLabel;
}

// ---------------------------------------------------------------------------
// Phase 2: sensitivity analysis
// ---------------------------------------------------------------------------

export type SensitivityLeverId =
  | "invest-more-10pct"
  | "spend-less-10pct"
  | "higher-return-1pt"
  | "lower-swr-half-pt"
  | "later-target-age";

/** Result of nudging ONE lever and re-running the base-case timeline. */
export interface SensitivityLeverResult {
  id: SensitivityLeverId;
  label: string;
  /** Short description of exactly what was changed. */
  description: string;
  /**
   * Years the base-case FIRE timeline improves by (positive = sooner,
   * negative = later, though every lever here is chosen to help). Null
   * when the comparison can't be made (e.g. already FI on both sides).
   */
  yearsImprovement: number | null;
}

/** Full ranked sensitivity analysis — every lever, ordered by impact. */
export interface SensitivityAnalysis {
  leverResults: SensitivityLeverResult[];
  /** The single biggest lever, or null if no lever could be compared (e.g. already FI). */
  biggestLever: SensitivityLeverResult | null;
}
