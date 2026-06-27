import type { ScenarioComparison } from "../types/fire";

interface WhatMovesNeedleProps {
  comparisons: ScenarioComparison[];
}

const directionStyles: Record<ScenarioComparison["direction"], string> = {
  positive: "border-moss/30 bg-moss/5",
  negative: "border-ember/30 bg-ember/5",
  neutral: "border-paper-dim bg-paper-dim/40",
};

const directionTextStyles: Record<ScenarioComparison["direction"], string> = {
  positive: "text-moss",
  negative: "text-ember",
  neutral: "text-slate",
};

export default function WhatMovesNeedle({ comparisons }: WhatMovesNeedleProps) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-ink">What moves the needle</h2>
        <p className="mt-1 text-sm text-slate">
          Three quick what-ifs, calculated from your actual numbers — not canned examples.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {comparisons.map((comparison) => (
          <div
            key={comparison.id}
            className={`rounded-xl border p-5 shadow-sm ${directionStyles[comparison.direction]}`}
          >
            <p className="font-display text-base font-semibold text-ink">{comparison.title}</p>
            <p className="mt-1 text-xs text-slate">{comparison.description}</p>
            <p className={`mt-3 text-sm font-medium leading-snug ${directionTextStyles[comparison.direction]}`}>
              {comparison.resultText}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
