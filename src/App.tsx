import { useEffect, useMemo, useState } from "react";
import InputPanel from "./components/InputPanel";
import MetricCard, { GapSummaryCard } from "./components/MetricCard";
import ProgressBar from "./components/ProgressBar";
import GrowthChart from "./components/GrowthChart";
import WhatMovesNeedle from "./components/WhatMovesNeedle";
import ScenarioActions from "./components/ScenarioActions";
import type { FireInputs, FireResults } from "./types/fire";
import { calculateFireResults, calculateScenarioComparisons } from "./lib/fireCalculations";
import { validateFireInputs } from "./lib/validation";
import { formatAge, formatCurrency, formatPercent, formatYears } from "./lib/formatters";
import { loadInputsFromLocalStorage, saveInputsToLocalStorage, SAMPLE_INPUTS } from "./lib/scenarioStorage";

function App() {
  const [inputs, setInputs] = useState<FireInputs>(() => loadInputsFromLocalStorage() ?? SAMPLE_INPUTS);

  // Autosave on every change. Cheap, synchronous, and exactly what the spec asks for.
  useEffect(() => {
    saveInputsToLocalStorage(inputs);
  }, [inputs]);

  const errors = useMemo(() => validateFireInputs(inputs), [inputs]);
  const isValid = errors.length === 0;

  const results = useMemo(() => {
    if (!isValid) return null;
    return calculateFireResults(inputs);
  }, [inputs, isValid]);

  const comparisons = useMemo(() => {
    if (!isValid || !results) return null;
    return calculateScenarioComparisons(inputs, results);
  }, [inputs, isValid, results]);

  return (
    <div className="min-h-screen bg-paper">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Input column */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-paper-dim bg-white p-5 shadow-sm">
              <InputPanel inputs={inputs} errors={errors} onChange={setInputs} />
            </div>
            <ScenarioActions inputs={inputs} onApplyInputs={setInputs} />
          </div>

          {/* Results column */}
          <div className="space-y-6">
            {!isValid && (
              <div className="rounded-xl border border-ember/30 bg-ember/5 p-5">
                <p className="text-sm font-medium text-ink">Fix the highlighted inputs to see your results.</p>
                <p className="mt-1 text-xs text-slate">
                  Your dashboard updates the moment every field is valid — nothing is calculated from guesses.
                </p>
              </div>
            )}

            {isValid && results && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricCard label="FIRE number" value={formatCurrency(results.fireNumber)} accent="ink" />
                  <MetricCard
                    label="Current progress"
                    value={formatPercent(results.progressPct)}
                    accent="moss"
                  />
                  <MetricCard
                    label="Years to FIRE"
                    value={
                      results.timelineStatus === "already-fi"
                        ? "0"
                        : results.timelineStatus === "unreachable"
                          ? "100+"
                          : formatYears(results.yearsToFire)
                    }
                    subtext={
                      results.timelineStatus === "unreachable"
                        ? "Not reachable within 100 years at current assumptions."
                        : undefined
                    }
                    accent={results.timelineStatus === "unreachable" ? "ember" : "ink"}
                  />
                  <MetricCard
                    label="Estimated FIRE age"
                    value={
                      results.timelineStatus === "already-fi"
                        ? formatAge(inputs.currentAge)
                        : results.timelineStatus === "unreachable"
                          ? "—"
                          : formatAge(results.estimatedFireAge)
                    }
                    accent="ink"
                  />
                  <MetricCard
                    label="Required monthly investment"
                    value={formatCurrency(results.requiredMonthlyInvestment)}
                    subtext={`To reach FIRE by age ${Math.round(inputs.targetFireAge)}.${
                      !results.requiredContributionReachable ? " Not achievable even at $0 expenses." : ""
                    }`}
                    accent="gold"
                  />
                  <ProgressBarCard results={results} />

                  <GapSummaryCard>
                    {results.timelineStatus === "already-fi"
                      ? "You've already crossed your FIRE number — congratulations, you're financially independent by this plan's math."
                      : `You need ${formatCurrency(results.fireGap)} more to reach financial independence.`}
                  </GapSummaryCard>
                </section>

                <GrowthChart
                  projection={results.projection}
                  fireNumber={results.fireNumber}
                  currentAge={inputs.currentAge}
                />

                {comparisons && <WhatMovesNeedle comparisons={comparisons} />}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ProgressBarCard({ results }: { results: FireResults }) {
  return (
    <div className="sm:col-span-2 lg:col-span-1">
      <ProgressBar progressPct={results.progressPct} isAlreadyFi={results.timelineStatus === "already-fi"} />
    </div>
  );
}

function Header() {
  return (
    <header className="bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="font-mono-num text-xs uppercase tracking-[0.2em] text-gold">Financial independence dashboard</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-paper sm:text-4xl">FIRE Gap Tracker</h1>
        <p className="mt-2 text-base text-paper/70">Know your number. Know the gap.</p>
        <p className="mt-4 max-w-2xl text-xs text-paper/50">
          For educational planning only, not financial advice.
        </p>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-paper-dim">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate sm:px-6 lg:px-8">
        Projections use constant assumptions and don't account for inflation, taxes, or market volatility. Treat
        this as a directional planning tool, not a forecast.
      </div>
    </footer>
  );
}

export default App;
