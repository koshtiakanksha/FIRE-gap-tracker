/**
 * Sensitivity analysis — a "gap diagnosis" engine that answers "of all the
 * levers I could pull, which one actually moves my FIRE timeline the most?"
 *
 * This deliberately reuses the exact same base-case calculation pipeline
 * (calculateFireResults) as the rest of the app for every lever, nudging
 * exactly one input at a time and comparing the resulting base-case years-
 * to-FIRE against the unmodified baseline. That's what makes the ranking
 * trustworthy: every comparison is a real run through the same formulas
 * the dashboard uses, not a separately-maintained shortcut that could
 * silently drift out of sync.
 */

import { calculateFireResults } from "./fireCalculations";
import type {
  FireInputs,
  FireResults,
  SensitivityAnalysis,
  SensitivityLeverId,
  SensitivityLeverResult,
} from "../types/fire";

interface LeverDefinition {
  id: SensitivityLeverId;
  label: string;
  description: string;
  apply: (inputs: FireInputs) => FireInputs;
}

const LEVERS: LeverDefinition[] = [
  {
    id: "invest-more-10pct",
    label: "Invest 10% more per month",
    description: "Increase your monthly investment by 10%.",
    apply: (inputs) => ({ ...inputs, monthlyInvestment: inputs.monthlyInvestment * 1.1 }),
  },
  {
    id: "spend-less-10pct",
    label: "Reduce expenses by 10%",
    description: "Cut annual expenses by 10% — this also shrinks your FIRE number.",
    apply: (inputs) => ({ ...inputs, annualExpenses: inputs.annualExpenses * 0.9 }),
  },
  {
    id: "higher-return-1pt",
    label: "Earn 1 point more return",
    description: "Expected annual return is 1 percentage point higher.",
    apply: (inputs) => ({ ...inputs, expectedReturnPct: inputs.expectedReturnPct + 1 }),
  },
  {
    id: "lower-swr-half-pt",
    label: "Lower your withdrawal rate by 0.5 points",
    description: "A more conservative safe withdrawal rate raises your FIRE number, which usually slows things down — included so the ranking stays honest about levers that can hurt, not just help.",
    apply: (inputs) => ({ ...inputs, safeWithdrawalRatePct: Math.max(0.1, inputs.safeWithdrawalRatePct - 0.5) }),
  },
  {
    id: "later-target-age",
    label: "Push your target FIRE age out 2 years",
    description: "Give yourself 2 more years to invest before your target age. Measured by how much this lowers your required monthly investment (converted to an equivalent years-saved figure), since this lever doesn't change how fast your portfolio itself grows.",
    apply: (inputs) => ({ ...inputs, targetFireAge: inputs.targetFireAge + 2 }),
  },
];

/**
 * Runs one lever's "apply" function against the baseline inputs, re-runs
 * the full calculation pipeline, and reports how much it improves the plan.
 *
 * Four of the five levers (invest more, spend less, higher return, lower
 * SWR) all change how fast the portfolio crosses the FIRE number, so they
 * share one fair unit: years-to-FIRE improvement on the base-case timeline.
 *
 * The fifth lever — pushing the target FIRE age out — is fundamentally
 * different. estimatedFireAge depends only on the portfolio's own growth
 * trajectory, not on targetFireAge at all (findMonthsToFire never reads
 * it), so "years improvement to estimated FIRE age" is always exactly
 * zero for this lever — comparing it on that axis would be comparing it
 * on a metric it cannot move, which would silently misrank it as useless
 * every time. What targetFireAge actually controls is how much monthly
 * investment is REQUIRED to hit that target — so this lever is measured
 * by the resulting drop in required monthly investment instead, converted
 * into an equivalent "years saved" framing using the same monthly
 * contribution rate, so it remains comparable on the same ranked list.
 */
