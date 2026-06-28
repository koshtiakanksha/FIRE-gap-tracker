/**
 * Savings-rate realism — Phase 2's first real use of annual income.
 *
 * Annual income has existed as an optional input since Phase 0/1 but was
 * never used in any calculation. Phase 2 uses it for exactly one purpose:
 * turning a dollar figure (required monthly investment) into a % of income,
 * which is a much more intuitive gut-check of whether a plan is actually
 * livable. $3,600/month sounds abstract; "62% of your take-home pay" does
 * not. This stays entirely optional — if income isn't provided, none of
 * these calculations run, and nothing in the rest of the app changes.
 */

import type { FireInputs, SavingsRateRealism, SavingsRealismLabel } from "../types/fire";

/**
 * Thresholds for how much of monthly income the REQUIRED contribution
 * represents, used to assign a realism label. These are deliberately
 * round, simple cutoffs — this is a directional gut-check, not a
 * underwriting model.
 */
const REALISM_THRESHOLDS: { max: number; label: SavingsRealismLabel }[] = [
  { max: 20, label: "realistic" },
  { max: 35, label: "aggressive" },
  { max: 50, label: "very-aggressive" },
  { max: Infinity, label: "likely-unrealistic" },
];

function labelForSavingsRatePct(requiredSavingsRatePct: number): SavingsRealismLabel {
  for (const threshold of REALISM_THRESHOLDS) {
    if (requiredSavingsRatePct <= threshold.max) return threshold.label;
  }
  return "likely-unrealistic";
}

/**
 * Computes the savings-rate realism read for a plan, or null if annual
 * income wasn't provided (Phase 2 never requires income — see file header).
 *
 * - currentSavingsRatePct: today's monthly investment ÷ monthly income
 * - requiredSavingsRatePct: the (inflation-adjusted) required monthly
 *   investment ÷ monthly income — this is what actually drives the label,
 *   since it answers "how much of my income would THIS plan actually need"
 * - label: a simple, four-tier realism read based on requiredSavingsRatePct
 *
 * A required savings rate that's negative (already on pace) or whose
 * income is $0 are both treated as edge cases returning sane, non-crashing
 * values rather than NaN or a divide-by-zero — $0 income can't sensibly
 * produce a percentage, so it returns null exactly like missing income does.
 */
export function calculateSavingsRateRealism(
  inputs: FireInputs,
  requiredMonthlyInvestment: number,
): SavingsRateRealism | null {
  if (inputs.annualIncome === undefined || !isFinite(inputs.annualIncome) || inputs.annualIncome <= 0) {
    return null;
  }

  const monthlyIncome = inputs.annualIncome / 12;

  const currentSavingsRatePct = Math.max(0, (inputs.monthlyInvestment / monthlyIncome) * 100);
  const requiredSavingsRatePct = Math.max(0, (requiredMonthlyInvestment / monthlyIncome) * 100);

  return {
    currentSavingsRatePct,
    requiredSavingsRatePct,
    label: labelForSavingsRatePct(requiredSavingsRatePct),
  };
}
