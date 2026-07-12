import type { MonteCarloSummary, SavingsRateRealism, SensitivityAnalysis } from "../types/fire";
import MetricCard from "./MetricCard";
import { formatAge, formatPercent, formatYears } from "../lib/formatters";

interface RiskDiagnosisSectionProps {
  monteCarlo: MonteCarloSummary;
  savingsRealism: SavingsRateRealism | null;
  sensitivity: SensitivityAnalysis;
}

const REALISM_COPY: Record<
  NonNullable<SavingsRateRealism["label"]>,
  { label: string; accent: "moss" | "gold" | "ember"; description: string }
> = {
  realistic: {
    label: "Realistic",
    accent: "moss",
    description: "The required investment is a modest share of your income — a comfortable margin for most budgets.",
  },
  aggressive: {
    label: "Aggressive",
    accent: "gold",
    description: "The required investment takes a meaningful bite out of your income. Doable, but it'll require real discipline.",
  },
  "very-aggressive": {
    label: "Very aggressive",
    accent: "ember",
    description: "The required investment is a large share of your income. Worth stress-testing against your actual budget.",
  },
  "likely-unrealistic": {
    label: "Likely unrealistic",
    accent: "ember",
    description: "The required investment would take up most or all of your income. This target age likely needs to move, or another lever needs to do more work.",
  },
};

/**
 * The "Risk & Diagnosis" section — Phase 2's home for everything that's
 * about UNCERTAINTY rather than a single deterministic answer: how often
 * does this plan actually work out across many random outcomes, how
 * aggressive is it relative to income, and which lever would help the
 * most. Deliberately separate from the deterministic metric cards above
 * it, so a reader can tell at a glance which numbers are "the plan" and
 * which numbers are "how confident should I be in the plan."
 */
export default function RiskDiagnosisSection({ monteCarlo, savingsRealism, sensitivity }: RiskDiagnosisSectionProps) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-ink">Risk &amp; diagnosis</h2>
        <p className="mt-1 text-sm text-slate">
          The numbers above assume returns behave smoothly. Markets don't. Here's what a few thousand more
          realistic, randomized outcomes suggest — directional, not a guarantee.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Probability of reaching FIRE"
          value={formatPercent(monteCarlo.probabilityOfSuccessPct, 0)}
          subtext={`Share of ${monteCarlo.numSimulations.toLocaleString()} simulated outcomes that reached your FIRE number within 100 years.`}
          accent={monteCarlo.probabilityOfSuccessPct >= 70 ? "moss" : monteCarlo.probabilityOfSuccessPct >= 40 ? "gold" : "ember"}
        />
        <MetricCard
          label="Median FIRE age"
          value={monteCarlo.medianFireAge !== null ? formatAge(monteCarlo.medianFireAge) : "Not reached"}
          subtext="The middle outcome across all simulated runs — half finish sooner, half later."
          accent="ink"
        />
        <MetricCard
          label="10th–90th percentile range"
          value={
            monteCarlo.p10FireAge !== null && monteCarlo.p90FireAge !== null
              ? `${formatAge(monteCarlo.p10FireAge)}–${formatAge(monteCarlo.p90FireAge)}`
              : "Not reached"
          }
          subtext={
            monteCarlo.p10FireAge !== null && monteCarlo.p90FireAge !== null
              ? "A relatively lucky run (10th percentile) to a relatively unlucky one (90th percentile)."
              : "Fewer than 10% of simulated runs reached FIRE within 100 years."
          }
          accent="ink"
        />

        {savingsRealism ? (
          <MetricCard
            label="Plan realism"
            value={REALISM_COPY[savingsRealism.label].label}
            subtext={`${REALISM_COPY[savingsRealism.label].description} Required investment is ${formatPercent(savingsRealism.requiredSavingsRatePct, 0)} of income.`}
            accent={REALISM_COPY[savingsRealism.label].accent}
          />
        ) : (
          <MetricCard
            label="Plan realism"
            value="Add income"
            subtext="Enter your annual income (optional, in the input panel) to see how aggressive this plan is relative to your paycheck."
            accent="ink"
          />
        )}

        <BiggestLeverCard sensitivity={sensitivity} />
      </div>

      <SensitivityInsight sensitivity={sensitivity} />
    </section>
  );
}

/**
 * The plain-language "your biggest lever is X" callout the spec asks for,
 * built by comparing the top two ranked levers so the insight can say not
 * just "X helps most" but "X helps more than Y" when there's a clear
 * runner-up to contrast against.
 */
function SensitivityInsight({ sensitivity }: { sensitivity: SensitivityAnalysis }) {
  const ranked = sensitivity.leverResults.filter((r) => r.yearsImprovement !== null && r.yearsImprovement > 0);

  if (ranked.length === 0) {
    return null;
  }

  const [first, second] = ranked;

  return (
    <div className="mt-4 rounded-lg bg-paper-dim/60 px-4 py-3">
      <p className="text-sm text-ink">
        <span className="font-medium">Your biggest lever is {lowercaseFirst(first.label)}.</span>{" "}
        {second
          ? `A ${formatYears(first.yearsImprovement)} improvement — bigger than ${lowercaseFirst(second.label)} (${formatYears(second.yearsImprovement)}).`
          : `That alone improves your FIRE timeline by about ${formatYears(first.yearsImprovement)}.`}
      </p>
    </div>
  );
}

function lowercaseFirst(text: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function BiggestLeverCard({ sensitivity }: { sensitivity: SensitivityAnalysis }) {
  if (!sensitivity.biggestLever || sensitivity.biggestLever.yearsImprovement === null) {
    return (
      <MetricCard
        label="Biggest FIRE lever"
        value="Already there"
        subtext="You're already financially independent in the base case, so there's no timeline left to improve."
        accent="moss"
      />
    );
  }

  const { biggestLever } = sensitivity;
  return (
    <MetricCard
      label="Biggest FIRE lever"
      value={biggestLever.label}
      subtext={`Improves your timeline by about ${formatYears(biggestLever.yearsImprovement)} versus your other levers, all else equal.`}
      accent="gold"
      emphasis
    />
  );
}