function evaluateLever(
  lever: LeverDefinition,
  inputs: FireInputs,
  baseline: FireResults,
): SensitivityLeverResult {
  if (lever.id === "later-target-age") {
    return evaluateTargetAgeLever(lever, inputs, baseline);
  }

  if (baseline.timelineStatus === "already-fi") {
    return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement: null };
  }

  const adjustedInputs = lever.apply(inputs);
  const adjustedResult = calculateFireResults(adjustedInputs);

  if (baseline.timelineStatus !== "on-track" && adjustedResult.timelineStatus !== "on-track") {
    // Both unreachable — no meaningful number to report, but not an error.
    return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement: null };
  }

  if (baseline.timelineStatus !== "on-track" && adjustedResult.timelineStatus === "on-track") {
    // The lever alone makes an otherwise-unreachable plan reachable — a
    // real, large improvement, but there's no finite baseline to subtract
    // from. Treat this as null rather than inventing an arbitrary number.
    return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement: null };
  }

  if (adjustedResult.timelineStatus !== "on-track") {
    // The lever made things worse to the point of unreachability (possible
    // with the SWR lever, which raises the FIRE number). A well-defined
    // negative number isn't available here either — null, same reasoning.
    return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement: null };
  }

  const yearsImprovement = (baseline.yearsToFire as number) - (adjustedResult.yearsToFire as number);
  return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement };
}

/**
 * Special-cased evaluation for the "push target age out 2 years" lever.
 * Measures the drop in required monthly investment, then converts that
 * dollar improvement into an equivalent "years saved" figure by asking
 * "how many years of the user's OWN current contribution rate would it
 * take to make up that same dollar difference" — a rough but genuinely
 * comparable unit conversion, not an arbitrary rescaling.
 */
function evaluateTargetAgeLever(
  lever: LeverDefinition,
  inputs: FireInputs,
  baseline: FireResults,
): SensitivityLeverResult {
  if (baseline.timelineStatus === "already-fi") {
    return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement: null };
  }

  const adjustedInputs = lever.apply(inputs);
  const adjustedResult = calculateFireResults(adjustedInputs);

  if (!baseline.requiredContributionReachable || !adjustedResult.requiredContributionReachable) {
    return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement: null };
  }

  const requiredInvestmentDrop = baseline.requiredMonthlyInvestment - adjustedResult.requiredMonthlyInvestment;

  if (inputs.monthlyInvestment <= 0) {
    // No baseline contribution rate to convert dollars into years against —
    // report null rather than dividing by zero or guessing a rate.
    return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement: null };
  }

  // "Years saved" framing: if this lever reduces the monthly requirement by
  // $X, that's loosely equivalent to X / currentMonthlyInvestment years of
  // breathing room at the user's own current contribution pace. This is an
  // approximation (it doesn't compound the way the real timeline would),
  // which is exactly why this lever's description calls out that it's
  // measured differently from the other four.
  const yearsImprovement = requiredInvestmentDrop / inputs.monthlyInvestment;
  return { id: lever.id, label: lever.label, description: lever.description, yearsImprovement };
}

/**
 * Runs every lever against the same baseline and ranks them by impact —
 * the lever with the largest positive yearsImprovement first. Levers with
 * a null improvement (already FI, unreachable on both sides, or newly
 * reachable with no finite comparison) sort last, since they don't have a
 * comparable number, not because they're unimportant.
 */
export function calculateSensitivityAnalysis(inputs: FireInputs): SensitivityAnalysis {
  const baseline = calculateFireResults(inputs);

  const leverResults = LEVERS.map((lever) => evaluateLever(lever, inputs, baseline));

  const ranked = rankFireLevers(leverResults);
  const biggestLever = ranked.find((lever) => lever.yearsImprovement !== null && lever.yearsImprovement > 0) ?? null;

  return { leverResults: ranked, biggestLever };
}

/**
 * Sorts lever results by yearsImprovement, descending (biggest improvement
 * first). Null-improvement levers sort to the end, in their original
 * order, since there's no numeric basis to rank them against each other.
 */
export function rankFireLevers(leverResults: SensitivityLeverResult[]): SensitivityLeverResult[] {
  const withImprovement = leverResults.filter((r) => r.yearsImprovement !== null);
  const withoutImprovement = leverResults.filter((r) => r.yearsImprovement === null);

  withImprovement.sort((a, b) => (b.yearsImprovement as number) - (a.yearsImprovement as number));

  return [...withImprovement, ...withoutImprovement];
}
