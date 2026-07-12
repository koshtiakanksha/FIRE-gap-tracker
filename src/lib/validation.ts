/**
 * Validation for FireInputs. Keeps every "this would break the math" rule
 * from the spec in one place, so both the live input panel and the JSON
 * import flow can call the same checks and never disagree with each other.
 */

import type { FireInputs, ValidationError } from "../types/fire";

/**
 * Validates a full set of inputs and returns every problem found (not just
 * the first one) so the UI can surface all of them at once.
 */
export function validateFireInputs(inputs: FireInputs): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isFinite(inputs.currentAge) || inputs.currentAge < 0 || inputs.currentAge > 100) {
    errors.push({ field: "currentAge", message: "Current age must be between 0 and 100." });
  }

  if (!isFinite(inputs.targetFireAge) || inputs.targetFireAge <= inputs.currentAge) {
    errors.push({ field: "targetFireAge", message: "Target FIRE age must be greater than current age." });
  }

  if (!isFinite(inputs.currentAssets) || inputs.currentAssets < 0) {
    errors.push({ field: "currentAssets", message: "Current invested assets can't be negative." });
  }

  if (!isFinite(inputs.annualExpenses) || inputs.annualExpenses <= 0) {
    errors.push({ field: "annualExpenses", message: "Annual expenses must be greater than $0." });
  }

  if (!isFinite(inputs.monthlyInvestment) || inputs.monthlyInvestment < 0) {
    errors.push({ field: "monthlyInvestment", message: "Monthly investment can't be negative." });
  }

  if (!isFinite(inputs.expectedReturnPct)) {
    errors.push({ field: "expectedReturnPct", message: "Expected return must be a number." });
  } else if (inputs.expectedReturnPct < -50 || inputs.expectedReturnPct > 50) {
    errors.push({ field: "expectedReturnPct", message: "Expected return should be between -50% and 50%." });
  }

  if (!isFinite(inputs.safeWithdrawalRatePct) || inputs.safeWithdrawalRatePct <= 0) {
    errors.push({ field: "safeWithdrawalRatePct", message: "Safe withdrawal rate must be greater than 0%." });
  } else if (inputs.safeWithdrawalRatePct > 20) {
    errors.push({ field: "safeWithdrawalRatePct", message: "Safe withdrawal rate should be 20% or less." });
  }

  if (inputs.annualIncome !== undefined && (!isFinite(inputs.annualIncome) || inputs.annualIncome < 0)) {
    errors.push({ field: "annualIncome", message: "Annual income can't be negative." });
  }

  if (inputs.inflationPct !== undefined && (!isFinite(inputs.inflationPct) || inputs.inflationPct < 0)) {
    errors.push({ field: "inflationPct", message: "Inflation can't be negative." });
  }

  return errors;
}

/** Quick boolean check used to gate calculations/chart rendering. */
export function isValidFireInputs(inputs: FireInputs): boolean {
  return validateFireInputs(inputs).length === 0;
}
